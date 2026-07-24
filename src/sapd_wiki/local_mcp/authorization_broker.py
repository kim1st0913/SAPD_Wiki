"""Durable FIFO authorization decisions shared by Web and the Sidecar."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable

from .auth import AuthorizationDecisionTimeout, AuthorizationRequest
from .control_store import ControlStore


class AuthorizationDecisionBroker:
    def __init__(
        self,
        store: ControlStore,
        *,
        policy_version: str,
        timeout_seconds: int = 120,
        poll_interval_seconds: float = 0.1,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        if not 1 <= timeout_seconds <= 600:
            raise ValueError("timeout_seconds is outside the allowed range")
        if not 0.01 <= poll_interval_seconds <= 1.0:
            raise ValueError("poll_interval_seconds is outside the allowed range")
        self._store = store
        self._policy_version = policy_version
        self._timeout_seconds = timeout_seconds
        self._poll_interval_seconds = poll_interval_seconds
        self._monotonic = monotonic

    async def decide(self, request: AuthorizationRequest) -> bool:
        request_id = self._store.create_authorization_request(
            client_id=request.client_id,
            client_name=request.client_name,
            redirect_uri=request.redirect_uri,
            scopes=list(request.scopes),
            resource=request.resource,
            policy_version=self._policy_version,
            timeout_seconds=self._timeout_seconds,
        )
        deadline = self._monotonic() + self._timeout_seconds
        try:
            while self._monotonic() < deadline:
                decision = self._store.authorization_decision(request_id)
                if decision == "allowed":
                    return True
                if decision == "denied":
                    return False
                if decision == "timed_out":
                    raise AuthorizationDecisionTimeout
                await asyncio.sleep(self._poll_interval_seconds)
            self._store.authorization_decision(request_id)
            raise AuthorizationDecisionTimeout
        except asyncio.CancelledError:
            self._store.cancel_authorization_request(request_id)
            raise
