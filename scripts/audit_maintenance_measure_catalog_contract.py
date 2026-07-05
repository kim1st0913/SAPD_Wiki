#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "frontend" / "capability-browser" / "public" / "data"
DB_PATH = ROOT / "data" / "database" / "sapd_wiki.sqlite3"
EXPECTED_ACTIVE_MEASURE_COUNT = 32
CONFIRMED_MEASURES = {
    "应用程序威胁建模",
    "制品安全加固",
    "IaC代码安全测试",
    "数据销毁",
    "API网关",
    "应用自身数据加解密模块",
}
MODULE_ONLY_TITLES = {
    "主机防火墙",
    "主机恶意代码防护",
    "主机入侵防御（HIPS）",
    "终端安全工作区",
}


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def item_names(rows: Any) -> set[str]:
    if not isinstance(rows, list):
        return set()
    return {
        str(item.get("name") or item.get("title") or "").strip()
        for item in rows
        if isinstance(item, dict) and str(item.get("name") or item.get("title") or "").strip()
    }


def active_sqlite_measure_names() -> set[str]:
    with sqlite3.connect(DB_PATH) as connection:
        rows = connection.execute(
            """
            SELECT title
            FROM knowledge_items
            WHERE type = 'security_technical_measure'
              AND status = 'active'
            """
        ).fetchall()
    return {str(row[0]).strip() for row in rows if str(row[0] or "").strip()}


def main() -> None:
    maintenance = read_json(DATA_DIR / "maintenance-knowledge.json")
    split_measures = read_json(DATA_DIR / "maintenance" / "measures.json")
    maintenance_index = read_json(DATA_DIR / "maintenance-index.json")

    expected_names = active_sqlite_measure_names()
    maintenance_names = item_names(maintenance.get("security_technical_measures"))
    split_names = item_names(split_measures.get("security_technical_measures"))
    errors: list[str] = []

    if len(expected_names) != EXPECTED_ACTIVE_MEASURE_COUNT:
        errors.append(
            f"sqlite active security_technical_measure count should be {EXPECTED_ACTIVE_MEASURE_COUNT}, got {len(expected_names)}"
        )
    for label, names in {
        "maintenance-knowledge": maintenance_names,
        "maintenance/measures": split_names,
    }.items():
        missing = sorted(expected_names - names)
        extra = sorted(names - expected_names)
        if missing:
            errors.append(f"{label} missing active sqlite measures: {', '.join(missing)}")
        if extra:
            errors.append(f"{label} has non-sqlite active measures: {', '.join(extra)}")
        leaked = sorted(MODULE_ONLY_TITLES & names)
        if leaked:
            errors.append(f"{label} promoted module-only titles to measures: {', '.join(leaked)}")
        missing_confirmed = sorted(CONFIRMED_MEASURES - names)
        if missing_confirmed:
            errors.append(f"{label} missing confirmed measures: {', '.join(missing_confirmed)}")

    for label, value in {
        "maintenance-knowledge.stats.security_technical_measures": maintenance.get("stats", {}).get("security_technical_measures"),
        "maintenance/measures.stats.security_technical_measures": split_measures.get("stats", {}).get("security_technical_measures"),
        "maintenance-index.section_counts.measures": maintenance_index.get("section_counts", {}).get("measures"),
    }.items():
        if int(value or 0) != EXPECTED_ACTIVE_MEASURE_COUNT:
            errors.append(f"{label} should be {EXPECTED_ACTIVE_MEASURE_COUNT}, got {value}")

    report = {
        "status": "fail" if errors else "pass",
        "sqliteActiveMeasureCount": len(expected_names),
        "maintenanceMeasureCount": len(maintenance_names),
        "splitMeasureCount": len(split_names),
        "moduleOnlyLeakCount": len(MODULE_ONLY_TITLES & (maintenance_names | split_names)),
        "errors": errors,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
