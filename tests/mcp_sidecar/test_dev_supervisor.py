from __future__ import annotations

import http.client
import os
import socket
import ssl
import tempfile
import time
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from sapd_wiki.local_mcp.control_models import GatewayActionError
from sapd_wiki.local_mcp.certificate_trust import FakeCurrentUserTrustAdapter
from sapd_wiki.local_mcp.dev_supervisor import DevSidecarSupervisor
from sapd_wiki.local_mcp.secret_transport import ParentSecretChannel
from sapd_wiki.local_mcp.tls import (
    InMemorySecretProvider,
    KEY_PASSPHRASE_IPC_UNSAFE,
    TLSIdentityError,
)


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
        candidate.bind(("127.0.0.1", 0))
        return int(candidate.getsockname()[1])


def provision_certificate(supervisor: DevSidecarSupervisor) -> dict:
    prepared = supervisor.prepare_certificate_action(
        action="certificate_provision",
        request_id="request-certificate-test-prepare",
        expected_state_version=supervisor.read_snapshot()["state_version"],
    )
    supervisor.confirm_certificate_action(
        confirmation_id=prepared["confirmation_id"],
        request_id="request-certificate-test-confirm",
        expected_state_version=prepared["state_version"],
    )
    return dict(supervisor.read_snapshot()["certificate"])


def wait_for_service_state(
    supervisor: DevSidecarSupervisor,
    expected: str,
    *,
    timeout: float = 8.0,
) -> dict:
    deadline = time.time() + timeout
    snapshot = dict(supervisor.read_snapshot())
    while time.time() < deadline:
        snapshot = dict(supervisor.read_snapshot())
        if snapshot["status"]["service_state"] == expected:
            return snapshot
        time.sleep(0.05)
    return snapshot


class UnsafeSecretChannel(ParentSecretChannel):
    def deliver(self, **_kwargs: object):
        self.close()
        raise TLSIdentityError(KEY_PASSPHRASE_IPC_UNSAFE)


class RecordingSecretProvider(InMemorySecretProvider):
    def __init__(self) -> None:
        super().__init__()
        self.last_reference: str | None = None
        self.last_secret: bytes | None = None

    def put_secret(self, reference: str, secret: bytes) -> None:
        self.last_reference = reference
        self.last_secret = bytes(secret)
        super().put_secret(reference, secret)


class VolatileVerifiedAtTrust(FakeCurrentUserTrustAdapter):
    def __init__(self) -> None:
        super().__init__()
        self.inspection_count = 0

    def inspect_target(self, target):
        inspection = super().inspect_target(target)
        self.inspection_count += 1
        return replace(
            inspection,
            verified_at=f"2026-07-24T09:00:{self.inspection_count:02d}Z",
        )


