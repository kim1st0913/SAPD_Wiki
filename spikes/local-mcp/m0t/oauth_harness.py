from __future__ import annotations

import base64
import hashlib
import secrets
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import urlparse


CANONICAL_RESOURCE = "https://127.0.0.1:28775/mcp"
SCOPE = "sapd.base.public.summary.read"


class OAuthError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


@dataclass
class AuthorizationTransaction:
    transaction_id: str
    client_id: str
    redirect_uri: str
    scope: str
    resource: str
    code_challenge: str
    state: str
    instance_id: str
    created_at: float
    status: str = "pending"


@dataclass
class AuthorizationCode:
    code: str
    client_id: str
    redirect_uri: str
    scope: str
    resource: str
    code_challenge: str
    instance_id: str
    used: bool = False


@dataclass
class TokenGrant:
    access_token: str
    refresh_token: str
    family_id: str
    client_id: str
    resource: str
    scope: str
    instance_id: str
    policy_version: str
    expires_at: float
    active: bool = True


class OAuthHarness:
    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.monotonic,
        transaction_timeout_seconds: int = 120,
        access_token_ttl_seconds: int = 600,
    ) -> None:
        self._clock = clock
        self._transaction_timeout = transaction_timeout_seconds
        self._access_token_ttl = access_token_ttl_seconds
        self._transactions: dict[str, AuthorizationTransaction] = {}
        self._codes: dict[str, AuthorizationCode] = {}
        self._access: dict[str, TokenGrant] = {}
        self._refresh: dict[str, TokenGrant] = {}
        self._family_current_refresh: dict[str, str] = {}
        self._revoked_families: set[str] = set()
        self.audit_events: list[dict[str, str]] = []

    @staticmethod
    def protected_resource_metadata() -> dict[str, Any]:
        return {
            "resource": CANONICAL_RESOURCE,
            "authorization_servers": ["https://127.0.0.1:28775"],
            "scopes_supported": [SCOPE],
            "bearer_methods_supported": ["header"],
        }

    @staticmethod
    def authorization_server_metadata() -> dict[str, Any]:
        return {
            "issuer": "https://127.0.0.1:28775",
            "authorization_endpoint": "https://127.0.0.1:28775/oauth/authorize",
            "token_endpoint": "https://127.0.0.1:28775/oauth/token",
            "revocation_endpoint": "https://127.0.0.1:28775/oauth/revoke",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "scopes_supported": [SCOPE],
        }

    @staticmethod
    def select_registration(capabilities: dict[str, bool]) -> str:
        for candidate in ("pre_registered", "CIMD", "DCR"):
            if capabilities.get(candidate) is True:
                return candidate
        raise OAuthError("CLIENT_REGISTRATION_UNAVAILABLE", "no registration mode is available")

    @staticmethod
    def _validate_redirect(registered: str, requested: str) -> None:
        registered_uri = urlparse(registered)
        requested_uri = urlparse(requested)
        if requested_uri.fragment or registered_uri.fragment:
            raise OAuthError("REDIRECT_URI_MISMATCH", "redirect fragment is forbidden")
        loopback_hosts = {"127.0.0.1", "::1"}
        if registered_uri.hostname in loopback_hosts:
            if requested_uri.hostname != registered_uri.hostname:
                raise OAuthError("REDIRECT_URI_MISMATCH", "loopback host mismatch")
            registered_parts = (
                registered_uri.scheme,
                registered_uri.path,
                registered_uri.params,
                registered_uri.query,
            )
            requested_parts = (
                requested_uri.scheme,
                requested_uri.path,
                requested_uri.params,
                requested_uri.query,
            )
            if requested_parts != registered_parts or requested_uri.port is None:
                raise OAuthError("REDIRECT_URI_MISMATCH", "loopback redirect mismatch")
            return
        if registered != requested:
            raise OAuthError("REDIRECT_URI_MISMATCH", "non-loopback redirect must match exactly")

    def create_transaction(
        self,
        *,
        client_id: str,
        registered_redirect_uri: str,
        redirect_uri: str,
        scope: str,
        resource: str,
        code_challenge_value: str,
        state: str,
        instance_id: str,
    ) -> AuthorizationTransaction:
        self._validate_redirect(registered_redirect_uri, redirect_uri)
        if resource != CANONICAL_RESOURCE:
            raise OAuthError("TOKEN_AUDIENCE_MISMATCH", "resource mismatch")
        if scope != SCOPE:
            raise OAuthError("INVALID_SCOPE", "scope mismatch")
        if len(code_challenge_value) < 43:
            raise OAuthError("PKCE_REQUIRED", "PKCE S256 challenge is required")
        if not state:
            raise OAuthError("STATE_REQUIRED", "CSRF state is required")
        transaction = AuthorizationTransaction(
            transaction_id=secrets.token_urlsafe(24),
            client_id=client_id,
            redirect_uri=redirect_uri,
            scope=scope,
            resource=resource,
            code_challenge=code_challenge_value,
            state=state,
            instance_id=instance_id,
            created_at=self._clock(),
        )
        self._transactions[transaction.transaction_id] = transaction
        self.audit_events.append({"event": "AUTH_TRANSACTION_CREATED", "client_id": client_id})
        return transaction

    def _get_pending(self, transaction_id: str) -> AuthorizationTransaction:
        transaction = self._transactions.get(transaction_id)
        if transaction is None:
            raise OAuthError("AUTH_TRANSACTION_UNKNOWN", "transaction not found")
        if self._clock() - transaction.created_at > self._transaction_timeout:
            transaction.status = "expired"
            raise OAuthError("AUTH_TIMEOUT", "authorization transaction expired")
        if transaction.status != "pending":
            raise OAuthError("AUTH_TRANSACTION_NOT_PENDING", "transaction is not pending")
        return transaction

    def approve(self, transaction_id: str) -> dict[str, str]:
        transaction = self._get_pending(transaction_id)
        transaction.status = "approved"
        code = secrets.token_urlsafe(32)
        self._codes[code] = AuthorizationCode(
            code=code,
            client_id=transaction.client_id,
            redirect_uri=transaction.redirect_uri,
            scope=transaction.scope,
            resource=transaction.resource,
            code_challenge=transaction.code_challenge,
            instance_id=transaction.instance_id,
        )
        self.audit_events.append(
            {"event": "AUTH_TRANSACTION_APPROVED", "client_id": transaction.client_id}
        )
        return {"code": code, "state": transaction.state}

    def deny(self, transaction_id: str) -> None:
        transaction = self._get_pending(transaction_id)
        transaction.status = "denied"
        self.audit_events.append(
            {"event": "AUTH_TRANSACTION_DENIED", "client_id": transaction.client_id}
        )

    def exchange_code(
        self,
        *,
        code: str,
        client_id: str,
        redirect_uri: str,
        verifier: str,
        resource: str,
        policy_version: str = "fixture-policy-v1",
    ) -> TokenGrant:
        record = self._codes.get(code)
        if record is None or record.used:
            raise OAuthError("AUTH_CODE_INVALID", "authorization code is invalid or used")
        if (
            record.client_id != client_id
            or record.redirect_uri != redirect_uri
            or record.resource != resource
        ):
            raise OAuthError("REDIRECT_URI_MISMATCH", "code binding mismatch")
        if pkce_challenge(verifier) != record.code_challenge:
            raise OAuthError("PKCE_VERIFIER_MISMATCH", "PKCE verifier mismatch")
        record.used = True
        family_id = secrets.token_urlsafe(24)
        grant = TokenGrant(
            access_token=secrets.token_urlsafe(48),
            refresh_token=secrets.token_urlsafe(48),
            family_id=family_id,
            client_id=client_id,
            resource=record.resource,
            scope=record.scope,
            instance_id=record.instance_id,
            policy_version=policy_version,
            expires_at=self._clock() + self._access_token_ttl,
        )
        self._access[grant.access_token] = grant
        self._refresh[grant.refresh_token] = grant
        self._family_current_refresh[family_id] = grant.refresh_token
        self.audit_events.append({"event": "TOKEN_ISSUED", "client_id": client_id})
        return grant

    def verify_access(self, token: str, *, resource: str, scope: str) -> TokenGrant:
        grant = self._access.get(token)
        if grant is None or not grant.active or grant.family_id in self._revoked_families:
            raise OAuthError("TOKEN_REVOKED", "access token is inactive")
        if self._clock() >= grant.expires_at:
            grant.active = False
            raise OAuthError("TOKEN_EXPIRED", "access token expired")
        if grant.resource != resource:
            raise OAuthError("TOKEN_AUDIENCE_MISMATCH", "resource mismatch")
        if grant.scope != scope:
            raise OAuthError("INVALID_SCOPE", "scope mismatch")
        return grant

    def refresh(self, refresh_token: str) -> TokenGrant:
        grant = self._refresh.get(refresh_token)
        if grant is None:
            raise OAuthError("TOKEN_REVOKED", "refresh token is inactive")
        current = self._family_current_refresh.get(grant.family_id)
        if current != refresh_token:
            self._revoke_family(grant.family_id)
            raise OAuthError("TOKEN_REUSED", "refresh token reuse detected")
        if grant.family_id in self._revoked_families:
            raise OAuthError("TOKEN_REVOKED", "refresh family is revoked")
        grant.active = False
        replacement = TokenGrant(
            access_token=secrets.token_urlsafe(48),
            refresh_token=secrets.token_urlsafe(48),
            family_id=grant.family_id,
            client_id=grant.client_id,
            resource=grant.resource,
            scope=grant.scope,
            instance_id=grant.instance_id,
            policy_version=grant.policy_version,
            expires_at=self._clock() + self._access_token_ttl,
        )
        self._access[replacement.access_token] = replacement
        self._refresh[replacement.refresh_token] = replacement
        self._family_current_refresh[grant.family_id] = replacement.refresh_token
        self.audit_events.append(
            {"event": "TOKEN_REFRESHED", "client_id": grant.client_id}
        )
        return replacement

    def _revoke_family(self, family_id: str) -> None:
        self._revoked_families.add(family_id)
        for grant in self._access.values():
            if grant.family_id == family_id:
                grant.active = False

    def revoke(self, token: str) -> None:
        access = self._access.get(token)
        if access is not None:
            self._revoke_family(access.family_id)
            self.audit_events.append(
                {"event": "TOKEN_REVOKED", "client_id": access.client_id}
            )
            return
        refresh = self._refresh.get(token)
        if refresh is not None:
            self._revoke_family(refresh.family_id)
            self.audit_events.append(
                {"event": "TOKEN_REVOKED", "client_id": refresh.client_id}
            )

    def revoke_client(self, client_id: str) -> None:
        for grant in list(self._access.values()):
            if grant.client_id == client_id:
                self._revoke_family(grant.family_id)
        self.audit_events.append({"event": "CLIENT_REVOKED", "client_id": client_id})

    def issue_test_grant(
        self,
        *,
        client_id: str = "fixture-client",
        instance_id: str = "fixture-instance",
        redirect_port: int = 49152,
    ) -> TokenGrant:
        verifier = "fixture-verifier-" + ("a" * 48)
        transaction = self.create_transaction(
            client_id=client_id,
            registered_redirect_uri="http://127.0.0.1/callback",
            redirect_uri=f"http://127.0.0.1:{redirect_port}/callback",
            scope=SCOPE,
            resource=CANONICAL_RESOURCE,
            code_challenge_value=pkce_challenge(verifier),
            state="fixture-state",
            instance_id=instance_id,
        )
        response = self.approve(transaction.transaction_id)
        return self.exchange_code(
            code=response["code"],
            client_id=client_id,
            redirect_uri=transaction.redirect_uri,
            verifier=verifier,
            resource=CANONICAL_RESOURCE,
        )
