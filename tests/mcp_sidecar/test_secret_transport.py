from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.secret_transport import (
    MAX_FRAME_BYTES,
    PROTOCOL_VERSION,
    ParentSecretChannel,
    _recv_frame,
    _send_frame,
    receive_one_shot_secret,
)
from sapd_wiki.local_mcp.tls import (
    KEY_PASSPHRASE_IPC_UNSAFE,
    TLSIdentityError,
)


GENERATION = "generation-c0b-test-0001"
PASSPHRASE = b"C0B-secret-sentinel-that-must-never-appear-in-process-metadata"


class OneShotSecretTransportTests(unittest.TestCase):
    def setUp(self) -> None:
        if os.name != "posix":
            self.skipTest("C0-B Web channel is POSIX fake-first")
        self.temporary = tempfile.TemporaryDirectory(prefix="sapd-mcp-c0b-")
        self.root = Path(self.temporary.name)
        self.certificate = self.root / "server-chain.pem"
        self.private_key = self.root / "server-key.encrypted.pem"
        self.certificate.write_text("certificate fixture", encoding="utf-8")
        self.private_key.write_text(
            "-----BEGIN ENCRYPTED PRIVATE KEY-----\nfixture\n",
            encoding="utf-8",
        )
        os.chmod(self.certificate, 0o600)
        os.chmod(self.private_key, 0o600)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_real_spawned_child_consumes_once_without_metadata_leak(self) -> None:
        channel = ParentSecretChannel()
        child_script = (
            "import sys\n"
            "from sapd_wiki.local_mcp.secret_transport import receive_one_shot_secret\n"
            "from sapd_wiki.local_mcp.tls import TLSIdentityError, KEY_PASSPHRASE_IPC_UNSAFE\n"
            "delivery=receive_one_shot_secret(int(sys.argv[1]))\n"
            "value=delivery.consume_passphrase()\n"
            "assert len(value) >= 32\n"
            "try:\n"
            "    delivery.consume_passphrase()\n"
            "except TLSIdentityError as exc:\n"
            "    assert exc.code == KEY_PASSPHRASE_IPC_UNSAFE\n"
            "else:\n"
            "    raise AssertionError('replay accepted')\n"
            "delivery.close()\n"
            "print('consumed-once')\n"
        )
        process = subprocess.Popen(
            [sys.executable, "-c", child_script, str(channel.child_fd)],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            close_fds=True,
            pass_fds=(channel.child_fd,),
            text=True,
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
        stdout, stderr = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 0, stderr)
        self.assertEqual(stdout.strip(), "consumed-once")
        self.assertTrue(attestation.verified)
        sentinel = PASSPHRASE.decode("ascii")
        self.assertNotIn(sentinel, args_text)
        self.assertNotIn(sentinel, stdout)
        self.assertNotIn(sentinel, stderr)
        self.assertNotIn(str(self.private_key), args_text)

    def _assert_tampered_hello_is_blocked(self, field: str) -> None:
        channel = ParentSecretChannel(nonce_source=lambda _size: b"N" * 32)
        child_socket = socket.socket(fileno=os.dup(channel.child_fd))
        channel.close_child_copy()
        secret_reads = 0

        def fake_child() -> None:
            challenge = _recv_frame(child_socket)
            hello = {
                "message_type": "hello",
                "protocol_version": PROTOCOL_VERSION,
                "nonce": challenge["nonce"],
                "generation_id": challenge["generation_id"],
                "parent_pid": challenge["parent_pid"],
                "child_pid": os.getpid(),
                "child_uid": os.getuid(),
            }
            if field == "nonce":
                hello[field] = "tampered-nonce-c0b"
            elif field == "generation_id":
                hello[field] = "generation-c0b-wrong-0002"
            else:
                hello[field] = int(hello[field]) + 1
            try:
                _send_frame(child_socket, hello)
            finally:
                child_socket.close()

        thread = threading.Thread(target=fake_child, daemon=True)
        thread.start()

        def secret_loader() -> bytes:
            nonlocal secret_reads
            secret_reads += 1
            return PASSPHRASE

        with self.assertRaises(TLSIdentityError) as raised:
            channel.deliver(
                child_pid=os.getpid(),
                generation_id=GENERATION,
                certificate_path=self.certificate,
                encrypted_private_key_path=self.private_key,
                secret_loader=secret_loader,
            )
        thread.join(timeout=2)
        self.assertEqual(raised.exception.code, KEY_PASSPHRASE_IPC_UNSAFE)
        self.assertEqual(secret_reads, 0)

    def test_wrong_process_is_blocked_before_secret_release(self) -> None:
        self._assert_tampered_hello_is_blocked("child_pid")

    def test_wrong_user_is_blocked_before_secret_release(self) -> None:
        self._assert_tampered_hello_is_blocked("child_uid")

    def test_wrong_generation_is_blocked_before_secret_release(self) -> None:
        self._assert_tampered_hello_is_blocked("generation_id")

    def test_wrong_nonce_is_blocked_before_secret_release(self) -> None:
        self._assert_tampered_hello_is_blocked("nonce")

    def test_regular_file_endpoint_is_never_accepted(self) -> None:
        endpoint = self.root / "named-or-wide-endpoint"
        endpoint.write_bytes(b"fixture")
        os.chmod(endpoint, 0o666)
        descriptor = os.open(endpoint, os.O_RDONLY)
        try:
            with self.assertRaises(TLSIdentityError) as raised:
                receive_one_shot_secret(descriptor)
            self.assertEqual(raised.exception.code, KEY_PASSPHRASE_IPC_UNSAFE)
        finally:
            try:
                os.close(descriptor)
            except OSError:
                pass

    def test_oversized_frame_is_blocked(self) -> None:
        parent, child = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)
        descriptor = child.detach()
        try:
            parent.sendall((MAX_FRAME_BYTES + 1).to_bytes(4, "big"))
            with self.assertRaises(TLSIdentityError) as raised:
                receive_one_shot_secret(descriptor)
            self.assertEqual(raised.exception.code, KEY_PASSPHRASE_IPC_UNSAFE)
        finally:
            parent.close()


if __name__ == "__main__":
    unittest.main()
