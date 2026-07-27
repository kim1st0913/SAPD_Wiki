from __future__ import annotations

import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.secret_transport import (
    WindowsParentSecretChannel,
    receive_one_shot_secret,
)
from sapd_wiki.local_mcp.path_security import (
    atomic_write_secure,
    ensure_secure_directory,
    windows_fixed_mcp_root,
)


GENERATION = "generation-windows-d2-0001"
PRINCIPAL = "S-1-5-21-111-222-333-1001"
PASSPHRASE = b"windows-d2-secret-sentinel-with-more-than-32-bytes"


@unittest.skipIf(os.name == "nt", "portable injected Windows transport contract")
class WindowsSecretTransportContractTests(unittest.TestCase):
    def test_connected_inherited_endpoint_is_one_shot_and_principal_bound(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-windows-ipc-") as temporary:
            root = Path(temporary)
            certificate = root / "server-chain.pem"
            private_key = root / "server-key.encrypted.pem"
            certificate.write_text("certificate", encoding="utf-8")
            private_key.write_text("encrypted key", encoding="utf-8")
            os.chmod(certificate, 0o600)
            os.chmod(private_key, 0o600)

            channel = WindowsParentSecretChannel(
                principal_source=lambda: PRINCIPAL,
            )
            duplicated_endpoint = os.dup(channel.child_endpoint)
            channel.close_child_copy()
            received: list[bytes] = []

            def fake_child() -> None:
                delivery = receive_one_shot_secret(
                    duplicated_endpoint,
                    channel_kind="windows-handle",
                    principal_source=lambda: PRINCIPAL,
                    parent_pid_source=os.getpid,
                    child_pid_source=os.getpid,
                )
                received.append(bytes(delivery.consume_passphrase()))
                with self.assertRaises(Exception):
                    delivery.consume_passphrase()
                delivery.close()

            worker = threading.Thread(target=fake_child, daemon=True)
            worker.start()
            attestation = channel.deliver(
                child_pid=os.getpid(),
                generation_id=GENERATION,
                certificate_path=certificate,
                encrypted_private_key_path=private_key,
                secret_loader=lambda: PASSPHRASE,
            )
            worker.join(timeout=5)

            self.assertFalse(worker.is_alive())
            self.assertEqual(received, [PASSPHRASE])
            self.assertTrue(attestation.verified)

    def test_wrong_principal_never_releases_secret(self) -> None:
        channel = WindowsParentSecretChannel(
            principal_source=lambda: PRINCIPAL,
        )
        duplicated_endpoint = os.dup(channel.child_endpoint)
        channel.close_child_copy()
        secret_reads = 0

        def fake_child() -> None:
            with self.assertRaises(Exception):
                receive_one_shot_secret(
                    duplicated_endpoint,
                    channel_kind="windows-handle",
                    principal_source=lambda: "S-1-5-21-999-999-999-1001",
                    parent_pid_source=os.getpid,
                    child_pid_source=os.getpid,
                )

        worker = threading.Thread(target=fake_child, daemon=True)
        worker.start()

        def secret_loader() -> bytes:
            nonlocal secret_reads
            secret_reads += 1
            return PASSPHRASE

        with self.assertRaises(Exception):
            channel.deliver(
                child_pid=os.getpid(),
                generation_id=GENERATION,
                certificate_path=Path("/not/read"),
                encrypted_private_key_path=Path("/not/read"),
                secret_loader=secret_loader,
            )
        worker.join(timeout=5)
        self.assertEqual(secret_reads, 0)


@unittest.skipUnless(os.name == "nt", "Windows inherited Pipe handle")
class WindowsRealSecretTransportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = (
            windows_fixed_mcp_root()
            / "NativeSecretTransportTests"
            / secrets.token_hex(10)
        )
        ensure_secure_directory(
            self.root,
            require_fixed_windows_mcp_root=True,
        )
        self.certificate = self.root / "server-chain.pem"
        self.private_key = self.root / "server-key.encrypted.pem"
        atomic_write_secure(self.certificate, b"certificate fixture")
        atomic_write_secure(self.private_key, b"encrypted key fixture")

    def tearDown(self) -> None:
        if self.root.exists():
            shutil.rmtree(self.root)

    def test_real_child_inherits_only_connected_handle_and_consumes_once(
        self,
    ) -> None:
        channel = WindowsParentSecretChannel()
        child_script = (
            "import sys\n"
            "from sapd_wiki.local_mcp.secret_transport import receive_one_shot_secret\n"
            "delivery=receive_one_shot_secret(int(sys.argv[1]), channel_kind='windows-handle')\n"
            "value=delivery.consume_passphrase()\n"
            "assert len(value) >= 32\n"
            "try:\n"
            "    delivery.consume_passphrase()\n"
            "except Exception:\n"
            "    pass\n"
            "else:\n"
            "    raise AssertionError('secret replay accepted')\n"
            "delivery.close()\n"
            "print('windows-pipe-consumed-once')\n"
        )
        command = [
            sys.executable,
            "-c",
            child_script,
            str(channel.child_endpoint),
        ]
        process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            close_fds=True,
            text=True,
            **channel.popen_kwargs(),
        )
        args_text = repr(process.args)
        channel.close_child_copy()
        attestation = channel.deliver(
            child_pid=process.pid,
            generation_id=GENERATION,
            certificate_path=self.certificate,
            encrypted_private_key_path=self.private_key,
            secret_loader=lambda: PASSPHRASE,
        )
        stdout, stderr = process.communicate(timeout=10)
        self.assertEqual(process.returncode, 0, stderr)
        self.assertEqual(stdout.strip(), "windows-pipe-consumed-once")
        self.assertTrue(attestation.verified)
        sentinel = PASSPHRASE.decode("ascii")
        self.assertNotIn(sentinel, args_text)
        self.assertNotIn(sentinel, stdout)
        self.assertNotIn(sentinel, stderr)


if __name__ == "__main__":
    unittest.main()
