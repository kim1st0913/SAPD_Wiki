"""Executable composition root for the isolated Web-development Sidecar."""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

from .authorization_broker import AuthorizationDecisionBroker
from .base_query_service import (
    POLICY_VERSION,
    BaseKnowledgeQueryService,
)
from .core_adapter import CoreKnowledgeServiceAdapter
from .dev_fixture import create_dev_formal_base
from .secret_transport import receive_one_shot_secret
from .sidecar import Sidecar, SidecarConfig
from .tls import create_server_ssl_context_from_passphrase


RUNTIME_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,160}$")


def _isolated_root(value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute() or candidate.is_symlink():
        raise ValueError("runtime root must be an explicit absolute non-symlink path")
    resolved = candidate.resolve(strict=True)
    if not resolved.is_dir():
        raise ValueError("runtime root must be a directory")
    return resolved


def _read_secret(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValueError("runtime secret is unavailable")
    if path.stat().st_mode & 0o077:
        raise ValueError("runtime secret permissions are unsafe")
    value = path.read_bytes()
    if len(value) < 32:
        raise ValueError("runtime secret is too short")
    return value


def _runtime_identifier(value: str) -> str:
    normalized = str(value).strip()
    if not RUNTIME_IDENTIFIER_PATTERN.fullmatch(normalized):
        raise ValueError("runtime identifier is invalid")
    return normalized


def run_dev_sidecar(
    *,
    runtime_root: Path,
    base_database: Path | None,
    configured_port: int,
    secret_channel_fd: int,
    instance_id: str,
    runtime_id: str,
    authorization_timeout_seconds: int = 120,
) -> None:
    root = _isolated_root(str(runtime_root))
    if base_database is None:
        fixture_root = root / "base-fixture"
        fixture_root.mkdir(mode=0o700, exist_ok=True)
        os.chmod(fixture_root, 0o700)
        resolved_base = fixture_root / "base-knowledge.sqlite3"
        if not resolved_base.exists():
            resolved_base = create_dev_formal_base(fixture_root)
    else:
        candidate = Path(base_database)
        if not candidate.is_absolute() or candidate.is_symlink():
            raise ValueError("base database must be an explicit absolute non-symlink path")
        resolved_base = candidate.resolve(strict=True)

    verifier_key = _read_secret(root / "verifier-key.bin")
    audit_period_key = _read_secret(root / "audit-period-key.bin")
    cursor_key = _read_secret(root / "cursor-key.bin")
    core = BaseKnowledgeQueryService.create(
        base_database=resolved_base,
        cursor_key=cursor_key,
    )
    sidecar: Sidecar | None = None
    delivered_secret = None
    try:
        delivered_secret = receive_one_shot_secret(secret_channel_fd)
        ssl_context = create_server_ssl_context_from_passphrase(
            certificate_path=delivered_secret.certificate_path,
            encrypted_private_key_path=delivered_secret.encrypted_private_key_path,
            passphrase=delivered_secret.consume_passphrase(),
            ipc_attestation=delivered_secret.attestation,
        )
        config = SidecarConfig.for_web_dev(
            configured_port=configured_port,
            instance_id=_runtime_identifier(instance_id),
            runtime_id=_runtime_identifier(runtime_id),
            policy_version=POLICY_VERSION,
        )
        control_store_path = root / "control" / "control.sqlite3"
        sidecar = Sidecar.build(
            config=config,
            service=CoreKnowledgeServiceAdapter(core),
            control_store_path=control_store_path,
            verifier_key=verifier_key,
            audit_period_key=audit_period_key,
            authorization_decider_factory=lambda store: AuthorizationDecisionBroker(
                store,
                policy_version=POLICY_VERSION,
                timeout_seconds=authorization_timeout_seconds,
            ).decide,
            enable_dcr=True,
        )
        sidecar.run(ssl_context=ssl_context)
    finally:
        if sidecar is not None:
            sidecar.close()
        core.close()
        if delivered_secret is not None:
            delivered_secret.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the isolated SAPD Wiki Web-dev MCP Sidecar")
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--base-db")
    parser.add_argument("--port", required=True, type=int)
    parser.add_argument("--secret-channel-fd", required=True, type=int)
    parser.add_argument("--instance-id", required=True)
    parser.add_argument("--runtime-id", required=True)
    parser.add_argument(
        "--authorization-timeout-seconds",
        type=int,
        default=120,
        choices=range(1, 601),
    )
    args = parser.parse_args(argv)
    run_dev_sidecar(
        runtime_root=Path(args.runtime_root),
        base_database=Path(args.base_db) if args.base_db else None,
        configured_port=args.port,
        secret_channel_fd=args.secret_channel_fd,
        instance_id=args.instance_id,
        runtime_id=args.runtime_id,
        authorization_timeout_seconds=args.authorization_timeout_seconds,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
