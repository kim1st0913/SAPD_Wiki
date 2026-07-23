from __future__ import annotations

import ssl
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from mcp.shared.auth import OAuthClientInformationFull
from starlette.applications import Starlette

from .audit import AuditLogger
from .auth import AuthorizationDecider, LocalOAuthProvider, OAuthProviderConfig
from .control_store import ControlStore
from .lifecycle import fixed_profile_port, require_fixed_profile_port
from .mcp_tools import KnowledgeService
from .transport import build_transport_app


@dataclass(frozen=True)
class SidecarConfig:
    profile: str
    configured_port: int
    instance_id: str
    runtime_id: str
    policy_version: str
    allow_configurable_dev_port: bool = False

    def __post_init__(self) -> None:
        if self.allow_configurable_dev_port:
            if self.profile != "dev" or not 1024 <= self.configured_port <= 65535:
                raise ValueError("configurable ports are restricted to Web dev")
        else:
            require_fixed_profile_port(self.profile, self.configured_port)

    @classmethod
    def for_profile(
        cls,
        profile: str,
        *,
        instance_id: str,
        runtime_id: str,
        policy_version: str,
    ) -> "SidecarConfig":
        return cls(
            profile=profile,
            configured_port=fixed_profile_port(profile),
            instance_id=instance_id,
            runtime_id=runtime_id,
            policy_version=policy_version,
        )

    @classmethod
    def for_web_dev(
        cls,
        *,
        configured_port: int,
        instance_id: str,
        runtime_id: str,
        policy_version: str,
    ) -> "SidecarConfig":
        return cls(
            profile="dev",
            configured_port=configured_port,
            instance_id=instance_id,
            runtime_id=runtime_id,
            policy_version=policy_version,
            allow_configurable_dev_port=True,
        )

    @property
    def canonical_host(self) -> str:
        return f"127.0.0.1:{self.configured_port}"

    @property
    def canonical_origin(self) -> str:
        return f"https://{self.canonical_host}"

    @property
    def resource_url(self) -> str:
        return f"{self.canonical_origin}/mcp"


@dataclass
class Sidecar:
    config: SidecarConfig
    store: ControlStore
    oauth: LocalOAuthProvider
    app: Starlette

    @classmethod
    def build(
        cls,
        *,
        config: SidecarConfig,
        service: KnowledgeService,
        control_store_path: Path,
        verifier_key: bytes,
        audit_period_key: bytes,
        authorization_decider: AuthorizationDecider | None = None,
        authorization_decider_factory: Callable[[ControlStore], AuthorizationDecider] | None = None,
        pre_registered_clients: tuple[OAuthClientInformationFull, ...] = (),
        enable_dcr: bool = False,
    ) -> "Sidecar":
        if authorization_decider is not None and authorization_decider_factory is not None:
            raise ValueError("provide one authorization decider source")
        store = ControlStore(control_store_path, verifier_key=verifier_key)
        audit = AuditLogger(store, period_key=audit_period_key)
        if authorization_decider_factory is not None:
            authorization_decider = authorization_decider_factory(store)
        oauth = LocalOAuthProvider(
            store,
            OAuthProviderConfig(
                issuer_url=config.canonical_origin,
                resource_url=config.resource_url,
                instance_id=config.instance_id,
                runtime_id=config.runtime_id,
                policy_version=config.policy_version,
            ),
            authorization_decider=authorization_decider,
            audit=audit,
        )
        try:
            for client in pre_registered_clients:
                oauth.register_pre_registered(client)
            app = build_transport_app(
                provider=oauth,
                service=service,
                canonical_host=config.canonical_host,
                canonical_origin=config.canonical_origin,
                audit=audit,
                enable_dcr=enable_dcr,
            )
        except Exception:
            store.close()
            raise
        return cls(config=config, store=store, oauth=oauth, app=app)

    def close(self) -> None:
        self.store.close()

    def run(self, *, ssl_context: ssl.SSLContext) -> None:
        """Run only on the configured fixed port; socket failure never falls back."""

        import uvicorn

        uvicorn.run(
            self.app,
            host="127.0.0.1",
            port=self.config.configured_port,
            log_config=None,
            access_log=False,
            proxy_headers=False,
            ssl_context_factory=lambda _config, _default: ssl_context,
        )


def main() -> int:
    raise RuntimeError(
        "SAPD MCP Sidecar requires Supervisor composition with an explicit "
        "KnowledgeService and platform SecretProvider"
    )
