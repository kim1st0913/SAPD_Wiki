#!/usr/bin/env python3
"""Summarize frontend data packages without printing full JSON payloads."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "frontend/capability-browser/public/data"
PACKAGES = {
    "capability": DATA_DIR / "capability-tree.json",
    "management": DATA_DIR / "management-knowledge.json",
    "lifecycle": DATA_DIR / "lifecycle-knowledge.json",
    "content": DATA_DIR / "content-views.json",
    "standards": DATA_DIR / "standards-data.json",
    "capability-workbench": DATA_DIR / "capability-workbench.json",
    "environment-workbench": DATA_DIR / "environment-workbench.json",
    "lifecycle-workbench": DATA_DIR / "lifecycle-workbench.json",
}
FORBIDDEN_KEYS = {
    "sheet",
    "row",
    "column",
    "raw_value",
    "source_file",
    "import_id",
    "source_id",
    "source_ref",
    "source_label",
    "debug",
    "raw",
    "metadata",
    "intermediate",
    "generated_at",
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def count_lists(value: Any, prefix: str = "", limit: int = 24) -> dict[str, int]:
    counts: dict[str, int] = {}
    if len(counts) >= limit:
        return counts
    if isinstance(value, dict):
        for key, child in value.items():
            name = f"{prefix}.{key}" if prefix else key
            if isinstance(child, list):
                counts[name] = len(child)
            elif isinstance(child, dict):
                counts.update(count_lists(child, name, limit))
            if len(counts) >= limit:
                break
    return counts


def object_counts(value: Any) -> dict[str, int]:
    objects = value.get("objects") if isinstance(value, dict) else None
    if not isinstance(objects, dict):
        return {}
    result: dict[str, int] = {}
    for key, rows in objects.items():
        if isinstance(rows, dict):
            result[key] = len(rows)
        elif isinstance(rows, list):
            result[key] = len(rows)
    return result


def key_scan(value: Any, max_hits: int = 20) -> dict[str, int]:
    counter: Counter[str] = Counter()

    def walk(item: Any) -> None:
      if len(counter) >= max_hits:
          return
      if isinstance(item, dict):
          for key, child in item.items():
              if key in FORBIDDEN_KEYS:
                  counter[key] += 1
              walk(child)
      elif isinstance(item, list):
          for child in item[:200]:
              walk(child)

    walk(value)
    return dict(counter)


def summarize(name: str) -> dict[str, Any]:
    path = PACKAGES[name]
    if not path.exists():
        return {"package": name, "path": str(path.relative_to(ROOT)), "exists": False, "result": "missing"}
    data = load_json(path)
    stats = data.get("stats") if isinstance(data, dict) else None
    return {
        "package": name,
        "path": str(path.relative_to(ROOT)),
        "exists": True,
        "size_kb": round(path.stat().st_size / 1024, 1),
        "data_state": data.get("data_state") or data.get("__data_state") or "unknown" if isinstance(data, dict) else "unknown",
        "top_level_keys": list(data.keys())[:24] if isinstance(data, dict) else [],
        "stats": stats if isinstance(stats, dict) else {},
        "object_counts": object_counts(data),
        "list_counts": count_lists(data),
        "forbidden_key_hits_sample": key_scan(data),
        "result": "pass",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Print concise summaries for frontend data packages.")
    parser.add_argument("--package", choices=[*PACKAGES.keys(), "all"], default="all")
    args = parser.parse_args()
    names = list(PACKAGES) if args.package == "all" else [args.package]
    summaries = [summarize(name) for name in names]
    print(json.dumps({"packages": summaries}, ensure_ascii=False, indent=2))
    return 0 if all(item["result"] in {"pass", "missing"} for item in summaries) else 1


if __name__ == "__main__":
    raise SystemExit(main())
