"""Executable composition root for the isolated Web-development Sidecar."""

from __future__ import annotations

import argparse
import os
import secrets
from pathlib import Path

from .authorization_broker import AuthorizationDecisionBroker
from .core_adapter import CoreKnowledgeServiceAdapter
from .dev_fixture import POLICY_VERSION, create_dev_synthetic_base
from .dev_tls import DevTlsIdentity, generate_dev_tls_identity
from .query_service import KnowledgeQueryService
from .sidecar import Sidecar, SidecarConfig


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


def run_dev_sidecar(
    *,
    runtime_root: Path,
    configured_port: int,
    authorization_timeout_seconds: int = 120,
) -> None:
    root = _isolated_root(str(runtime_root))
    synthetic_root = root / "synthetic"
    synthetic_root.mkdir(mode=0o700, exist_ok=True)
    os.chmod(synthetic_root, 0o700)
    synthetic_base = synthetic_root / "synthetic-base.sqlite3"
    if not synthetic_base.exists():
        synthetic_base = create_dev_synthetic_base(synthetic_root)

    tls_root = root / "tls"
    tls_identity: DevTlsIdentity | None = None
    if tls_root.exists():
        raise ValueError("stale TLS identity must be cleaned before start")
    tls_identity = generate_dev_tls_identity(tls_root)

    verifier_key = _read_secret(root / "verifier-key.bin")
    audit_period_key = _read_secret(root / "audit-period-key.bin")
    cursor_key = _read_secret(root / "cursor-key.bin")
    core = KnowledgeQueryService.create(
        synthetic_root=synthetic_root,
        synthetic_base=synthetic_base,
        cursor_key=cursor_key,
    )
    sidecar: Sidecar | None = None
    try:
        config = SidecarConfig.for_web_dev(
            configured_port=configured_port,
            instance_id=f"web-dev-{secrets.token_urlsafe(12)}",
            runtime_id=f"runtime-{secrets.token_urlsafe(12)}",
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
        sidecar.run(ssl_context=tls_identity.server_context())
    finally:
        if sidecar is not None:
            sidecar.close()
        core.close()
        if tls_identity is not None:
            tls_identity.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the isolated SAPD Wiki Web-dev MCP Sidecar")
    parser.add_argument("--runtime-root", required=True)
    parser.add_argument("--port", required=True, type=int)
    parser.add_argument(
        "--authorization-timeout-seconds",
        type=int,
        default=120,
        choices=range(1, 601),
    )
    args = parser.parse_args(argv)
    run_dev_sidecar(
        runtime_root=Path(args.runtime_root),
        configured_port=args.port,
        authorization_timeout_seconds=args.authorization_timeout_seconds,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