class DevSupervisorTests(unittest.TestCase):
    def test_real_https_process_starts_stops_and_cleans_owned_root(self) -> None:
        port = free_port()
        supervisor = DevSidecarSupervisor(configured_port=port)
        root = supervisor.runtime_root
        try:
            certificate = provision_certificate(supervisor)
            initial = supervisor.read_snapshot()
            started = supervisor.start_service(
                request_id="request-start-real-0001",
                expected_state_version=initial["state_version"],
            )
            snapshot = supervisor.read_snapshot()
            self.assertEqual(snapshot["status"]["service_state"], "ready")
            self.assertTrue(started["changed"])
            self.assertIsNotNone(supervisor.process)
            self.assertIsNone(supervisor.process.poll())

            context = ssl.create_default_context(
                ssl.Purpose.SERVER_AUTH,
                cafile=supervisor.ca_path,
            )
            connection = http.client.HTTPSConnection(
                "127.0.0.1",
                port,
                timeout=2,
                context=context,
            )
            connection.request("GET", "/.well-known/oauth-protected-resource/mcp")
            response = connection.getresponse()
            payload = response.read()
            connection.close()
            self.assertEqual(response.status, 200, payload)

            repeated = supervisor.start_service(
                request_id="request-start-real-0002",
                expected_state_version=snapshot["state_version"],
            )
            self.assertFalse(repeated["changed"])

            stopped = supervisor.stop_service(
                request_id="request-stop-real-0001",
                expected_state_version=supervisor.read_snapshot()["state_version"],
            )
            self.assertTrue(stopped["changed"])
            self.assertEqual(
                supervisor.read_snapshot()["status"]["service_state"],
                "stopped",
            )
            restarted = supervisor.start_service(
                request_id="request-start-real-0003",
                expected_state_version=supervisor.read_snapshot()["state_version"],
            )
            self.assertTrue(restarted["changed"])
            self.assertEqual(
                supervisor.read_snapshot()["certificate"][
                    "ca_fingerprint_sha256"
                ],
                certificate["ca_fingerprint_sha256"],
            )
            supervisor.stop_service(
                request_id="request-stop-real-0002",
                expected_state_version=supervisor.read_snapshot()["state_version"],
            )
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.4)
                self.assertNotEqual(probe.connect_ex(("127.0.0.1", port)), 0)
        finally:
            supervisor.close()
        self.assertFalse(root.exists())

    def test_external_port_conflict_is_reported_and_listener_is_not_killed(self) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as external:
            external.bind(("127.0.0.1", 0))
            external.listen(1)
            port = int(external.getsockname()[1])
            supervisor = DevSidecarSupervisor(configured_port=port)
            try:
                provision_certificate(supervisor)
                with self.assertRaises(GatewayActionError):
                    supervisor.start_service(
                        request_id="request-port-conflict",
                        expected_state_version=supervisor.read_snapshot()[
                            "state_version"
                        ],
                    )
                self.assertEqual(external.getsockname()[1], port)
                self.assertEqual(
                    supervisor.read_snapshot()["status"]["recoverable_error"]["code"],
                    "PORT_IN_USE",
                )
                replacement = free_port()
                recovered = supervisor.update_port(
                    configured_port=replacement,
                    request_id="request-port-conflict-recovery",
                    expected_state_version=supervisor.read_snapshot()["state_version"],
                )
                self.assertTrue(recovered["changed"])
                self.assertEqual(
                    supervisor.read_snapshot()["status"]["service_state"],
                    "stopped",
                )
            finally:
                supervisor.close()

    def test_reserved_stable_preview_port_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "reserved"):
            DevSidecarSupervisor(configured_port=5173)

    def test_port_update_requires_stopped_service(self) -> None:
        first = free_port()
        second = free_port()
        supervisor = DevSidecarSupervisor(configured_port=first)
        try:
            changed = supervisor.update_port(
                configured_port=second,
                request_id="request-update-port",
                expected_state_version=0,
            )
            self.assertTrue(changed["changed"])
            self.assertEqual(
                supervisor.read_snapshot()["settings"]["canonical_resource"],
                f"https://127.0.0.1:{second}/mcp",
            )
        finally:
            supervisor.close()

    def test_certificate_prepare_confirm_restart_and_reset_use_fake_trust_only(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            runtime_root = Path(temporary) / "runtime"
            identity_root = Path(temporary) / "identity"
            provider = InMemorySecretProvider()
            trust = FakeCurrentUserTrustAdapter()
            supervisor = DevSidecarSupervisor(
                configured_port=28776,
                runtime_root=runtime_root,
                certificate_identity_root=identity_root,
                certificate_secret_provider=provider,
                certificate_trust_adapter=trust,
                cleanup_on_close=False,
            )
            try:
                self.assertEqual(
                    supervisor.read_snapshot()["certificate"]["state"],
                    "not_configured",
                )
                prepared = supervisor.prepare_certificate_action(
                    action="certificate_provision",
                    request_id="request-certificate-prepare-0001",
                    expected_state_version=0,
                )
                confirmed = supervisor.confirm_certificate_action(
                    confirmation_id=prepared["confirmation_id"],
                    request_id="request-certificate-confirm-0001",
                    expected_state_version=prepared["state_version"],
                )
                self.assertTrue(confirmed["changed"])
                first = supervisor.read_snapshot()["certificate"]
                self.assertEqual(first["state"], "valid")
                fingerprint = first["ca_fingerprint_sha256"]
            finally:
                supervisor.close()

            restarted = DevSidecarSupervisor(
                configured_port=28777,
                runtime_root=runtime_root,
                certificate_identity_root=identity_root,
                certificate_secret_provider=provider,
                certificate_trust_adapter=trust,
                cleanup_on_close=False,
            )
            try:
                self.assertEqual(
                    restarted.read_snapshot()["certificate"][
                        "ca_fingerprint_sha256"
                    ],
                    fingerprint,
                )
                reset = restarted.prepare_reset(
                    audit_disposition="retain",
                    request_id="request-reset-certificate-0001",
                    expected_state_version=restarted.read_snapshot()["state_version"],
                )
                restarted.confirm_web_reset(
                    reset_id=reset["reset_id"],
                    request_id="request-reset-certificate-confirm-0001",
                    expected_state_version=reset["state_version"],
                )
                self.assertEqual(
                    restarted.read_snapshot()["certificate"]["state"],
                    "not_configured",
                )
            finally:
                restarted.close()

    def test_trust_observation_timestamp_does_not_churn_state_version(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            supervisor = DevSidecarSupervisor(
                configured_port=28779,
                runtime_root=Path(temporary) / "runtime",
                certificate_identity_root=Path(temporary) / "identity",
                certificate_secret_provider=InMemorySecretProvider(),
                certificate_trust_adapter=VolatileVerifiedAtTrust(),
                cleanup_on_close=False,
            )
            try:
                provision_certificate(supervisor)
                first = supervisor.read_snapshot()
                second = supervisor.read_snapshot()
                self.assertNotEqual(
                    first["certificate"]["trust_verified_at"],
                    second["certificate"]["trust_verified_at"],
                )
                self.assertEqual(
                    first["state_version"],
                    second["state_version"],
                )
            finally:
                supervisor.close()

    def test_rotation_projects_retiring_operation_and_reset_cleans_all_generations(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            provider = InMemorySecretProvider()
            trust = FakeCurrentUserTrustAdapter()
            supervisor = DevSidecarSupervisor(
                configured_port=28778,
                runtime_root=Path(temporary) / "runtime",
                certificate_identity_root=Path(temporary) / "identity",
                certificate_secret_provider=provider,
                certificate_trust_adapter=trust,
                cleanup_on_close=False,
            )
            try:
                first = provision_certificate(supervisor)
                prepared = supervisor.prepare_certificate_action(
                    action="certificate_rotate",
                    request_id="request-certificate-rotate-prepare",
                    expected_state_version=supervisor.read_snapshot()[
                        "state_version"
                    ],
                )
                result = supervisor.confirm_certificate_action(
                    confirmation_id=prepared["confirmation_id"],
                    request_id="request-certificate-rotate-confirm",
                    expected_state_version=prepared["state_version"],
                )
                snapshot = supervisor.read_snapshot()
                self.assertNotEqual(
                    snapshot["certificate"]["ca_fingerprint_sha256"],
                    first["ca_fingerprint_sha256"],
                )
                self.assertEqual(
                    snapshot["certificate"]["operation"]["phase"],
                    "retiring",
                )
                self.assertTrue(snapshot["certificate"]["cleanup_pending"])
                self.assertTrue(
                    snapshot["certificate"]["client_restart_required"]
                )
                self.assertEqual(
                    result["operation_id"],
                    snapshot["certificate"]["operation"]["operation_id"],
                )
                reset = supervisor.prepare_reset(
                    audit_disposition="retain",
                    request_id="request-reset-after-rotation",
                    expected_state_version=snapshot["state_version"],
                )
                supervisor.confirm_web_reset(
                    reset_id=reset["reset_id"],
                    request_id="request-reset-after-rotation-confirm",
                    expected_state_version=reset["state_version"],
                )
                final = supervisor.read_snapshot()
                self.assertEqual(final["certificate"]["state"], "not_configured")
                self.assertEqual(
                    list(
                        (
                            Path(temporary)
                            / "identity"
                            / "generations"
                        ).iterdir()
                    ),
                    [],
                )
            finally:
                supervisor.close()

    def test_running_service_stops_when_current_user_trust_disappears(self) -> None:
        port = free_port()
        trust = FakeCurrentUserTrustAdapter()
        supervisor = DevSidecarSupervisor(
            configured_port=port,
            certificate_trust_adapter=trust,
        )
        try:
            certificate = provision_certificate(supervisor)
            supervisor.start_service(
                request_id="request-start-runtime-drift",
                expected_state_version=supervisor.read_snapshot()[
                    "state_version"
                ],
            )
            trust.simulate_external_removal(
                display_name=certificate["ca_display_name"]
            )
            deadline = time.time() + 4
            while time.time() < deadline:
                if (
                    supervisor.read_snapshot()["status"]["service_state"]
                    == "error"
                ):
                    break
                time.sleep(0.05)
            snapshot = supervisor.read_snapshot()
            self.assertEqual(snapshot["status"]["service_state"], "error")
            self.assertEqual(
                snapshot["status"]["recoverable_error"]["code"],
                "CERTIFICATE_RUNTIME_INVALID",
            )
            self.assertIsNone(supervisor.process)
        finally:
            supervisor.close()

    def test_web_reset_is_two_step_stops_service_and_rotates_secrets(self) -> None:
        port = free_port()
        supervisor = DevSidecarSupervisor(configured_port=port)
        try:
            provision_certificate(supervisor)
            supervisor.start_service(
                request_id="request-start-before-reset",
                expected_state_version=supervisor.read_snapshot()[
                    "state_version"
                ],
            )
            verifier_path = supervisor.runtime_root / "verifier-key.bin"
            original_verifier = verifier_path.read_bytes()
            prepared = supervisor.prepare_reset(
                audit_disposition="clear",
                request_id="request-prepare-web-reset",
                expected_state_version=supervisor.read_snapshot()["state_version"],
            )
            self.assertEqual(prepared["confirmation_mode"], "web")
            confirmed = supervisor.confirm_web_reset(
                reset_id=prepared["reset_id"],
                request_id="request-confirm-web-reset",
                expected_state_version=prepared["state_version"],
            )
            self.assertTrue(confirmed["changed"])
            self.assertEqual(
                supervisor.read_snapshot()["status"]["service_state"],
                "stopped",
            )
            self.assertFalse(supervisor.ca_path.exists())
            self.assertNotEqual(verifier_path.read_bytes(), original_verifier)
            with self.assertRaises(GatewayActionError):
                supervisor.confirm_web_reset(
                    reset_id=prepared["reset_id"],
                    request_id="request-confirm-web-reset-replay",
                    expected_state_version=confirmed["state_version"],
                )
        finally:
            supervisor.close()

    def test_enabled_service_and_authorization_restore_after_supervisor_restart(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-mcp-restore-") as temporary:
            root = Path(temporary)
            runtime_root = root / "runtime"
            identity_root = root / "identity"
            provider = InMemorySecretProvider()
            trust = FakeCurrentUserTrustAdapter()
            port = free_port()
            access_token = "persisted-access-" + ("a" * 48)
            refresh_token = "persisted-refresh-" + ("r" * 48)
            supervisor = DevSidecarSupervisor(
                configured_port=port,
                runtime_root=runtime_root,
                certificate_identity_root=identity_root,
                certificate_secret_provider=provider,
                certificate_trust_adapter=trust,
                cleanup_on_close=False,
                auto_restore_enabled=True,
            )
            try:
                provision_certificate(supervisor)
                supervisor.start_service(
                    request_id="request-persistent-start",
                    expected_state_version=supervisor.read_snapshot()[
                        "state_version"
                    ],
                )
                supervisor._store.save_client(
                    "codex-persisted",
                    {"client_name": "Codex"},
                    registration_mode="DCR",
                )
                supervisor._store.create_token_family(
                    family_id="family-persisted",
                    client_id="codex-persisted",
                    scopes=["sapd.base.public.summary.read"],
                    resource=f"https://127.0.0.1:{port}/mcp",
                    instance_id=supervisor._instance_id,
                    runtime_id=supervisor._runtime_id,
                    grant_version="grant-v1",
                    policy_version="policy-v1",
                    access_token=access_token,
                    access_expires_at=time.time() + 3600,
                    refresh_token=refresh_token,
                    refresh_expires_at=time.time() + 86400,
                )
                first_instance_id = supervisor._instance_id
                first_runtime_id = supervisor._runtime_id
            finally:
                supervisor.close()

            restarted = DevSidecarSupervisor(
                configured_port=free_port(),
                runtime_root=runtime_root,
                certificate_identity_root=identity_root,
                certificate_secret_provider=provider,
                certificate_trust_adapter=trust,
                cleanup_on_close=False,
                auto_restore_enabled=True,
            )
            try:
                snapshot = wait_for_service_state(restarted, "ready")
                self.assertEqual(snapshot["status"]["service_state"], "ready")
                self.assertEqual(snapshot["settings"]["configured_port"], port)
                self.assertTrue(snapshot["settings"]["auto_restore"])
                self.assertEqual(restarted._instance_id, first_instance_id)
                self.assertEqual(restarted._runtime_id, first_runtime_id)
                self.assertIsNotNone(
                    restarted._store.lookup_token(access_token, kind="access")
                )
                self.assertEqual(
                    snapshot["status"]["authorization_state"],
                    "authorized",
                )
                restarted.stop_service(
                    request_id="request-persistent-stop",
                    expected_state_version=restarted.read_snapshot()[
                        "state_version"
                    ],
                )
            finally:
                restarted.close()

            stopped = DevSidecarSupervisor(
                configured_port=free_port(),
                runtime_root=runtime_root,
                certificate_identity_root=identity_root,
                certificate_secret_provider=provider,
                certificate_trust_adapter=trust,
                cleanup_on_close=False,
                auto_restore_enabled=True,
            )
            try:
                time.sleep(1.2)
                snapshot = stopped.read_snapshot()
                self.assertEqual(snapshot["status"]["desired_state"], "disabled")
                self.assertEqual(snapshot["status"]["service_state"], "stopped")
                self.assertIsNone(stopped.process)
            finally:
                stopped.close()

    def test_unexpected_sidecar_exit_is_restarted_automatically(self) -> None:
        port = free_port()
        supervisor = DevSidecarSupervisor(
            configured_port=port,
            auto_restore_enabled=True,
        )
        try:
            provision_certificate(supervisor)
            supervisor.start_service(
                request_id="request-auto-recovery-start",
                expected_state_version=supervisor.read_snapshot()["state_version"],
            )
            process = supervisor.process
            self.assertIsNotNone(process)
            first_pid = process.pid
            process.kill()
            process.wait(timeout=5)
            snapshot = wait_for_service_state(supervisor, "ready")
            self.assertEqual(snapshot["status"]["service_state"], "ready")
            self.assertIsNotNone(supervisor.process)
            self.assertNotEqual(supervisor.process.pid, first_pid)
            self.assertEqual(snapshot["status"]["reconnect_state"], "idle")
        finally:
            supervisor.close()

    def test_unsafe_secret_channel_blocks_start_and_does_not_listen(self) -> None:
        port = free_port()
        supervisor = DevSidecarSupervisor(
            configured_port=port,
            secret_channel_factory=UnsafeSecretChannel,
        )
        try:
            provision_certificate(supervisor)
            with self.assertRaises(GatewayActionError):
                supervisor.start_service(
                    request_id="request-unsafe-secret-channel",
                    expected_state_version=supervisor.read_snapshot()[
                        "state_version"
                    ],
                )
            snapshot = supervisor.read_snapshot()
            self.assertEqual(snapshot["status"]["service_state"], "error")
            self.assertEqual(
                snapshot["status"]["recoverable_error"]["code"],
                KEY_PASSPHRASE_IPC_UNSAFE,
            )
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.4)
                self.assertNotEqual(probe.connect_ex(("127.0.0.1", port)), 0)
        finally:
            supervisor.close()

    def test_secret_and_identity_paths_do_not_leak_to_process_metadata_or_state(
        self,
    ) -> None:
        port = free_port()
        provider = RecordingSecretProvider()
        captured_popen: list[tuple[object, dict[str, object]]] = []
        original_popen = __import__("subprocess").Popen

        def recording_popen(
            args: object,
            **kwargs: object,
        ):
            captured_popen.append((args, dict(kwargs)))
            return original_popen(args, **kwargs)

        with tempfile.TemporaryDirectory(prefix="sapd-mcp-c0b-leak-") as temporary:
            root = Path(temporary)
            supervisor = DevSidecarSupervisor(
                configured_port=port,
                runtime_root=root / "runtime",
                certificate_identity_root=root / "identity",
                certificate_secret_provider=provider,
                cleanup_on_close=False,
            )
            try:
                provision_certificate(supervisor)
                manifest = supervisor._certificate_identity.load_manifest()
                self.assertIsNotNone(manifest)
                with patch(
                    "sapd_wiki.local_mcp.dev_supervisor.subprocess.Popen",
                    side_effect=recording_popen,
                ):
                    supervisor.start_service(
                        request_id="request-no-secret-leak",
                        expected_state_version=supervisor.read_snapshot()[
                            "state_version"
                        ],
                    )
                self.assertEqual(len(captured_popen), 1)
                args, kwargs = captured_popen[0]
                self.assertNotIn("env", kwargs)
                self.assertNotIn(provider.last_reference, repr(args))
                self.assertNotIn(
                    str(
                        supervisor._certificate_identity.active_identity_files(
                            manifest
                        ).encrypted_private_key_path
                    ),
                    repr(args),
                )
                secret = provider.last_secret.decode("ascii")
                artifacts = [
                    repr(args),
                    repr(kwargs),
                    (supervisor.runtime_root / "sidecar.log").read_text(
                        encoding="utf-8"
                    ),
                    (supervisor.runtime_root / "sidecar.lease.json").read_text(
                        encoding="utf-8"
                    ),
                    repr(supervisor.read_snapshot()),
                    repr(dict(os.environ)),
                ]
                self.assertTrue(secret)
                for artifact in artifacts:
                    self.assertNotIn(secret, artifact)
                    self.assertNotIn(provider.last_reference, artifact)
                supervisor.stop_service(
                    request_id="request-no-secret-leak-stop",
                    expected_state_version=supervisor.read_snapshot()[
                        "state_version"
                    ],
                )
            finally:
                supervisor.close()


if __name__ == "__main__":
    unittest.main()
