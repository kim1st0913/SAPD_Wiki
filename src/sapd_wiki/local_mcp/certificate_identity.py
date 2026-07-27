"""Stable, App-owned loopback certificate identity primitives.

This module deliberately stops before platform secret and trust integration.
C0-A callers must inject a secret provider and may only use isolated roots.
"""

from __future__ import annotations

import ipaddress
import json
import re
import secrets
import shutil
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from typing import Any, Callable

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from .tls import SecretProvider
from .certificate_trust import ManagedTrustTarget, target_from_pem
from .path_security import (
    PathSecurityError,
    assert_secure_regular_file,
    atomic_write_secure,
    ensure_secure_directory,
)


MANIFEST_SCHEMA_VERSION = 1
CA_VALIDITY_DAYS = 400
SERVER_VALIDITY_DAYS = 365
CERTIFICATE_SUBJECT = "127.0.0.1"
_PROFILE_RE = re.compile(r"^[a-z][a-z0-9-]{1,31}$")
_GENERATION_RE = re.compile(r"^[A-Za-z0-9_-]{16,96}$")
_MANIFEST_KEYS = frozenset(
    {
        "schema_version",
        "install_id",
        "profile",
        "generation_id",
        "ca_display_name",
        "ca_relative_path",
        "server_chain_relative_path",
        "server_key_relative_path",
        "passphrase_reference",
        "ca_fingerprint_sha256",
        "server_fingerprint_sha256",
        "subject",
        "san",
        "valid_from",
        "valid_until",
        "created_at",
    }
)


class CertificateIdentityError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True, slots=True)
class CertificateIdentityManifest:
    schema_version: int
    install_id: str
    profile: str
    generation_id: str
    ca_display_name: str
    ca_relative_path: str
    server_chain_relative_path: str
    server_key_relative_path: str
    passphrase_reference: str
    ca_fingerprint_sha256: str
    server_fingerprint_sha256: str
    subject: str
    san: list[str]
    valid_from: str
    valid_until: str
    created_at: str


@dataclass(frozen=True, slots=True)
class CertificateIdentityFiles:
    ca_path: Path
    server_chain_path: Path
    encrypted_private_key_path: Path


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _parse_iso(value: str) -> datetime:
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID") from exc
    if result.tzinfo is None:
        raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID")
    return result.astimezone(UTC)


def _fingerprint(certificate: x509.Certificate) -> str:
    digest = certificate.fingerprint(hashes.SHA256()).hex().upper()
    return ":".join(digest[index : index + 2] for index in range(0, len(digest), 2))


def _name(common_name: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])


def _ensure_secure_directory(path: Path) -> Path:
    try:
        return ensure_secure_directory(path)
    except (OSError, PathSecurityError) as exc:
        raise CertificateIdentityError("IDENTITY_ROOT_UNSAFE") from exc


def _assert_secure_regular_file(path: Path) -> None:
    try:
        assert_secure_regular_file(path)
    except PathSecurityError as exc:
        if exc.code == "PATH_FILE_MISSING":
            raise CertificateIdentityError("IDENTITY_FILE_MISSING") from exc
        raise CertificateIdentityError("IDENTITY_FILE_UNSAFE")


def _atomic_write(path: Path, payload: bytes) -> None:
    try:
        atomic_write_secure(path, payload)
    except (OSError, PathSecurityError) as exc:
        raise CertificateIdentityError("IDENTITY_FILE_UNSAFE") from exc


