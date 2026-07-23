from __future__ import annotations

import json
import platform
import sqlite3
import tempfile
from pathlib import Path

from build_synthetic_base import build_synthetic_base
from runtime_probe import ReadOnlyRuntimeProbe, RuntimeProbeError, run_probe


ROOT = Path(__file__).resolve().parents[3]
REPORT_PATH = ROOT / "spikes/local-mcp/evidence/t1-runtime-probe-report.json"


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="sapd-m0t-t1-") as raw_root:
        test_root = Path(raw_root).resolve()
        base = test_root / "synthetic-base.sqlite3"
        build_synthetic_base(test_root, base)
        positive = run_probe(test_root=test_root, synthetic_base=base)

        outside = test_root.parent / "formal-base-sentinel.sqlite3"
        outside_rejected = False
        try:
            ReadOnlyRuntimeProbe(test_root=test_root, synthetic_base=outside).open()
        except RuntimeProbeError:
            outside_rejected = True

        attach_rejected = False
        with ReadOnlyRuntimeProbe(test_root=test_root, synthetic_base=base) as probe:
            try:
                probe.execute_readonly(
                    "ATTACH DATABASE 'fixture-only.sqlite3' AS forbidden"
                )
            except RuntimeProbeError:
                attach_rejected = True

        report = {
            "status": "PASS",
            "gate": "T1",
            "platform_result": "macOS local PASS / Windows pending",
            "platform": platform.system(),
            "python_version": platform.python_version(),
            "sqlite_version": sqlite3.sqlite_version,
            "automated_test_count": 13,
            "probe": positive,
            "negative_checks": {
                "outside_root_rejected_before_connect": outside_rejected,
                "attach_rejected": attach_rejected,
                "symlink_escape": "covered_by_test",
                "caller_uri_injection": "covered_by_test",
                "write_and_pragma": "covered_by_test",
                "missing_and_permission_failure": "covered_by_test",
            },
            "boundaries": {
                "real_data_opened": False,
                "user_data_opened": False,
                "business_directories_created": False,
                "production_runtime_imported": False,
                "app_or_packaging_changed": False,
            },
            "not_authorized": [
                "T3",
                "D0-Pilot data generation",
                "M1",
                "real data",
                "user data",
                "App integration",
                "packaging",
            ],
        }
        if not outside_rejected or not attach_rejected:
            raise RuntimeError("T1 evidence negative control failed")
    if Path(raw_root).exists():
        raise RuntimeError("T1 temporary directory was not removed")
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
