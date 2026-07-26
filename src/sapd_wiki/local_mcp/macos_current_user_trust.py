"""macOS Web-development CurrentUser trust adapter.

The adapter uses only Apple's fixed ``/usr/bin/security`` interface and is
disabled for mutation unless the caller supplies an explicit capability.  D1
replaces this Web-development bridge with the signed App Security Framework
bridge while keeping the same business contract.
"""

from __future__ import annotations

import ipaddress
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Callable, Protocol

from cryptography import x509
from cryptography.hazmat.primitives import serialization

from .certificate_trust import (
    CertificateTrustError,
    ManagedTrustTarget,
    TrustInspection,
    TrustSnapshot,
    normalize_fingerprint,
)


_SECURITY = Path("/usr/bin/security")
_HASH_RE = re.compile(r"SHA-256 hash:\s*([0-9A-Fa-f]{64})")


@dataclass(frozen=True, slots=True)
class CommandResult:
    returncode: int
    stdout: bytes
    stderr: bytes


class CommandRunner(Protocol):
    def run(
        self,
        argv: tuple[str, ...],
        *,
        input_bytes: bytes | None = None,
    ) -> CommandResult: ...


class SubprocessCommandRunner:
    def run(
        self,
        argv: tuple[str, ...],
        *,
        input_bytes: bytes | None = None,
    ) -> CommandResult:
        try:
            completed = subprocess.run(
                argv,
                input=input_bytes,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
                shell=False,
                timeout=120,
                env={"PATH": "/usr/bin:/bin"},
            )
        except subprocess.TimeoutExpired as exc:
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_CONFIRMATION_TIMEOUT"
            ) from exc
        return CommandResult(
            returncode=completed.returncode,
            stdout=completed.stdout[:1024 * 1024],
            stderr=completed.stderr[:8192],
        )


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _security_hash_to_fingerprint(value: str) -> str:
    raw = value.upper()
    return ":".join(raw[index : index + 2] for index in range(0, len(raw), 2))


