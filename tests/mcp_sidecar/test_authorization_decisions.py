from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.auth import AuthorizationRequest
from sapd_wiki.local_mcp.auth import AuthorizationDecisionTimeout
from sapd_wiki.local_mcp.authorization_broker import AuthorizationDecisionBroker
from sapd_wiki.local_mcp.control_store import ControlStore


def request(client_id: str) -> AuthorizationRequest:
    return AuthorizationRequest(
        client_id=client_id,
        client_name=f"Client {client_id}",
        redirect_uri="http://127.0.0.1:49152/callback",
        scopes=("sapd.base.public.summary.read",),
        resource="https://127.0.0.1:28775/mcp",
        instance_id="fixture-instance",
    )


class AuthorizationDecisionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory(prefix="sapd-mcp-decision-")
        self.store = ControlStore(
            Path(self._temporary.name) / "control.sqlite3",
            verifier_key=b"decision-verifier-key-" + (b"x" * 32),
        )
        self.broker = AuthorizationDecisionBroker(
            self.store,
            policy_version="fixture-policy-v1",
            timeout_seconds=2,
            poll_interval_seconds=0.01,
        )

    async def asyncTearDown(self) -> None:
        self.store.close()
        self._temporary.cleanup()

    async def _wait_for_queue(self, size: int) -> list[dict]:
        for _ in range(200):
            queued = self.store.list_authorization_requests()
            if len(queued) == size:
                return queued
            await asyncio.sleep(0.01)
        self.fail(f"authorization queue did not reach {size}")

    async def test_allow_and_deny_resolve_by_opaque_request_id(self) -> None:
        allowed = asyncio.create_task(self.broker.decide(request("client-allow-0001")))
        queued = await self._wait_for_queue(1)
        self.assertTrue(
            self.store.decide_authorization_request(queued[0]["request_id"], allow=True)
        )
        self.assertTrue(await allowed)

        denied = asyncio.create_task(self.broker.decide(request("client-deny-0002")))
        queued = await self._wait_for_queue(1)
        self.assertTrue(
            self.store.decide_authorization_request(queued[0]["request_id"], allow=False)
        )
        self.assertFalse(await denied)

    async def test_multiple_requests_remain_fifo_and_do_not_overwrite(self) -> None:
        first = asyncio.create_task(self.broker.decide(request("client-first-001")))
        second = asyncio.create_task(self.broker.decide(request("client-second-02")))
        queued = await self._wait_for_queue(2)
        self.assertEqual(
            [item["client_id"] for item in queued],
            ["client-first-001", "client-second-02"],
        )
        self.store.decide_authorization_request(queued[0]["request_id"], allow=True)
        self.store.decide_authorization_request(queued[1]["request_id"], allow=False)
        self.assertEqual(await asyncio.gather(first, second), [True, False])
        self.assertFalse(
            self.store.decide_authorization_request(queued[0]["request_id"], allow=True)
        )

    async def test_identical_concurrent_requests_share_one_user_decision(self) -> None:
        first = asyncio.create_task(self.broker.decide(request("client-retry-0001")))
        second = asyncio.create_task(self.broker.decide(request("client-retry-0001")))
        queued = await self._wait_for_queue(1)

        self.assertTrue(
            self.store.decide_authorization_request(queued[0]["request_id"], allow=True)
        )
        self.assertEqual(await asyncio.gather(first, second), [True, True])
        self.assertEqual(self.store.list_authorization_requests(), [])

    async def test_canceling_one_identical_waiter_keeps_shared_request_pending(self) -> None:
        first = asyncio.create_task(self.broker.decide(request("client-retry-0002")))
        second = asyncio.create_task(self.broker.decide(request("client-retry-0002")))
        queued = await self._wait_for_queue(1)

        first.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await first
        self.assertEqual(len(self.store.list_authorization_requests()), 1)
        self.assertTrue(
            self.store.decide_authorization_request(queued[0]["request_id"], allow=True)
        )
        self.assertTrue(await second)

    async def test_same_client_with_different_redirects_requires_separate_decisions(self) -> None:
        first_request = request("client-boundary-01")
        second_request = AuthorizationRequest(
            client_id=first_request.client_id,
            client_name=first_request.client_name,
            redirect_uri="http://127.0.0.1:49153/callback",
            scopes=first_request.scopes,
            resource=first_request.resource,
            instance_id=first_request.instance_id,
        )
        first = asyncio.create_task(self.broker.decide(first_request))
        second = asyncio.create_task(self.broker.decide(second_request))
        queued = await self._wait_for_queue(2)

        self.assertNotEqual(queued[0]["request_id"], queued[1]["request_id"])
        self.store.decide_authorization_request(queued[0]["request_id"], allow=True)
        self.store.decide_authorization_request(queued[1]["request_id"], allow=False)
        self.assertEqual(await asyncio.gather(first, second), [True, False])

    async def test_timeout_is_distinct_and_cancel_removes_pending_request(self) -> None:
        timeout_broker = AuthorizationDecisionBroker(
            self.store,
            policy_version="fixture-policy-v1",
            timeout_seconds=1,
            poll_interval_seconds=0.01,
        )
        timed = asyncio.create_task(timeout_broker.decide(request("client-timeout-001")))
        await self._wait_for_queue(1)
        with self.assertRaises(AuthorizationDecisionTimeout):
            await timed
        self.assertEqual(self.store.list_authorization_requests(), [])

        canceled = asyncio.create_task(self.broker.decide(request("client-cancel-0001")))
        await self._wait_for_queue(1)
        canceled.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await canceled
        self.assertEqual(self.store.list_authorization_requests(), [])


if __name__ == "__main__":
    unittest.main()
