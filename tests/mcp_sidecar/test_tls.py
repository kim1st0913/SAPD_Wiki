from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sapd_wiki.local_mcp.tls import (
    InMemorySecretProvider,
    KEY_PASSPHRASE_IPC_UNSAFE,
    SecretTransportAttestation,
    TLSIdentityError,
    TrustStore,
    create_server_ssl_context,
    require_safe_secret_transport,
)


class TLSTests(unittest.TestCase):
    def test_in_memory_secret_provider_is_explicit_and_deletable(self) -> None:
        provider = InMemorySecretProvider()
        provider.put_secret("tls-passphrase", b"fixture-secret")
        self.assertEqual(
            provider.get_secret("tls-passphrase"), b"fixture-secret"
        )
        provider.delete_secret("tls-passphrase")
        self.assertIsNone(provider.get_secret("tls-passphrase"))

    def test_unverified_ipc_returns_frozen_error(self) -> None:
        unsafe = SecretTransportAttestation(
            authenticated=True,
            instance_bound=True,
            peer_user_verified=True,
            peer_process_verified=False,
            minimum_acl=True,
        )
        with self.assertRaises(TLSIdentityError) as context:
            require_safe_secret_transport(unsafe)
        self.assertEqual(context.exception.code, KEY_PASSPHRASE_IPC_UNSAFE)

    def test_encrypted_pkcs8_loads_from_provider_without_trust_write(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-mcp-tls-") as raw_root:
            root = Path(raw_root)
            certificate = root / "certificate.pem"
            private_key = root / "private-key.pem"
            certificate.write_text(
                "-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----\n"
            )
            private_key.write_text(
                "-----BEGIN ENCRYPTED PRIVATE KEY-----\n"
                "fixture\n"
                "-----END ENCRYPTED PRIVATE KEY-----\n"
            )
            provider = InMemorySecretProvider()
            provider.put_secret("tls-passphrase", b"fixture-passphrase")
            safe = SecretTransportAttestation(
                authenticated=True,
                instance_bound=True,
                peer_user_verified=True,
                peer_process_verified=True,
                minimum_acl=True,
            )
            with patch(
                "ssl.SSLContext.load_cert_chain", autospec=True
            ) as load_cert_chain:
                context = create_server_ssl_context(
                    certificate_path=certificate,
                    encrypted_private_key_path=private_key,
                    secret_provider=provider,
                    passphrase_reference="tls-passphrase",
                    ipc_attestation=safe,
                )
            self.assertIsNotNone(context)
            load_cert_chain.assert_called_once()
            self.assertEqual(
                load_cert_chain.call_args.kwargs["password"],
                "fixture-passphrase",
            )

    def test_system_trust_writes_are_not_authorized(self) -> None:
        trust = TrustStore()
        with self.assertRaises(TLSIdentityError) as context:
            trust.install("fixture")
        self.assertEqual(context.exception.code, "SYSTEM_TRUST_WRITE_NOT_AUTHORIZED")


if __name__ == "__main__":
    unittest.main()