class CertificateIdentityStore:
    """Generate and reload one stable identity per install/profile root."""

    def __init__(
        self,
        root: Path,
        *,
        secret_provider: SecretProvider,
        profile: str = "dev",
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        if not _PROFILE_RE.fullmatch(profile):
            raise ValueError("profile must be a lowercase stable identifier")
        secured_root = _ensure_secure_directory(root)
        try:
            self.root = secured_root.resolve(strict=True)
        except OSError as exc:
            raise CertificateIdentityError("IDENTITY_ROOT_UNSAFE") from exc
        self.secret_provider = secret_provider
        self.profile = profile
        self._clock = clock
        self.manifest_path = self.root / "active-manifest.json"
        self.generations_root = _ensure_secure_directory(self.root / "generations")

    def _resolve_relative(self, relative_value: str) -> Path:
        relative = Path(relative_value)
        if relative.is_absolute() or ".." in relative.parts:
            raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID")
        resolved = (self.root / relative).resolve(strict=False)
        try:
            resolved.relative_to(self.root)
        except ValueError as exc:
            raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID") from exc
        return resolved

    def load_manifest(self) -> CertificateIdentityManifest | None:
        if self.manifest_path.is_symlink():
            raise CertificateIdentityError("IDENTITY_FILE_UNSAFE")
        if not self.manifest_path.exists():
            return None
        return self._load_manifest_path(self.manifest_path)

    def _load_manifest_path(self, path: Path) -> CertificateIdentityManifest:
        _assert_secure_regular_file(path)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID") from exc
        if not isinstance(raw, dict) or set(raw) != _MANIFEST_KEYS:
            raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID")
        if raw.get("schema_version") != MANIFEST_SCHEMA_VERSION:
            raise CertificateIdentityError("IDENTITY_SCHEMA_UNSUPPORTED")
        if raw.get("profile") != self.profile:
            raise CertificateIdentityError("IDENTITY_PROFILE_MISMATCH")
        if not isinstance(raw.get("install_id"), str) or len(raw["install_id"]) < 16:
            raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID")
        if not isinstance(raw.get("generation_id"), str) or not _GENERATION_RE.fullmatch(
            raw["generation_id"]
        ):
            raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID")
        if raw.get("subject") != CERTIFICATE_SUBJECT or raw.get("san") != [CERTIFICATE_SUBJECT]:
            raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID")
        for field in (
            "ca_display_name",
            "passphrase_reference",
            "ca_fingerprint_sha256",
            "server_fingerprint_sha256",
            "valid_from",
            "valid_until",
            "created_at",
        ):
            if not isinstance(raw.get(field), str) or not raw[field]:
                raise CertificateIdentityError("IDENTITY_MANIFEST_INVALID")
        _parse_iso(raw["valid_from"])
        _parse_iso(raw["valid_until"])
        _parse_iso(raw["created_at"])
        for field in (
            "ca_relative_path",
            "server_chain_relative_path",
            "server_key_relative_path",
        ):
            path = self._resolve_relative(raw[field])
            expected_generation = self.generations_root / raw["generation_id"]
            try:
                path.relative_to(expected_generation)
            except ValueError as exc:
                raise CertificateIdentityError("IDENTITY_GENERATION_MISMATCH") from exc
            _assert_secure_regular_file(path)
        return CertificateIdentityManifest(**raw)

    def generation_manifest_path(self, generation_id: str) -> Path:
        if not isinstance(generation_id, str) or not _GENERATION_RE.fullmatch(
            generation_id
        ):
            raise CertificateIdentityError("IDENTITY_GENERATION_INVALID")
        return self.generations_root / generation_id / "manifest.json"

    def load_generation_manifest(
        self,
        generation_id: str,
    ) -> CertificateIdentityManifest:
        path = self.generation_manifest_path(generation_id)
        try:
            return self._load_manifest_path(path)
        except CertificateIdentityError as exc:
            if exc.code == "IDENTITY_FILE_MISSING":
                raise CertificateIdentityError("IDENTITY_GENERATION_MISSING") from exc
            raise

    def list_generation_manifests(self) -> list[CertificateIdentityManifest]:
        manifests: list[CertificateIdentityManifest] = []
        for path in sorted(self.generations_root.iterdir(), key=lambda item: item.name):
            if not path.is_dir() or not _GENERATION_RE.fullmatch(path.name):
                raise CertificateIdentityError("IDENTITY_GENERATION_INVALID")
            manifests.append(self.load_generation_manifest(path.name))
        return manifests

    def remove_empty_generation_directories(self) -> list[str]:
        """Remove interrupted pre-manifest generations while the writer lock is held.

        A non-empty generation without a valid manifest remains a hard error.  It
        may contain material needed for recovery and must never be silently
        discarded.  Empty directories cannot contain a certificate, key,
        manifest, or secret reference and are safe to remove before a new
        transaction starts.
        """

        active = self.load_manifest()
        active_generation_id = active.generation_id if active is not None else None
        removed: list[str] = []
        for path in sorted(self.generations_root.iterdir(), key=lambda item: item.name):
            if (
                path.is_symlink()
                or not path.is_dir()
                or not _GENERATION_RE.fullmatch(path.name)
            ):
                raise CertificateIdentityError("IDENTITY_GENERATION_INVALID")
            if path.name == active_generation_id:
                continue
            try:
                next(path.iterdir())
            except StopIteration:
                path.rmdir()
                removed.append(path.name)
            except OSError as exc:
                raise CertificateIdentityError("IDENTITY_GENERATION_INVALID") from exc
            else:
                self.load_generation_manifest(path.name)
        return removed

    def active_identity_files(
        self,
        manifest: CertificateIdentityManifest | None = None,
    ) -> CertificateIdentityFiles:
        active = self.load_manifest()
        if active is None:
            raise CertificateIdentityError("IDENTITY_NOT_CONFIGURED")
        if manifest is not None and (
            manifest.install_id != active.install_id
            or manifest.profile != active.profile
            or manifest.generation_id != active.generation_id
        ):
            raise CertificateIdentityError("IDENTITY_GENERATION_MISMATCH")
        return CertificateIdentityFiles(
            ca_path=self._resolve_relative(active.ca_relative_path),
            server_chain_path=self._resolve_relative(
                active.server_chain_relative_path
            ),
            encrypted_private_key_path=self._resolve_relative(
                active.server_key_relative_path
            ),
        )

    def generation_identity_files(
        self,
        manifest: CertificateIdentityManifest,
    ) -> CertificateIdentityFiles:
        stored = self.load_generation_manifest(manifest.generation_id)
        if (
            stored.install_id != manifest.install_id
            or stored.profile != manifest.profile
            or stored.generation_id != manifest.generation_id
        ):
            raise CertificateIdentityError("IDENTITY_GENERATION_MISMATCH")
        return CertificateIdentityFiles(
            ca_path=self._resolve_relative(stored.ca_relative_path),
            server_chain_path=self._resolve_relative(
                stored.server_chain_relative_path
            ),
            encrypted_private_key_path=self._resolve_relative(
                stored.server_key_relative_path
            ),
        )

    def trust_target(
        self,
        manifest: CertificateIdentityManifest,
    ) -> ManagedTrustTarget:
        files = self.generation_identity_files(manifest)
        _assert_secure_regular_file(files.ca_path)
        _assert_secure_regular_file(files.server_chain_path)
        return target_from_pem(
            install_id=manifest.install_id,
            profile=manifest.profile,
            generation_id=manifest.generation_id,
            display_name=manifest.ca_display_name,
            fingerprint_sha256=manifest.ca_fingerprint_sha256,
            certificate_pem=files.ca_path.read_bytes(),
            verification_certificate_pem=files.server_chain_path.read_bytes(),
        )

    def stage_generation(
        self,
        *,
        install_id: str | None = None,
        include_loopback_name_constraints: bool = False,
    ) -> CertificateIdentityManifest:
        current = self.load_manifest()
        stable_install_id = current.install_id if current is not None else install_id
        if (
            current is not None
            and install_id is not None
            and install_id != current.install_id
        ):
            raise CertificateIdentityError("IDENTITY_INSTALL_MISMATCH")
        if stable_install_id is None:
            stable_install_id = secrets.token_urlsafe(24)
        if not isinstance(stable_install_id, str) or len(stable_install_id) < 16:
            raise ValueError("install_id must be a stable opaque identifier")

        generation_id = secrets.token_urlsafe(24)
        generation_root = self.generations_root / generation_id
        _ensure_secure_directory(generation_root)
        created_at = self._clock().astimezone(UTC)
        not_before = created_at - timedelta(minutes=5)
        ca_not_after = created_at + timedelta(days=CA_VALIDITY_DAYS)
        server_not_after = created_at + timedelta(days=SERVER_VALIDITY_DAYS)
        suffix = sha256(stable_install_id.encode("utf-8")).hexdigest()[-8:].upper()
        ca_display_name = f"SAPD Wiki Local {self.profile.title()} CA {suffix}"

        ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        ca_subject = _name(ca_display_name)
        ca_builder = (
            x509.CertificateBuilder()
            .subject_name(ca_subject)
            .issuer_name(ca_subject)
            .public_key(ca_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(not_before)
            .not_valid_after(ca_not_after)
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=False,
                    content_commitment=False,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=True,
                    crl_sign=False,
                    encipher_only=None,
                    decipher_only=None,
                ),
                critical=True,
            )
        )
        if include_loopback_name_constraints:
            ca_builder = ca_builder.add_extension(
                x509.NameConstraints(
                    permitted_subtrees=[
                        x509.IPAddress(ipaddress.ip_network("127.0.0.1/32"))
                    ],
                    excluded_subtrees=None,
                ),
                critical=True,
            )
        ca_certificate = ca_builder.sign(ca_key, hashes.SHA256())

        server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        server_certificate = (
            x509.CertificateBuilder()
            .subject_name(_name(CERTIFICATE_SUBJECT))
            .issuer_name(ca_subject)
            .public_key(server_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(not_before)
            .not_valid_after(server_not_after)
            .add_extension(
                x509.SubjectAlternativeName(
                    [x509.IPAddress(ipaddress.ip_address(CERTIFICATE_SUBJECT))]
                ),
                critical=False,
            )
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(server_key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=False,
                    key_encipherment=True,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=False,
                    crl_sign=False,
                    encipher_only=None,
                    decipher_only=None,
                ),
                critical=True,
            )
            .add_extension(
                x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),
                critical=False,
            )
            .sign(ca_key, hashes.SHA256())
        )

        passphrase = secrets.token_urlsafe(36).encode("ascii")
        install_binding = sha256(stable_install_id.encode("utf-8")).hexdigest()
        passphrase_reference = (
            f"sapd-wiki-mcp:{install_binding}:{self.profile}:"
            f"{generation_id}:server-key"
        )
        self.secret_provider.put_secret(passphrase_reference, passphrase)
        ca_relative = f"generations/{generation_id}/ca.pem"
        chain_relative = f"generations/{generation_id}/server-chain.pem"
        key_relative = f"generations/{generation_id}/server-key.encrypted.pem"
        try:
            _atomic_write(
                self._resolve_relative(ca_relative),
                ca_certificate.public_bytes(serialization.Encoding.PEM),
            )
            _atomic_write(
                self._resolve_relative(chain_relative),
                server_certificate.public_bytes(serialization.Encoding.PEM),
            )
            _atomic_write(
                self._resolve_relative(key_relative),
                server_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.BestAvailableEncryption(passphrase),
                ),
            )
            manifest = CertificateIdentityManifest(
                schema_version=MANIFEST_SCHEMA_VERSION,
                install_id=stable_install_id,
                profile=self.profile,
                generation_id=generation_id,
                ca_display_name=ca_display_name,
                ca_relative_path=ca_relative,
                server_chain_relative_path=chain_relative,
                server_key_relative_path=key_relative,
                passphrase_reference=passphrase_reference,
                ca_fingerprint_sha256=_fingerprint(ca_certificate),
                server_fingerprint_sha256=_fingerprint(server_certificate),
                subject=CERTIFICATE_SUBJECT,
                san=[CERTIFICATE_SUBJECT],
                valid_from=_iso(not_before),
                valid_until=_iso(server_not_after),
                created_at=_iso(created_at),
            )
            _atomic_write(
                self.generation_manifest_path(generation_id),
                json.dumps(
                    asdict(manifest),
                    ensure_ascii=True,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8"),
            )
        except Exception:
            self.secret_provider.delete_secret(passphrase_reference)
            shutil.rmtree(generation_root, ignore_errors=True)
            raise
        return manifest

    def activate_generation(
        self,
        manifest: CertificateIdentityManifest,
    ) -> CertificateIdentityManifest:
        stored = self.load_generation_manifest(manifest.generation_id)
        if stored != manifest:
            raise CertificateIdentityError("IDENTITY_GENERATION_MISMATCH")
        self.generation_identity_files(stored)
        _atomic_write(
            self.manifest_path,
            json.dumps(
                asdict(stored),
                ensure_ascii=True,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8"),
        )
        return stored

    def clear_active_generation(self, generation_id: str) -> bool:
        current = self.load_manifest()
        if current is None or current.generation_id != generation_id:
            return False
        self.manifest_path.unlink()
        return True

    def remove_generation(
        self,
        generation_id: str,
        *,
        allow_active: bool = False,
    ) -> bool:
        current = self.load_manifest()
        if (
            current is not None
            and current.generation_id == generation_id
            and not allow_active
        ):
            raise CertificateIdentityError("IDENTITY_ACTIVE_DELETE_BLOCKED")
        try:
            manifest = self.load_generation_manifest(generation_id)
        except CertificateIdentityError as exc:
            if exc.code == "IDENTITY_GENERATION_MISSING":
                return False
            raise
        if current is not None and current.generation_id == generation_id:
            self.clear_active_generation(generation_id)
        self.secret_provider.delete_secret(manifest.passphrase_reference)
        shutil.rmtree(self.generations_root / generation_id)
        return True

    def provision(
        self,
        *,
        rotate: bool = False,
        install_id: str | None = None,
        include_loopback_name_constraints: bool = False,
    ) -> CertificateIdentityManifest:
        """Compatibility helper for non-transactional isolated callers.

        Product mutations use ``stage_generation`` and ``activate_generation``.
        """

        current = self.load_manifest()
        if current is not None and not rotate:
            return current
        staged = self.stage_generation(
            install_id=install_id,
            include_loopback_name_constraints=include_loopback_name_constraints,
        )
        activated = self.activate_generation(staged)
        if current is not None:
            self.remove_generation(current.generation_id)
        return activated

    def remove(self) -> bool:
        current = self.load_manifest()
        generation_ids = [
            path.name
            for path in self.generations_root.iterdir()
            if path.is_dir() and _GENERATION_RE.fullmatch(path.name)
        ]
        if current is None and not generation_ids:
            return False
        try:
            self.manifest_path.unlink()
        except FileNotFoundError:
            pass
        for generation_id in generation_ids:
            try:
                manifest = self.load_generation_manifest(generation_id)
            except CertificateIdentityError:
                continue
            self.secret_provider.delete_secret(manifest.passphrase_reference)
        shutil.rmtree(self.generations_root)
        self.generations_root = _ensure_secure_directory(self.generations_root)
        return True

    def public_state(
        self,
        *,
        trust_installed: bool,
        trust_conflict: bool = False,
        trust_backend: str = "fake_current_user_trust",
        secret_backend: str | None = None,
        trust_policy: str = "ssl_loopback_only",
        trust_verified_at: str | None = None,
        operation: dict[str, Any] | None = None,
        cleanup_pending: bool = False,
        client_restart_required: bool = False,
        old_generation_retained_until: str | None = None,
        forced_state: str | None = None,
        forced_reason_code: str | None = None,
        forced_next_action: str | None = None,
    ) -> dict[str, Any]:
        try:
            manifest = self.load_manifest()
        except CertificateIdentityError as exc:
            return empty_certificate_state(
                profile=self.profile,
                state=forced_state or "recovery_required",
                reason_code=forced_reason_code or exc.code,
                next_action=forced_next_action or "certificate_reset",
                trust_backend=trust_backend,
                secret_backend=secret_backend
                or str(
                    getattr(
                        self.secret_provider,
                        "backend",
                        "in_memory_test_only",
                    )
                ),
                trust_policy=trust_policy,
                operation=operation,
                cleanup_pending=cleanup_pending,
                client_restart_required=client_restart_required,
                old_generation_retained_until=old_generation_retained_until,
            )
        if manifest is None:
            return empty_certificate_state(
                profile=self.profile,
                state=forced_state or "not_configured",
                reason_code=forced_reason_code,
                next_action=(
                    forced_next_action
                    if forced_state is not None
                    else "certificate_provision"
                ),
                trust_backend=trust_backend,
                secret_backend=secret_backend
                or str(
                    getattr(
                        self.secret_provider,
                        "backend",
                        "in_memory_test_only",
                    )
                ),
                trust_policy=trust_policy,
                operation=operation,
                cleanup_pending=cleanup_pending,
                client_restart_required=client_restart_required,
                old_generation_retained_until=old_generation_retained_until,
            )
        now = self._clock().astimezone(UTC)
        valid_from = _parse_iso(manifest.valid_from)
        valid_until = _parse_iso(manifest.valid_until)
        remaining_days = max(0, (valid_until.date() - now.date()).days)
        if forced_state is not None:
            state, reason, next_action = (
                forced_state,
                forced_reason_code,
                forced_next_action,
            )
        elif now < valid_from:
            state, reason, next_action = (
                "clock_invalid",
                "CERTIFICATE_NOT_YET_VALID",
                "certificate_view_details",
            )
        elif now >= valid_until:
            state, reason, next_action = (
                "expired",
                "CERTIFICATE_EXPIRED",
                "certificate_rotate",
            )
        elif trust_conflict:
            state, reason, next_action = (
                "trust_conflict",
                "CERTIFICATE_TRUST_CONFLICT",
                "certificate_view_details",
            )
        elif not trust_installed:
            state, reason, next_action = (
                "trust_missing",
                "CERTIFICATE_TRUST_MISSING",
                "certificate_repair_trust",
            )
        else:
            state, reason, next_action = "valid", None, None
            try:
                secret_available = (
                    self.secret_provider.get_secret(
                        manifest.passphrase_reference
                    )
                    is not None
                )
            except Exception:
                secret_available = False
        if (
            forced_state is None
            and now >= valid_from
            and now < valid_until
            and not trust_conflict
            and trust_installed
            and not secret_available
        ):
            state, reason, next_action = (
                "key_unavailable",
                "CERTIFICATE_KEY_UNAVAILABLE",
                "certificate_reset",
            )
        elif forced_state is None and state == "valid" and remaining_days <= 7:
            state, reason, next_action = (
                "renewal_required",
                "CERTIFICATE_RENEWAL_REQUIRED",
                "certificate_rotate",
            )
        elif forced_state is None and state == "valid" and remaining_days <= 30:
            state, reason, next_action = (
                "expiring",
                "CERTIFICATE_EXPIRING",
                "certificate_rotate",
            )
        elif forced_state is None and state == "valid":
            state, reason, next_action = (
                "valid",
                None,
                "certificate_rotate" if remaining_days <= 60 else None,
            )
        resolved_secret_backend = (
            secret_backend
            or str(getattr(self.secret_provider, "backend", "in_memory_test_only"))
        )
        return {
            "schema_version": MANIFEST_SCHEMA_VERSION,
            "state": state,
            "reason_code": reason,
            "managed_by_app": True,
            "profile": manifest.profile,
            "install_id_suffix": sha256(
                manifest.install_id.encode("utf-8")
            ).hexdigest()[-8:].upper(),
            "generation_id": manifest.generation_id,
            "subject": manifest.subject,
            "san": list(manifest.san),
            "ca_display_name": manifest.ca_display_name,
            "ca_fingerprint_sha256": manifest.ca_fingerprint_sha256,
            "server_fingerprint_sha256": manifest.server_fingerprint_sha256,
            "valid_from": manifest.valid_from,
            "valid_until": manifest.valid_until,
            "remaining_days": remaining_days,
            "trust_scope": "current_user",
            "trust_backend": trust_backend,
            "secret_backend": resolved_secret_backend,
            "trust_policy": trust_policy,
            "trust_verified_at": (
                trust_verified_at
                if trust_installed and not trust_conflict
                else None
            ),
            "last_rotated_at": manifest.created_at,
            "operation": operation,
            "cleanup_pending": cleanup_pending,
            "client_restart_required": client_restart_required,
            "old_generation_retained_until": old_generation_retained_until,
            "next_action": next_action,
        }


def empty_certificate_state(
    *,
    profile: str,
    state: str,
    reason_code: str | None,
    next_action: str | None,
    trust_backend: str = "fake_current_user_trust",
    secret_backend: str = "in_memory_test_only",
    trust_policy: str = "ssl_loopback_only",
    operation: dict[str, Any] | None = None,
    cleanup_pending: bool = False,
    client_restart_required: bool = False,
    old_generation_retained_until: str | None = None,
) -> dict[str, Any]:
    return {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "state": state,
        "reason_code": reason_code,
        "managed_by_app": True,
        "profile": profile,
        "install_id_suffix": None,
        "generation_id": None,
        "subject": CERTIFICATE_SUBJECT,
        "san": [CERTIFICATE_SUBJECT],
        "ca_display_name": None,
        "ca_fingerprint_sha256": None,
        "server_fingerprint_sha256": None,
        "valid_from": None,
        "valid_until": None,
        "remaining_days": None,
        "trust_scope": "current_user",
        "trust_backend": trust_backend,
        "secret_backend": secret_backend,
        "trust_policy": trust_policy,
        "trust_verified_at": None,
        "last_rotated_at": None,
        "operation": operation,
        "cleanup_pending": cleanup_pending,
        "client_restart_required": client_restart_required,
        "old_generation_retained_until": old_generation_retained_until,
        "next_action": next_action,
    }
