from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from support import ROOT
from sapd_wiki.local_mcp.contracts import REQUIRED_CONTRACT_IDS, load_contracts
from sapd_wiki.local_mcp.errors import ContractError


class ContractLoadingTests(unittest.TestCase):
    def test_loads_exactly_four_frozen_profiles(self) -> None:
        bundle = load_contracts()
        self.assertEqual(set(bundle.profiles), REQUIRED_CONTRACT_IDS)
        self.assertEqual(bundle.scope, "sapd.base.public.summary.read")
        self.assertEqual(bundle.response_bytes, 65536)
        self.assertEqual(len(bundle.digests), 4)

    def test_tool_and_cursor_contracts_are_available(self) -> None:
        bundle = load_contracts()
        self.assertEqual(bundle.tool("search_knowledge")["default_items"], 8)
        self.assertEqual(bundle.tool("get_related_knowledge")["max_items"], 30)
        self.assertEqual(
            set(bundle.cursor_bindings),
            {
                "tool",
                "normalized_parameters",
                "client",
                "grant",
                "scope",
                "policy_version",
                "knowledge_version",
                "identity_version",
                "sort_version",
                "last_sort_key",
                "issued_at",
            },
        )

    def test_digest_tampering_fails_closed(self) -> None:
        source = ROOT / "docs" / "01-architecture" / "contracts" / "mcp" / "v1"
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "contracts"
            shutil.copytree(source, target)
            profile = target / "profiles" / "MCP-AUTH-v1.contract.json"
            payload = json.loads(profile.read_text(encoding="utf-8"))
            payload["scope"] = "fixture.tampered"
            profile.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaises(ContractError):
                load_contracts(target)


if __name__ == "__main__":
    unittest.main()