class MacOSCurrentUserTrustAdapter:
    backend = "macos_user_trust"
    scope = "current_user"
    policy = "ssl_loopback_only"

    def __init__(
        self,
        *,
        runtime_root: Path,
        runner: CommandRunner | None = None,
        mutation_enabled: bool = False,
        login_keychain: Path | None = None,
        managed_fingerprints: Callable[[], set[str]] | None = None,
    ) -> None:
        root = Path(runtime_root)
        if not root.is_absolute() or root.is_symlink():
            raise CertificateTrustError("CERTIFICATE_TRUST_RUNTIME_UNSAFE")
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(root, 0o700)
        self.runtime_root = root.resolve(strict=True)
        candidate = login_keychain or (
            Path.home() / "Library" / "Keychains" / "login.keychain-db"
        )
        if not candidate.is_absolute():
            raise CertificateTrustError("CERTIFICATE_TRUST_STORE_INVALID")
        self.login_keychain = candidate
        self.runner = runner or SubprocessCommandRunner()
        self.mutation_enabled = bool(mutation_enabled)
        self._managed_fingerprints = managed_fingerprints or (lambda: set())

    @staticmethod
    def _require_platform() -> None:
        if os.name == "nt" or not _SECURITY.is_file():
            raise CertificateTrustError("CERTIFICATE_TRUST_BACKEND_UNAVAILABLE")

    def _public_certificate_path(
        self,
        target: ManagedTrustTarget,
        *,
        kind: str,
        certificate_der: bytes,
    ) -> Path:
        path = self.runtime_root / f"{target.generation_id}.{kind}.pem"
        certificate = x509.load_der_x509_certificate(certificate_der)
        payload = certificate.public_bytes(serialization.Encoding.PEM)
        temporary = path.with_suffix(".tmp")
        descriptor = os.open(
            temporary,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o600,
        )
        try:
            os.write(descriptor, payload)
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        os.replace(temporary, path)
        os.chmod(path, 0o600)
        return path

    def _certificate_path(self, target: ManagedTrustTarget) -> Path:
        return self._public_certificate_path(
            target,
            kind="ca",
            certificate_der=target.certificate_der,
        )

    def _verification_certificate_path(self, target: ManagedTrustTarget) -> Path:
        return self._public_certificate_path(
            target,
            kind="server",
            certificate_der=target.verification_certificate_der,
        )

    def _hashes(self, target: ManagedTrustTarget) -> list[str]:
        self._require_platform()
        result = self.runner.run(
            (
                str(_SECURITY),
                "find-certificate",
                "-a",
                "-c",
                target.display_name,
                "-Z",
                str(self.login_keychain),
            )
        )
        if result.returncode not in {0, 44}:
            raise CertificateTrustError("CERTIFICATE_TRUST_STORE_UNAVAILABLE")
        return [
            _security_hash_to_fingerprint(match)
            for match in _HASH_RE.findall(result.stdout.decode("utf-8", "replace"))
        ]

    @staticmethod
    def _loopback_name_constraints_valid(target: ManagedTrustTarget) -> bool:
        try:
            certificate = x509.load_der_x509_certificate(target.certificate_der)
            extension = certificate.extensions.get_extension_for_class(
                x509.NameConstraints
            )
        except (TypeError, ValueError, x509.ExtensionNotFound):
            return False
        constraints = extension.value
        permitted = constraints.permitted_subtrees or []
        return (
            extension.critical
            and constraints.excluded_subtrees is None
            and len(permitted) == 1
            and isinstance(permitted[0], x509.IPAddress)
            and permitted[0].value == ipaddress.ip_network("127.0.0.1/32")
        )

    def inspect_target(self, target: ManagedTrustTarget) -> TrustInspection:
        expected = normalize_fingerprint(target.fingerprint_sha256)
        hashes = self._hashes(target)
        managed = {normalize_fingerprint(item) for item in self._managed_fingerprints()}
        conflicts = [
            item for item in hashes if item != expected and item not in managed
        ]
        exact = expected in hashes
        policy_valid = False
        if exact:
            server_path = self._verification_certificate_path(target)
            ca_path = self._certificate_path(target)
            try:
                ssl_verified = self.runner.run(
                    (
                        str(_SECURITY),
                        "verify-cert",
                        "-c",
                        str(server_path),
                        "-p",
                        "ssl",
                        "-n",
                        target.host,
                        "-k",
                        str(self.login_keychain),
                        "-L",
                    )
                )
                root_verified = self.runner.run(
                    (
                        str(_SECURITY),
                        "verify-cert",
                        "-c",
                        str(ca_path),
                        "-p",
                        "basic",
                        "-l",
                        "-k",
                        str(self.login_keychain),
                        "-L",
                    )
                )
                policy_valid = (
                    self._loopback_name_constraints_valid(target)
                    and ssl_verified.returncode == 0
                    and root_verified.returncode == 0
                )
            finally:
                server_path.unlink(missing_ok=True)
                ca_path.unlink(missing_ok=True)
        installed = exact and policy_valid and not conflicts
        return TrustInspection(
            installed=installed,
            conflict=bool(conflicts),
            policy_valid=policy_valid,
            conflict_count=len(conflicts),
            backend=self.backend,
            scope=self.scope,
            policy=self.policy,
            verified_at=_iso_now() if installed else None,
            reason_code=(
                "CERTIFICATE_TRUST_CONFLICT"
                if conflicts
                else "CERTIFICATE_TRUST_POLICY_INVALID"
                if exact and not policy_valid
                else None
                if installed
                else "CERTIFICATE_TRUST_MISSING"
            ),
        )

    def snapshot(self, target: ManagedTrustTarget) -> TrustSnapshot:
        hashes = sorted(self._hashes(target))
        managed = {normalize_fingerprint(item) for item in self._managed_fingerprints()}
        conflicts = [
            item
            for item in hashes
            if item != target.fingerprint_sha256 and item not in managed
        ]
        return TrustSnapshot(
            backend=self.backend,
            scope=self.scope,
            digest=sha256(repr(hashes).encode("utf-8")).hexdigest(),
            managed_count=sum(item in managed for item in hashes),
            conflicting_count=len(conflicts),
            captured_at=_iso_now(),
        )

    def install_target(self, target: ManagedTrustTarget) -> bool:
        self._require_platform()
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        inspection = self.inspect_target(target)
        if inspection.conflict:
            raise CertificateTrustError("CERTIFICATE_TRUST_CONFLICT")
        if inspection.installed:
            return False
        if not self._loopback_name_constraints_valid(target):
            raise CertificateTrustError("CERTIFICATE_TRUST_POLICY_INVALID")
        path = self._certificate_path(target)
        try:
            result = self.runner.run(
                (
                    str(_SECURITY),
                    "add-trusted-cert",
                    "-r",
                    "trustRoot",
                    "-k",
                    str(self.login_keychain),
                    str(path),
                )
            )
        finally:
            path.unlink(missing_ok=True)
        if result.returncode != 0:
            raise CertificateTrustError("CERTIFICATE_TRUST_USER_DENIED")
        if not self.inspect_target(target).installed:
            raise CertificateTrustError("CERTIFICATE_TRUST_VERIFY_FAILED")
        return True

    def remove_target(self, target: ManagedTrustTarget) -> bool:
        self._require_platform()
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        expected = normalize_fingerprint(target.fingerprint_sha256)
        hashes = self._hashes(target)
        if expected not in hashes:
            return False
        result = self.runner.run(
            (
                str(_SECURITY),
                "delete-certificate",
                "-Z",
                expected.replace(":", ""),
                "-t",
                str(self.login_keychain),
            )
        )
        if result.returncode != 0:
            raise CertificateTrustError("CERTIFICATE_TRUST_REMOVE_FAILED")
        if expected in self._hashes(target):
            raise CertificateTrustError("CERTIFICATE_TRUST_REMOVE_FAILED")
        return True
