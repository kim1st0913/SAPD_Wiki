#!/usr/bin/env python3
from __future__ import annotations

import gc
import sys
import unittest
import warnings
from collections.abc import Sequence
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "src"


def main(argv: Sequence[str] | None = None) -> int:
    arguments = list(argv if argv is not None else sys.argv[1:])
    for import_root in (PROJECT_ROOT, SOURCE_ROOT):
        try:
            sys.path.remove(str(import_root))
        except ValueError:
            pass
    sys.path.insert(0, str(SOURCE_ROOT))
    sys.path.insert(0, str(PROJECT_ROOT))
    unraisable_resource_warnings: list[str] = []
    previous_unraisable_hook = sys.unraisablehook

    def capture_unraisable(unraisable: object) -> None:
        exception = getattr(unraisable, "exc_value", None)
        if isinstance(exception, ResourceWarning):
            unraisable_resource_warnings.append(str(exception))
            return
        previous_unraisable_hook(unraisable)

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", ResourceWarning)
        sys.unraisablehook = capture_unraisable
        try:
            program = unittest.main(
                module=None,
                argv=[sys.argv[0], *arguments],
                exit=False,
            )
            gc.collect()
        finally:
            sys.unraisablehook = previous_unraisable_hook

    resource_warnings = [
        warning
        for warning in caught
        if issubclass(warning.category, ResourceWarning)
    ]
    if resource_warnings or unraisable_resource_warnings:
        print(
            "ResourceWarning gate detected unclosed resources:",
            file=sys.stderr,
        )
        for warning in resource_warnings:
            print(
                warnings.formatwarning(
                    warning.message,
                    warning.category,
                    warning.filename,
                    warning.lineno,
                ).rstrip(),
                file=sys.stderr,
            )
        for message in unraisable_resource_warnings:
            print(f"ResourceWarning: {message}", file=sys.stderr)
        return 1
    return 0 if program.result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
