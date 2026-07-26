#!/usr/bin/env python3
"""Run the bundle backend while denying reads from selected development data roots."""

from __future__ import annotations

import argparse
import os
import runpy
import sys
from pathlib import Path
from typing import Any


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--server-script", type=Path, required=True)
    parser.add_argument("--bundle-root", type=Path, required=True)
    parser.add_argument("--deny-root", action="append", type=Path, default=[])
    args = parser.parse_args()

    denied = tuple(path.resolve() for path in args.deny_root)

    def audit(event: str, values: tuple[Any, ...]) -> None:
        if event != "open" or not values:
            return
        raw_path = values[0]
        if not isinstance(raw_path, (str, bytes, os.PathLike)):
            return
        try:
            candidate = Path(os.fsdecode(raw_path)).resolve()
        except (OSError, TypeError, ValueError):
            return
        for root in denied:
            if candidate == root or root in candidate.parents:
                raise PermissionError(
                    f"T5 forbids development source access: {candidate}"
                )

    sys.addaudithook(audit)
    server_script = args.server_script.resolve(strict=True)
    sys.argv = [
        str(server_script),
        "--bundle-root",
        str(args.bundle_root.resolve(strict=True)),
        "--no-browser",
    ]
    try:
        runpy.run_path(str(server_script), run_name="__main__")
    except SystemExit as exc:
        return int(exc.code or 0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
