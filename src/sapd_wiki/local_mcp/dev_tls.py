"""Short-lived loopback TLS identity for isolated Web development."""

from __future__ import annotations

import ipaddress
import os
import secrets
import ssl
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from .tls import (
    InMemorySecretProvider,
    SecretTransportAttestation,
    create_server_ssl_context,
)


@dataclass
class DevTlsIdentity:
    root: Path
    ca_path: Path
    certificate_path: Path
    encrypted_private_key_path: Path
    secret_provider: InMemorySecretProvider
    passphrase_reference: str

    def server_context(self) -> ssl.SSLContext:
        return create_server_ssl_context(
            certificate_path=self.certificate_path,
            encrypted_private_key_path=self.encrypted_private_key_path,
            secret_provider=self.secret_provider,
            passphrase_reference=self.passphrase_reference,
            ipc_attestation=SecretTransportAttestation(
                authenticated=True,
                instance_bound=True,
                peer_user_verified=True,
                peer_process_verified=True,
                minimum_acl=True,
            ),
        )

    def client_context(self) -> ssl.SSLContext:
        context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH, cafile=self.ca_path)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.check_hostname = True
        return context

    def close(self) -> None:
        self.secret_provider.delete_secret(self.passphrase_reference)


def _name(common_name: str) -> x509.Name:
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])


def generate_dev_tls_identity(root: Path) -> DevTlsIdentity:
    candidate = Path(root)
    if not candidate.is_absolute() or candidate.is_symlink():
        raise ValueError("TLS root must be an explicit absolute non-symlink path")
    candidate.mkdir(mode=0o700, parents=True, exist_ok=True)
    resolved = candidate.resolve(strict=True)
    if any(resolved.iterdir()):
        raise ValueError("TLS root must be empty")
    os.chmod(resolved, 0o700)

    now = datetime.now(UTC)
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_subject = _name("SAPD Wiki Web Dev CA")
    ca_certificate = (
        x509.CertificateBuilder()
        .subject_name(ca_subject)
        .issuer_name(ca_subject)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(hours=4))
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
                digital_signature=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=None,
                decipher_only=None,
            ),
            critical=True,
        )
        .sign(ca_key, hashes.SHA256())
    )

    server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    server_certificate = (
        x509.CertificateBuilder()
        .subject_name(_name("127.0.0.1"))
        .issuer_name(ca_subject)
        .public_key(server_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(hours=2))
        .add_extension(
            x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]),
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
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .sign(ca_key, hashes.SHA256())
    )

    passphrase = secrets.token_urlsafe(32).encode("ascii")
    passphrase_reference = f"dev-tls-{secrets.token_urlsafe(18)}"
    provider = InMemorySecretProvider()
    provider.put_secret(passphrase_reference, passphrase)
    ca_path = resolved / "dev-ca.pem"
    certificate_path = resolved / "dev-server-cert.pem"
    encrypted_key_path = resolved / "dev-server-key.encrypted.pem"
    ca_path.write_bytes(ca_certificate.public_bytes(serialization.Encoding.PEM))
    certificate_path.write_bytes(server_certificate.public_bytes(serialization.Encoding.PEM))
    encrypted_key_path.write_bytes(
        server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.BestAvailableEncryption(passphrase),
        )
    )
    for path in (ca_path, certificate_path, encrypted_key_path):
        os.chmod(path, 0o600)
    return DevTlsIdentity(
        root=resolved,
        ca_path=ca_path,
        certificate_path=certificate_path,
        encrypted_private_key_path=encrypted_key_path,
        secret_provider=provider,
        passphrase_reference=passphrase_reference,
    )
