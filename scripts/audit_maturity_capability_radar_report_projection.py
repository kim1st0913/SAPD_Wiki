#!/usr/bin/env python3
"""Exercise the report-model and self-contained HTML radar projection in memory."""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sapd_wiki.maturity import build_maturity_workspace, create_maturity_report_snapshot  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-html",
        type=Path,
        help="optionally write the in-memory report HTML to this isolated preview path",
    )
    args = parser.parse_args(argv)

    workbench = json.loads((ROOT / "frontend/capability-browser/public/data/capability-workbench.json").read_text(encoding="utf-8"))
    detail = copy.deepcopy(build_maturity_workspace(workbench)["projectDetails"]["demo-project-003"])
    focuses = {item["id"]: item for item in detail["template"]["focuses"]}
    excluded_capability = detail["template"]["capabilities"][0]
    excluded_items = {
        item["id"]
        for item in detail["template"]["scoreItems"]
        if item.get("capabilityId") == excluded_capability["id"]
        or focuses.get(item.get("focusId"), {}).get("capabilityId") == excluded_capability["id"]
    }
    for entry in detail["scoreEntries"]:
        if entry.get("scoreItemId") not in excluded_items:
            continue
        entry.update(
            {
                "isApplicable": False,
                "elements": {},
                "reviewElements": {},
                "targetLevel": None,
                "targetReason": "",
                "targetConfirmed": False,
                "evidenceLevel": "E0",
                "evidenceSummary": "",
                "status": "not_applicable",
                "naReason": "隔离测试全 NA",
            }
        )

    report = create_maturity_report_snapshot(
        {
            "project": detail["project"],
            "template": detail["template"],
            "scoreEntries": detail["scoreEntries"],
            "narrative": {
                "executiveSummary": "隔离测试",
                "keyFindings": "隔离测试",
                "managementRecommendations": "隔离测试",
                "nextSteps": "隔离测试",
            },
        }
    )
    assert report.get("ok") is True, report
    result = report["reportModel"]["resultSnapshot"]
    sections = {item["id"]: item for item in report["reportModel"]["sections"]}
    chart = sections["radars"]["data"]["capabilityRadar"]
    all_rows = result["capabilityResults"]
    axes = chart["axes"]
    all_na = [row for row in all_rows if int(row.get("applicableItemCount") or 0) == 0]
    partial = [row for row in all_rows if row.get("applicableItemCount", 0) > 0 and row.get("notApplicableItemCount", 0) > 0]
    assert len(all_rows) == 32 and len(all_na) == 1 and len(axes) == 31
    assert partial, "the fixture must retain at least one partially applicable L2"
    assert sum(group["count"] for group in chart["groups"]) == len(axes)
    assert all(axis["id"] not in {row["id"] for row in all_na} for axis in axes)
    assert len(sections["capability_results"]["data"]) == len(all_rows), "complete L2 table must remain unchanged"
    assert "31 项适用能力" in report["html"]
    series = re.search(r"<g class='radar-series radar-series-current'>(.*?)</g>", report["html"], re.DOTALL)
    assert series and "<polygon" in series.group(1), "the filtered HTML series must close"
    if args.output_html:
        args.output_html.parent.mkdir(parents=True, exist_ok=True)
        args.output_html.write_text(report["html"], encoding="utf-8")
    print(
        json.dumps(
            {
                "result": "pass",
                "allL2": len(all_rows),
                "allNaL2": len(all_na),
                "partialApplicableL2": len(partial),
                "radarAxes": len(axes),
                "excludedCodes": [row["code"] for row in all_na],
                "groupCounts": {group["code"]: group["count"] for group in chart["groups"]},
                "htmlTitle": "31 项适用能力",
                "htmlCurrentPolygon": True,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
