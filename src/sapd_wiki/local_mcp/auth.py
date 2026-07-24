from __future__ import annotations

import base64
import hashlib
import inspect
import re
import secrets
import time
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from threading import Lock
from typing import Any, Literal
from urllib.parse import urlsplit

from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    AuthorizeError,
    RefreshToken,
    RegistrationError,
    TokenError,
    construct_redirect_uri,
)
from mcp.shared.auth import (
    InvalidRedirectUriError,
    OAuthClientInformationFull,
    OAuthToken,
)
from pydantic import AnyUrl

from .audit import AuditEvent, AuditLogger
from .control_store import ControlStore


SCOPE = "sapd.base.knowledge.read"
ACCESS_TOKEN_TTL_SECONDS = 600
AUTHORIZATION_CODE_TTL_SECONDS = 120
REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
_CLIENT_ID = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
_PKCE_S256 = re.compile(r"^[A-Za-z0-9_-]{43}$")
_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "::1"})


class OAuthContractError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class AuthorizationDecisionTimeout(RuntimeError):
    """Raised when the local user did not decide before the closed deadline."""


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def validate_redirect_uri(registered: str, requested: str) -> None:
    registered_uri = urlsplit(registered)
    requested_uri = urlsplit(requested)
    if (
        registered_uri.fragment
        or requested_uri.fragment
        or registered_uri.username
        or registered_uri.password
        or requested_uri.username
        or requested_uri.password
    ):
        raise OAuthContractError(
            "REDIRECT_URI_MISMATCH", "redirect fragment and userinfo are forbidden"
        )
    if registered_uri.hostname in _LOOPBACK_HOSTS:
        if requested_uri.hostname != registered_uri.hostname:
            raise OAuthContractError(
                "REDIRECT_URI_MISMATCH", "loopback host must match exactly"
            )
        if requested_uri.port is None:
            raise OAuthContractError(
                "REDIRECT_URI_MISMATCH", "loopback redirect requires an explicit port"
            )
        registered_parts = (
            registered_uri.scheme,
            registered_uri.hostname,
            registered_uri.path,
            registered_uri.query,
        )
        requested_parts = (
            requested_uri.scheme,
            requested_uri.hostname,
            requested_uri.path,
            requested_uri.query,
        )
        if registered_parts != requested_parts:
            raise OAuthContractError(
                "REDIRECT_URI_MISMATCH",
                "loopback redirect may vary only by port",
            )
        return
    if registered != requested:
        raise OAuthContractError(
            "REDIRECT_URI_MISMATCH",
            "non-loopback redirect must match exactly",
        )


class SAPDOAuthClientInformation(OAuthClientInformationFull):
    def validate_redirect_uri(self, redirect_uri: AnyUrl | None) -> AnyUrl:
        if redirect_uri is None:
            if self.redirect_uris is not None and len(self.redirect_uris) == 1:
                return self.redirect_uris[0]
            raise InvalidRedirectUriError("redirect_uri must be explicit")
        for registered_uri in self.redirect_uris or []:
            try:
                validate_redirect_uri(str(registered_uri), str(redirect_uri))
                return redirect_uri
            except OAuthContractError:
                continue
        raise InvalidRedirectUriError("redirect_uri is not registered")


class StoredAuthorizationCode(AuthorizationCode):
    instance_id: str


class StoredRefreshToken(RefreshToken):
    family_id: str
    generation: int
    resource: str
    instance_id: str
    runtime_id: str
    grant_version: str
    policy_version: str


class StoredAccessToken(AccessToken):
    family_id: str
    instance_id: str
    runtime_id: str
    grant_version: str
    policy_version: str


@dataclass(frozen=True)
class AuthorizationRequest:
    client_id: str
    client_name: str | None
    redirect_uri: str
    scopes: tuple[str, ...]
    resource: str
    instance_id: str


AuthorizationDecider = Callable[[AuthorizationRequest], bool | Awaitable[bool]]


@dataclass(frozen=True)
class OAuthProviderConfig:
    issuer_url: str
    resource_url: str
    instance_id: str
    runtime_id: str
    policy_version: str
    grant_version: str = "grant-v1"
    scope: str = SCOPE
    access_token_ttl_seconds: int = ACCESS_TOKEN_TTL_SECONDS
    authorization_code_ttl_seconds: int = AUTHORIZATION_CODE_TTL_SECONDS
    refresh_token_ttl_seconds: int = REFRESH_TOKEN_TTL_SECONDS

    def __post_init__(self) -> None:
        issuer = urlsplit(self.issuer_url)
        resource = urlsplit(self.resource_url)
        if issuer.scheme != "https" or resource.scheme != "https":
            raise ValueError("OAuth issuer and resource must use HTTPS")
        if issuer.hostname != "127.0.0.1" or resource.hostname != "127.0.0.1":
            raise ValueError("OAuth issuer and resource must use canonical loopback")
        if resource.path != "/mcp":
            raise ValueError("resource_url must identify the canonical /mcp endpoint")


