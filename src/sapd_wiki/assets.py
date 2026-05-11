from __future__ import annotations

from pathlib import Path
from typing import Any

from .excel_reader import _load_openpyxl
from .paths import resolve_project_path


def extract_excel_sheet_images(
    workbook_path: str | Path,
    sheet_name: str,
    output_dir: str | Path = "data/previews/second-batch-assets",
) -> list[dict[str, Any]]:
    """Extract embedded images from one Excel sheet into a local ignored folder."""
    load_workbook = _load_openpyxl()
    output_path = resolve_project_path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    workbook = load_workbook(resolve_project_path(workbook_path), read_only=False, data_only=True)
    try:
        if sheet_name not in workbook.sheetnames:
            return []

        worksheet = workbook[sheet_name]
        assets: list[dict[str, Any]] = []
        for index, image in enumerate(getattr(worksheet, "_images", []), start=1):
            anchor = getattr(image, "anchor", None)
            anchor_from = getattr(anchor, "_from", None)
            row = getattr(anchor_from, "row", 0) + 1 if anchor_from else None
            column = getattr(anchor_from, "col", 0) + 1 if anchor_from else None
            image_format = (getattr(image, "format", None) or "png").lower()
            file_name = f"{sheet_name}-{row or 'unknown'}-{column or 'unknown'}-{index}.{image_format}"
            safe_file_name = "".join(ch if ch.isalnum() or ch in ".-_" else "-" for ch in file_name)
            file_path = output_path / safe_file_name
            file_path.write_bytes(image._data())
            assets.append(
                {
                    "title": f"{sheet_name}图片",
                    "source_sheet": sheet_name,
                    "source_row": row,
                    "source_column": column,
                    "anchor": f"R{row}C{column}" if row and column else None,
                    "file_name": safe_file_name,
                    "path": str(file_path),
                    "format": image_format,
                }
            )
        return assets
    finally:
        workbook.close()
