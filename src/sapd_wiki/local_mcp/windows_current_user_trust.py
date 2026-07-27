"""Windows CurrentUser Root trust contract and WinCrypt bridge.

The renderer never receives this adapter.  A native/main-process bridge must
enforce ``CurrentUser\\Root`` and reject LocalMachine before executing any
operation.  Tests inject a fake native API; Windows real-store UAT remains a
release gate.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from typing import Callable, Protocol

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.x509.oid import NameOID

from .certificate_trust import (
    CertificateTrustError,
    ManagedTrustTarget,
    TrustInspection,
    TrustSnapshot,
    normalize_fingerprint,
)


@dataclass(frozen=True, slots=True)
class WindowsTrustRecord:
    fingerprint_sha256: str
    display_name: str
    store_location: str
    store_name: str


class WindowsCurrentUserRootBridge(Protocol):
    def list_records(self, *, display_name: str) -> list[WindowsTrustRecord]: ...

    def install_public_ca(self, *, certificate_der: bytes) -> None: ...

    def remove_by_sha256(self, *, fingerprint_sha256: str) -> None: ...


class WindowsCertificateStoreNativeApi(Protocol):
    """Injectable WinCrypt boundary with explicit store arguments."""

    def list_certificates(
        self,
        *,
        store_location: str,
        store_name: str,
    ) -> list[bytes]: ...

    def add_certificate(
        self,
        *,
        store_location: str,
        store_name: str,
        certificate_der: bytes,
    ) -> None: ...

    def remove_by_sha256(
        self,
        *,
        store_location: str,
        store_name: str,
        fingerprint_sha256: str,
    ) -> int: ...


class CtypesWindowsCertificateStoreNativeApi:
    """ctypes WinCrypt access limited to CurrentUser\\Root."""

    _STORE_LOCATION = "CurrentUser"
    _STORE_NAME = "Root"
    _CERT_STORE_PROV_SYSTEM_W = 10
    _CERT_SYSTEM_STORE_CURRENT_USER = 0x00010000
    _CERT_STORE_OPEN_EXISTING_FLAG = 0x00004000
    _CERT_STORE_READONLY_FLAG = 0x00008000
    _CERT_STORE_ADD_NEW = 1
    _X509_ASN_ENCODING = 0x00000001
    _CRYPT_E_NOT_FOUND = 0x80092004

    def __init__(self) -> None:
        if os.name != "nt":
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_BACKEND_UNAVAILABLE"
            )
        try:
            import ctypes
            from ctypes import wintypes

            class CertContext(ctypes.Structure):
                _fields_ = (
                    ("dwCertEncodingType", wintypes.DWORD),
                    ("pbCertEncoded", ctypes.POINTER(ctypes.c_ubyte)),
                    ("cbCertEncoded", wintypes.DWORD),
                    ("pCertInfo", ctypes.c_void_p),
                    ("hCertStore", ctypes.c_void_p),
                )

            cert_context_pointer = ctypes.POINTER(CertContext)
            crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
            crypt32.CertOpenStore.argtypes = (
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.c_void_p,
            )
            crypt32.CertOpenStore.restype = ctypes.c_void_p
            crypt32.CertCloseStore.argtypes = (
                ctypes.c_void_p,
                wintypes.DWORD,
            )
            crypt32.CertCloseStore.restype = wintypes.BOOL
            crypt32.CertEnumCertificatesInStore.argtypes = (
                ctypes.c_void_p,
                cert_context_pointer,
            )
            crypt32.CertEnumCertificatesInStore.restype = cert_context_pointer
            crypt32.CertDuplicateCertificateContext.argtypes = (
                cert_context_pointer,
            )
            crypt32.CertDuplicateCertificateContext.restype = cert_context_pointer
            crypt32.CertDeleteCertificateFromStore.argtypes = (
                cert_context_pointer,
            )
            crypt32.CertDeleteCertificateFromStore.restype = wintypes.BOOL
            crypt32.CertFreeCertificateContext.argtypes = (
                cert_context_pointer,
            )
            crypt32.CertFreeCertificateContext.restype = wintypes.BOOL
            crypt32.CertAddEncodedCertificateToStore.argtypes = (
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.POINTER(ctypes.c_ubyte),
                wintypes.DWORD,
                wintypes.DWORD,
                ctypes.c_void_p,
            )
            crypt32.CertAddEncodedCertificateToStore.restype = wintypes.BOOL
        except (AttributeError, OSError) as exc:
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_BACKEND_UNAVAILABLE"
            ) from exc
        self._ctypes = ctypes
        self._crypt32 = crypt32
        self._CertContextPointer = cert_context_pointer

    @classmethod
    def _require_store(cls, *, store_location: str, store_name: str) -> None:
        if (
            store_location != cls._STORE_LOCATION
            or store_name != cls._STORE_NAME
        ):
            raise CertificateTrustError("CERTIFICATE_TRUST_SCOPE_VIOLATION")

    def _open_store(self, *, read_only: bool):
        flags = (
            self._CERT_SYSTEM_STORE_CURRENT_USER
            | self._CERT_STORE_OPEN_EXISTING_FLAG
        )
        if read_only:
            flags |= self._CERT_STORE_READONLY_FLAG
        store_name = self._ctypes.c_wchar_p(self._STORE_NAME)
        handle = self._crypt32.CertOpenStore(
            self._ctypes.c_void_p(self._CERT_STORE_PROV_SYSTEM_W),
            0,
            None,
            flags,
            self._ctypes.cast(store_name, self._ctypes.c_void_p),
        )
        if not handle:
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_BACKEND_UNAVAILABLE"
            )
        return handle

    def _close_store(self, handle) -> None:
        if not self._crypt32.CertCloseStore(handle, 0):
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_BACKEND_UNAVAILABLE"
            )

    def _enumerate(self, handle):
        previous = self._CertContextPointer()
        try:
            while True:
                context = self._crypt32.CertEnumCertificatesInStore(
                    handle,
                    previous,
                )
                if not context:
                    # WinCrypt has consumed/freed ``previous`` on this call.
                    previous = self._CertContextPointer()
                    error = self._ctypes.get_last_error() & 0xFFFFFFFF
                    if error != self._CRYPT_E_NOT_FOUND:
                        raise CertificateTrustError(
                            "CERTIFICATE_TRUST_BACKEND_UNAVAILABLE"
                        )
                    return
                previous = context
                yield context
        finally:
            # A consumer exception may close the generator before the next
            # enumeration call gets a chance to free the current context.
            if previous:
                self._crypt32.CertFreeCertificateContext(previous)

    def list_certificates(
        self,
        *,
        store_location: str,
        store_name: str,
    ) -> list[bytes]:
        self._require_store(
            store_location=store_location,
            store_name=store_name,
        )
        handle = self._open_store(read_only=True)
        try:
            return [
                self._ctypes.string_at(
                    context.contents.pbCertEncoded,
                    context.contents.cbCertEncoded,
                )
                for context in self._enumerate(handle)
            ]
        finally:
            self._close_store(handle)

    def add_certificate(
        self,
        *,
        store_location: str,
        store_name: str,
        certificate_der: bytes,
    ) -> None:
        self._require_store(
            store_location=store_location,
            store_name=store_name,
        )
        buffer = (self._ctypes.c_ubyte * len(certificate_der)).from_buffer_copy(
            certificate_der
        )
        handle = self._open_store(read_only=False)
        try:
            succeeded = self._crypt32.CertAddEncodedCertificateToStore(
                handle,
                self._X509_ASN_ENCODING,
                buffer,
                len(buffer),
                self._CERT_STORE_ADD_NEW,
                None,
            )
            if not succeeded:
                raise CertificateTrustError(
                    "CERTIFICATE_TRUST_INSTALL_FAILED"
                )
        finally:
            self._close_store(handle)

    def remove_by_sha256(
        self,
        *,
        store_location: str,
        store_name: str,
        fingerprint_sha256: str,
    ) -> int:
        self._require_store(
            store_location=store_location,
            store_name=store_name,
        )
        expected = normalize_fingerprint(fingerprint_sha256)
        handle = self._open_store(read_only=False)
        removed = 0
        try:
            for context in self._enumerate(handle):
                certificate_der = self._ctypes.string_at(
                    context.contents.pbCertEncoded,
                    context.contents.cbCertEncoded,
                )
                digest = sha256(certificate_der).hexdigest().upper()
                actual = ":".join(
                    digest[index : index + 2]
                    for index in range(0, len(digest), 2)
                )
                if actual != expected:
                    continue
                duplicate = self._crypt32.CertDuplicateCertificateContext(
                    context
                )
                if not duplicate:
                    raise CertificateTrustError(
                        "CERTIFICATE_TRUST_REMOVE_FAILED"
                    )
                # CertDeleteCertificateFromStore always frees the duplicate.
                if not self._crypt32.CertDeleteCertificateFromStore(duplicate):
                    raise CertificateTrustError(
                        "CERTIFICATE_TRUST_REMOVE_FAILED"
                    )
                removed += 1
            return removed
        finally:
            self._close_store(handle)


class WindowsWinCryptCurrentUserRootBridge:
    """Production bridge that exposes only CurrentUser\\Root operations."""

    store_location = "CurrentUser"
    store_name = "Root"

    def __init__(
        self,
        *,
        native_api: WindowsCertificateStoreNativeApi | None = None,
    ) -> None:
        self.native_api = native_api or CtypesWindowsCertificateStoreNativeApi()

    @staticmethod
    def _certificate(certificate_der: bytes) -> x509.Certificate:
        try:
            return x509.load_der_x509_certificate(certificate_der)
        except (TypeError, ValueError) as exc:
            raise CertificateTrustError(
                "CERTIFICATE_PUBLIC_DATA_INVALID"
            ) from exc

    def list_records(self, *, display_name: str) -> list[WindowsTrustRecord]:
        if not isinstance(display_name, str) or not 1 <= len(display_name) <= 160:
            raise CertificateTrustError("CERTIFICATE_OWNERSHIP_INVALID")
        records: list[WindowsTrustRecord] = []
        try:
            certificates = self.native_api.list_certificates(
                store_location=self.store_location,
                store_name=self.store_name,
            )
        except CertificateTrustError:
            raise
        except Exception:
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_BACKEND_UNAVAILABLE"
            ) from None
        for certificate_der in certificates:
            certificate = self._certificate(certificate_der)
            common_names = certificate.subject.get_attributes_for_oid(
                NameOID.COMMON_NAME
            )
            if not any(item.value == display_name for item in common_names):
                continue
            digest = certificate.fingerprint(hashes.SHA256()).hex().upper()
            records.append(
                WindowsTrustRecord(
                    fingerprint_sha256=":".join(
                        digest[index : index + 2]
                        for index in range(0, len(digest), 2)
                    ),
                    display_name=display_name,
                    store_location=self.store_location,
                    store_name=self.store_name,
                )
            )
        return records

    def install_public_ca(self, *, certificate_der: bytes) -> None:
        certificate = self._certificate(certificate_der)
        try:
            constraints = certificate.extensions.get_extension_for_class(
                x509.BasicConstraints
            ).value
        except x509.ExtensionNotFound as exc:
            raise CertificateTrustError(
                "CERTIFICATE_PUBLIC_DATA_INVALID"
            ) from exc
        if not constraints.ca or constraints.path_length != 0:
            raise CertificateTrustError("CERTIFICATE_PUBLIC_DATA_INVALID")
        try:
            self.native_api.add_certificate(
                store_location=self.store_location,
                store_name=self.store_name,
                certificate_der=certificate_der,
            )
        except CertificateTrustError:
            raise
        except Exception:
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_INSTALL_FAILED"
            ) from None

    def remove_by_sha256(self, *, fingerprint_sha256: str) -> None:
        expected = normalize_fingerprint(fingerprint_sha256)
        try:
            self.native_api.remove_by_sha256(
                store_location=self.store_location,
                store_name=self.store_name,
                fingerprint_sha256=expected,
            )
        except CertificateTrustError:
            raise
        except Exception:
            raise CertificateTrustError(
                "CERTIFICATE_TRUST_REMOVE_FAILED"
            ) from None


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class WindowsCurrentUserRootTrustAdapter:
    backend = "windows_current_user_root"
    scope = "current_user"
    policy = "ssl_loopback_only"

    def __init__(
        self,
        *,
        bridge: WindowsCurrentUserRootBridge,
        mutation_enabled: bool = False,
        managed_fingerprints: set[str] | Callable[[], set[str]] | None = None,
    ) -> None:
        self.bridge = bridge
        self.mutation_enabled = bool(mutation_enabled)
        self._managed_fingerprints = managed_fingerprints or set()

    def _managed(self) -> set[str]:
        source = (
            self._managed_fingerprints()
            if callable(self._managed_fingerprints)
            else self._managed_fingerprints
        )
        return {normalize_fingerprint(item) for item in source}

    @staticmethod
    def _validate_scope(records: list[WindowsTrustRecord]) -> None:
        for record in records:
            if (
                record.store_location != "CurrentUser"
                or record.store_name != "Root"
            ):
                raise CertificateTrustError("CERTIFICATE_TRUST_SCOPE_VIOLATION")

    def _records(self, target: ManagedTrustTarget) -> list[WindowsTrustRecord]:
        records = self.bridge.list_records(display_name=target.display_name)
        self._validate_scope(records)
        return records

    def inspect_target(self, target: ManagedTrustTarget) -> TrustInspection:
        expected = normalize_fingerprint(target.fingerprint_sha256)
        records = self._records(target)
        fingerprints = [
            normalize_fingerprint(item.fingerprint_sha256) for item in records
        ]
        conflicts = [
            item
            for item in fingerprints
            if item != expected and item not in self._managed()
        ]
        installed = expected in fingerprints and not conflicts
        return TrustInspection(
            installed=installed,
            conflict=bool(conflicts),
            policy_valid=True,
            conflict_count=len(conflicts),
            backend=self.backend,
            scope=self.scope,
            policy=self.policy,
            verified_at=_iso_now() if installed else None,
            reason_code=(
                "CERTIFICATE_TRUST_CONFLICT"
                if conflicts
                else None
                if installed
                else "CERTIFICATE_TRUST_MISSING"
            ),
        )

    def snapshot(self, target: ManagedTrustTarget) -> TrustSnapshot:
        records = self._records(target)
        canonical = sorted(
            (
                normalize_fingerprint(item.fingerprint_sha256),
                item.store_location,
                item.store_name,
            )
            for item in records
        )
        conflicts = [
            fingerprint
            for fingerprint, _, _ in canonical
            if fingerprint != target.fingerprint_sha256
            and fingerprint not in self._managed()
        ]
        return TrustSnapshot(
            backend=self.backend,
            scope=self.scope,
            digest=sha256(repr(canonical).encode("utf-8")).hexdigest(),
            managed_count=sum(
                fingerprint in self._managed()
                for fingerprint, _, _ in canonical
            ),
            conflicting_count=len(conflicts),
            captured_at=_iso_now(),
        )

    def install_target(self, target: ManagedTrustTarget) -> bool:
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        inspection = self.inspect_target(target)
        if inspection.conflict:
            raise CertificateTrustError("CERTIFICATE_TRUST_CONFLICT")
        if inspection.installed:
            return False
        self.bridge.install_public_ca(certificate_der=target.certificate_der)
        if not self.inspect_target(target).installed:
            raise CertificateTrustError("CERTIFICATE_TRUST_VERIFY_FAILED")
        return True

    def remove_target(self, target: ManagedTrustTarget) -> bool:
        if not self.mutation_enabled:
            raise CertificateTrustError("CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED")
        expected = normalize_fingerprint(target.fingerprint_sha256)
        if expected not in {
            normalize_fingerprint(item.fingerprint_sha256)
            for item in self._records(target)
        }:
            return False
        self.bridge.remove_by_sha256(fingerprint_sha256=expected)
        if expected in {
            normalize_fingerprint(item.fingerprint_sha256)
            for item in self._records(target)
        }:
            raise CertificateTrustError("CERTIFICATE_TRUST_REMOVE_FAILED")
        return True
