from __future__ import annotations

import os
import ssl
import tempfile
import unittest
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import serialization

from sapd_wiki.local_mcp.dev_tls import generate_dev_tls_identity


class DevTlsTests(unittest.TestCase):
    def test_identity_is_loopback_only_encrypted_and_explicitly_trusted(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-mcp-dev-tls-") as raw_root:
            root = Path(raw_root) / "tls"
            identity = generate_dev_tls_identity(root)
            try:
                certificate = x509.load_pem_x509_certificate(identity.certificate_path.read_bytes())
                sans = certificate.extensions.get_extension_for_class(
                    x509.SubjectAlternativeName
                ).value
                self.assertEqual(
                    [str(value) for value in sans.get_values_for_type(x509.IPAddress)],
                    ["127.0.0.1"],
                )
                self.assertEqual(sans.get_values_for_type(x509.DNSName), [])
                key_bytes = identity.encrypted_private_key_path.read_bytes()
                self.assertIn(b"BEGIN ENCRYPTED PRIVATE KEY", key_bytes)
                with self.assertRaises(TypeError):
                    serialization.load_pem_private_key(key_bytes, password=None)
                self.assertIsNotNone(identity.server_context())
                self.assertIsNotNone(identity.client_context())
                for path in (
                    identity.ca_path,
                    identity.certificate_path,
                    identity.encrypted_private_key_path,
                ):
                    self.assertEqual(os.stat(path).st_mode & 0o077, 0)
                self.assertEqual(os.stat(root).st_mode & 0o077, 0)
                default_context = ssl.create_default_context()
                self.assertNotIn(str(identity.ca_path), default_context.get_ca_certs())
            finally:
                identity.close()


if __name__ == "__main__":
    unittest.main()