class LocalOAuthProvider:
    """mcp 1.28.1 OAuth provider backed by the isolated control store."""

    def __init__(
        self,
        store: ControlStore,
        config: OAuthProviderConfig,
        *,
        authorization_decider: AuthorizationDecider | None = None,
        audit: AuditLogger | None = None,
        clock: Callable[[], float] = time.time,
        dcr_limit_per_minute: int = 16,
    ) -> None:
        if not 1 <= dcr_limit_per_minute <= 120:
            raise ValueError("dcr_limit_per_minute is outside the allowed range")
        self.store = store
        self.config = config
        self._authorization_decider = authorization_decider
        self._audit = audit
        self._clock = clock
        self._dcr_limit_per_minute = dcr_limit_per_minute
        self._dcr_registrations: deque[float] = deque()
        self._dcr_lock = Lock()

    @staticmethod
    def select_registration(capabilities: dict[str, bool]) -> str:
        for mode in ("pre_registered", "CIMD", "DCR"):
            if capabilities.get(mode) is True:
                return mode
        raise OAuthContractError(
            "CLIENT_REGISTRATION_UNAVAILABLE",
            "no approved registration mode is available",
        )

    def _record(self, event_type: str, client_id: str, result: str) -> None:
        if self._audit is not None:
            self._audit.record(
                AuditEvent(
                    event_type=event_type,
                    client_id=client_id,
                    result_code=result,
                )
            )

    @staticmethod
    def _validate_client(client: OAuthClientInformationFull) -> str:
        if client.client_id is None or not _CLIENT_ID.fullmatch(client.client_id):
            raise RegistrationError(
                "invalid_client_metadata", "client_id is missing or unsafe"
            )
        if client.client_secret is not None:
            raise RegistrationError(
                "invalid_client_metadata", "public clients must not have a secret"
            )
        if client.token_endpoint_auth_method not in (None, "none"):
            raise RegistrationError(
                "invalid_client_metadata",
                "public clients must use token_endpoint_auth_method=none",
            )
        if client.scope != SCOPE:
            raise RegistrationError(
                "invalid_client_metadata", "client scope is not approved"
            )
        if not {"authorization_code", "refresh_token"}.issubset(
            set(client.grant_types)
        ):
            raise RegistrationError(
                "invalid_client_metadata",
                "authorization_code and refresh_token grants are required",
            )
        if "code" not in client.response_types:
            raise RegistrationError(
                "invalid_client_metadata", "code response type is required"
            )
        if not client.redirect_uris:
            raise RegistrationError(
                "invalid_redirect_uri", "at least one redirect URI is required"
            )
        for redirect_uri in client.redirect_uris:
            parsed = urlsplit(str(redirect_uri))
            if parsed.hostname == "localhost":
                raise RegistrationError(
                    "invalid_redirect_uri", "localhost is not a default loopback host"
                )
            if parsed.hostname in _LOOPBACK_HOSTS and parsed.scheme != "http":
                raise RegistrationError(
                    "invalid_redirect_uri",
                    "native loopback callbacks must use http",
                )
            if parsed.hostname not in _LOOPBACK_HOSTS:
                validate_redirect_uri(str(redirect_uri), str(redirect_uri))
        return client.client_id

    def register_pre_registered(
        self, client: OAuthClientInformationFull
    ) -> SAPDOAuthClientInformation:
        return self._register_client(client, registration_mode="pre_registered")

    def register_cimd(
        self, client: OAuthClientInformationFull
    ) -> SAPDOAuthClientInformation:
        """Register metadata after a separate trusted CIMD resolver validated it."""

        return self._register_client(client, registration_mode="CIMD")

    def _register_client(
        self,
        client: OAuthClientInformationFull,
        *,
        registration_mode: str,
    ) -> SAPDOAuthClientInformation:
        client_id = self._validate_client(client)
        normalized = SAPDOAuthClientInformation.model_validate(
            client.model_dump(mode="json")
        )
        self.store.save_client(
            client_id,
            normalized.model_dump(mode="json"),
            registration_mode=registration_mode,
        )
        return normalized

    async def get_client(
        self, client_id: str
    ) -> SAPDOAuthClientInformation | None:
        stored = self.store.load_client(client_id)
        if stored is None:
            return None
        return SAPDOAuthClientInformation.model_validate(stored)

    async def register_client(
        self, client_info: OAuthClientInformationFull
    ) -> None:
        now = self._clock()
        with self._dcr_lock:
            cutoff = now - 60
            while self._dcr_registrations and self._dcr_registrations[0] <= cutoff:
                self._dcr_registrations.popleft()
            if len(self._dcr_registrations) >= self._dcr_limit_per_minute:
                raise RegistrationError(
                    "invalid_client_metadata",
                    "dynamic client registration rate limit exceeded",
                )
            self._dcr_registrations.append(now)
        self._register_client(client_info, registration_mode="DCR")
        self._record(
            "CLIENT_REGISTERED",
            client_info.client_id or "",
            "DCR_UNVERIFIED",
        )

    async def authorize(
        self,
        client: OAuthClientInformationFull,
        params: AuthorizationParams,
    ) -> str:
        client_id = self._validate_client(client)
        if params.state is None:
            raise AuthorizeError("invalid_request", "state is required")
        if params.scopes != [self.config.scope]:
            raise AuthorizeError("invalid_scope", "exactly one approved scope is required")
        if params.resource != self.config.resource_url:
            raise AuthorizeError("invalid_request", "resource does not match")
        if not _PKCE_S256.fullmatch(params.code_challenge):
            raise AuthorizeError(
                "invalid_request", "a valid PKCE S256 challenge is required"
            )
        request = AuthorizationRequest(
            client_id=client_id,
            client_name=client.client_name,
            redirect_uri=str(params.redirect_uri),
            scopes=tuple(params.scopes),
            resource=params.resource,
            instance_id=self.config.instance_id,
        )
        decision = False
        if self._authorization_decider is not None:
            try:
                decision_result = self._authorization_decider(request)
                decision = bool(
                    await decision_result
                    if inspect.isawaitable(decision_result)
                    else decision_result
                )
            except AuthorizationDecisionTimeout:
                self._record(
                    "AUTHORIZATION_TIMEOUT",
                    client_id,
                    "AUTH_TIMEOUT",
                )
                raise AuthorizeError(
                    "access_denied",
                    "authorization request timed out",
                ) from None
        if not decision:
            self._record("AUTHORIZATION_DENIED", client_id, "AUTH_DENIED")
            raise AuthorizeError("access_denied", "authorization was not approved")
        code = secrets.token_urlsafe(32)
        self.store.save_authorization_code(
            code,
            client_id=client_id,
            scopes=list(params.scopes),
            expires_at=self._clock() + self.config.authorization_code_ttl_seconds,
            code_challenge=params.code_challenge,
            redirect_uri=str(params.redirect_uri),
            redirect_uri_explicit=params.redirect_uri_provided_explicitly,
            resource=params.resource,
            subject=self.config.instance_id,
        )
        self._record("AUTHORIZATION_APPROVED", client_id, "OK")
        return construct_redirect_uri(
            str(params.redirect_uri),
            code=code,
            state=params.state,
        )

    async def load_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: str,
    ) -> StoredAuthorizationCode | None:
        row = self.store.load_authorization_code(authorization_code)
        if row is None or row["client_id"] != client.client_id:
            return None
        return StoredAuthorizationCode(
            code=authorization_code,
            scopes=row["scopes"],
            expires_at=row["expires_at"],
            client_id=row["client_id"],
            code_challenge=row["code_challenge"],
            redirect_uri=row["redirect_uri"],
            redirect_uri_provided_explicitly=bool(row["redirect_uri_explicit"]),
            resource=row["resource"],
            subject=row["subject"],
            instance_id=row["subject"] or self.config.instance_id,
        )

    def _new_tokens(self) -> tuple[str, str]:
        return secrets.token_urlsafe(48), secrets.token_urlsafe(48)

    async def exchange_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: StoredAuthorizationCode,
    ) -> OAuthToken:
        if not self.store.consume_authorization_code(authorization_code.code):
            raise TokenError("invalid_grant", "authorization code was already used")
        if authorization_code.resource != self.config.resource_url:
            raise TokenError("invalid_grant", "authorization resource does not match")
        access_token, refresh_token = self._new_tokens()
        family_id = secrets.token_urlsafe(24)
        now = self._clock()
        self.store.create_token_family(
            family_id=family_id,
            client_id=client.client_id or "",
            scopes=authorization_code.scopes,
            resource=self.config.resource_url,
            instance_id=self.config.instance_id,
            runtime_id=self.config.runtime_id,
            grant_version=self.config.grant_version,
            policy_version=self.config.policy_version,
            access_token=access_token,
            access_expires_at=now + self.config.access_token_ttl_seconds,
            refresh_token=refresh_token,
            refresh_expires_at=now + self.config.refresh_token_ttl_seconds,
        )
        self._record("TOKEN_ISSUED", client.client_id or "", "OK")
        return OAuthToken(
            access_token=access_token,
            token_type="Bearer",
            expires_in=self.config.access_token_ttl_seconds,
            scope=" ".join(authorization_code.scopes),
            refresh_token=refresh_token,
        )

    async def load_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: str,
    ) -> StoredRefreshToken | None:
        row = self.store.lookup_token(
            refresh_token,
            kind="refresh",
            include_inactive=True,
        )
        if row is None or row["client_id"] != client.client_id:
            return None
        return StoredRefreshToken(
            token=refresh_token,
            client_id=row["client_id"],
            scopes=row["scopes"],
            expires_at=int(row["expires_at"]) if row["expires_at"] else None,
            subject=row["instance_id"],
            family_id=row["family_id"],
            generation=row["generation"],
            resource=row["resource"],
            instance_id=row["instance_id"],
            runtime_id=row["runtime_id"],
            grant_version=row["grant_version"],
            policy_version=row["policy_version"],
        )

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: StoredRefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        expired = (
            refresh_token.expires_at is not None
            and self._clock() >= refresh_token.expires_at
        )
        binding_mismatch = any(
            (
                refresh_token.client_id != client.client_id,
                refresh_token.resource != self.config.resource_url,
                refresh_token.runtime_id != self.config.runtime_id,
                refresh_token.instance_id != self.config.instance_id,
                refresh_token.grant_version != self.config.grant_version,
                refresh_token.policy_version != self.config.policy_version,
                refresh_token.scopes != [self.config.scope],
            )
        )
        if expired or binding_mismatch:
            self.store.revoke_family(refresh_token.family_id)
            raise TokenError(
                "invalid_grant",
                "refresh token expired or its security binding changed",
            )
        if scopes != refresh_token.scopes:
            raise TokenError("invalid_scope", "scope does not match the token family")
        access_value, refresh_value = self._new_tokens()
        now = self._clock()
        result = self.store.rotate_refresh_family(
            refresh_token.token,
            access_token=access_value,
            access_expires_at=now + self.config.access_token_ttl_seconds,
            refresh_token=refresh_value,
            refresh_expires_at=now + self.config.refresh_token_ttl_seconds,
        )
        if result is None:
            raise TokenError("invalid_grant", "refresh token is invalid")
        if result["reused"]:
            self._record("REFRESH_REUSE", client.client_id or "", "TOKEN_REUSED")
            raise TokenError(
                "invalid_grant",
                "refresh token reuse detected; token family revoked",
            )
        self._record("TOKEN_REFRESHED", client.client_id or "", "OK")
        return OAuthToken(
            access_token=access_value,
            token_type="Bearer",
            expires_in=self.config.access_token_ttl_seconds,
            scope=" ".join(scopes),
            refresh_token=refresh_value,
        )

    async def load_access_token(self, token: str) -> StoredAccessToken | None:
        row = self.store.lookup_token(token, kind="access")
        if row is None:
            return None
        if row["expires_at"] is not None and self._clock() >= row["expires_at"]:
            self.store.deactivate_token(token)
            return None
        if (
            row["resource"] != self.config.resource_url
            or row["runtime_id"] != self.config.runtime_id
            or row["instance_id"] != self.config.instance_id
            or row["scopes"] != [self.config.scope]
        ):
            return None
        return StoredAccessToken(
            token=token,
            client_id=row["client_id"],
            scopes=row["scopes"],
            expires_at=int(row["expires_at"]) if row["expires_at"] else None,
            resource=row["resource"],
            subject=row["instance_id"],
            claims={
                "aud": row["resource"],
                "runtime_id": row["runtime_id"],
                "instance_id": row["instance_id"],
                "grant_version": row["grant_version"],
                "policy_version": row["policy_version"],
            },
            family_id=row["family_id"],
            instance_id=row["instance_id"],
            runtime_id=row["runtime_id"],
            grant_version=row["grant_version"],
            policy_version=row["policy_version"],
        )

    async def verify_token(self, token: str) -> StoredAccessToken | None:
        return await self.load_access_token(token)

    async def revoke_token(
        self,
        token: AccessToken | RefreshToken,
    ) -> None:
        client_id = self.store.revoke_by_token(token.token)
        if client_id is not None:
            self._record("TOKEN_REVOKED", client_id, "OK")

    def revoke_client(self, client_id: str) -> int:
        count = self.store.revoke_client(client_id)
        self._record("CLIENT_REVOKED", client_id, "OK")
        return count

    def revoke_all(self) -> int:
        return self.store.revoke_all()
