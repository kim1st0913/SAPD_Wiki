#!/usr/bin/env python3
"""Extract the seven Chat-mode SAPD V3 Markdown drafts into validated JSON.

The source Markdown files are treated as review candidates, not as an authority
that can overwrite the current OI-197 source text.  This importer preserves
their object-specific proposed criteria, range rationale and source line
locations so the proposal generator can apply consulting review rules without
depending on the Downloads directory at render time.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BASE_GENERATOR = ROOT / "scripts/generate_oi197_review_workbench.py"
DEFAULT_SOURCE = Path("/Users/kim1st/Downloads/SAPD-V3评分依据优化-7个MD")
DEFAULT_OUTPUT = ROOT / "docs/08-maturity/sapd-v3-chat-md-candidates.json"

DETAIL_FILES = [
    "01-SAPD-T-AS基础架构安全-评分依据优化.md",
    "02-SAPD-T-PD被动防御-评分依据优化.md",
    "03-SAPD-T-AD积极防御-评分依据优化.md",
    "04-SAPD-T-IN情报与T-OF进攻-评分依据优化.md",
    "05-SAPD-G-SP安全治理-评分依据优化.md",
    "06-SAPD-M安全管理-评分依据优化.md",
]

DIMENSION_LABELS = {
    "组织与角色": "organization",
    "制度与流程": "process",
    "平台与工具": "tool",
    "数据与信息": "data",
}


def load_base_data() -> dict[str, Any]:
    spec = importlib.util.spec_from_file_location("oi197_base", BASE_GENERATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载 {BASE_GENERATOR}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.build_workbench_data()


def clean_inline(value: str) -> str:
    value = value.strip()
    value = re.sub(r"^\*\*", "", value)
    value = re.sub(r"\*\*$", "", value)
    return value.strip()


def metadata_value(lines: list[str], start: int, end: int, label: str) -> str:
    prefix = f"- **{label}：**"
    for index in range(start, end):
        line = lines[index].strip()
        if line.startswith(prefix):
            return clean_inline(line[len(prefix) :].strip())
    return ""


def paragraph_between(
    lines: list[str],
    start: int,
    end: int,
    marker: str,
    stop_markers: tuple[str, ...],
) -> tuple[str, int]:
    marker_index = -1
    for index in range(start, end):
        if lines[index].strip() == marker:
            marker_index = index
            break
    if marker_index < 0:
        return "", 0

    collected: list[str] = []
    for index in range(marker_index + 1, end):
        stripped = lines[index].strip()
        if stripped in stop_markers:
            break
        if stripped.startswith(("##### ", "###### ", "#### ", "### ", "## ")):
            break
        if not stripped:
            if collected and collected[-1] != "":
                collected.append("")
            continue
        if stripped.startswith(">"):
            stripped = stripped[1:].strip()
        collected.append(stripped)
    while collected and not collected[-1]:
        collected.pop()
    return "\n".join(collected).strip(), marker_index + 1


def parse_detail_file(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    focus_starts: list[tuple[int, str, str]] = []
    focus_pattern = re.compile(r"^##\s+([A-Z](?:-[A-Z]+)+(?:\.[A-Z]+)+-\d+)\s+(.+?)\s*$")
    for index, line in enumerate(lines):
        match = focus_pattern.match(line)
        if match:
            focus_starts.append((index, match.group(1), match.group(2).strip()))

    focuses: dict[str, Any] = {}
    assessments: dict[str, Any] = {}
    for focus_position, (focus_start, focus_code, focus_title) in enumerate(focus_starts):
        focus_end = (
            focus_starts[focus_position + 1][0]
            if focus_position + 1 < len(focus_starts)
            else len(lines)
        )
        assessment_starts: list[tuple[int, str, str]] = []
        for index in range(focus_start + 1, focus_end):
            match = re.match(r"^####\s+(\S+)\s+(.+?)\s*$", lines[index])
            if match:
                assessment_starts.append((index, match.group(1), match.group(2).strip()))

        focus_range = metadata_value(
            lines, focus_start + 1, assessment_starts[0][0] if assessment_starts else focus_end,
            "推荐有效等级范围",
        )
        range_match = re.fullmatch(r"(L[1-5])\s*[—-]\s*(L[1-5])", focus_range)
        if not range_match:
            raise ValueError(f"{path.name}:{focus_start + 1} 无法识别关注点等级范围：{focus_range!r}")
        focus_meta_end = assessment_starts[0][0] if assessment_starts else focus_end
        focuses[focus_code] = {
            "focusCode": focus_code,
            "focusTitle": focus_title,
            "capabilityDomain": metadata_value(lines, focus_start + 1, focus_meta_end, "所属能力域"),
            "securityCapability": metadata_value(lines, focus_start + 1, focus_meta_end, "所属安全能力"),
            "formalTitle": metadata_value(lines, focus_start + 1, focus_meta_end, "正式名称"),
            "capabilityObjective": metadata_value(lines, focus_start + 1, focus_meta_end, "能力目标"),
            "applicability": metadata_value(lines, focus_start + 1, focus_meta_end, "适用性"),
            "levelStart": range_match.group(1),
            "levelEnd": range_match.group(2),
            "rangeRationale": metadata_value(lines, focus_start + 1, focus_meta_end, "等级范围判断"),
            "bestPracticeReferences": metadata_value(
                lines, focus_start + 1, focus_meta_end, "主要最佳实践参考"
            ),
            "sourceFile": path.name,
            "sourceLine": focus_start + 1,
        }

        for assessment_position, (assessment_start, assessment_code, assessment_title) in enumerate(
            assessment_starts
        ):
            assessment_end = (
                assessment_starts[assessment_position + 1][0]
                if assessment_position + 1 < len(assessment_starts)
                else focus_end
            )
            level_starts: list[tuple[int, str]] = []
            for index in range(assessment_start + 1, assessment_end):
                match = re.match(r"^#####\s+Level\s+([1-5])\b", lines[index])
                if match:
                    level_starts.append((index, f"L{match.group(1)}"))
            if len(level_starts) != 5:
                raise ValueError(
                    f"{path.name}:{assessment_start + 1} {assessment_code} 应有 5 个等级段，"
                    f"实际 {len(level_starts)}"
                )

            first_level_start = level_starts[0][0]
            assessment_range = metadata_value(
                lines, assessment_start + 1, first_level_start, "有效等级范围"
            )
            assessment_range_match = re.fullmatch(
                r"(L[1-5])\s*[—-]\s*(L[1-5])", assessment_range
            )
            if not assessment_range_match:
                raise ValueError(
                    f"{path.name}:{assessment_start + 1} {assessment_code} 无法识别等级范围："
                    f"{assessment_range!r}"
                )

            levels: dict[str, Any] = {}
            for level_position, (level_start, level_code) in enumerate(level_starts):
                level_end = (
                    level_starts[level_position + 1][0]
                    if level_position + 1 < len(level_starts)
                    else assessment_end
                )
                dimension_starts: list[tuple[int, str]] = []
                for index in range(level_start + 1, level_end):
                    match = re.match(
                        r"^######\s+(组织与角色|制度与流程|平台与工具|数据与信息)\s*$",
                        lines[index],
                    )
                    if match:
                        dimension_starts.append((index, match.group(1)))

                if not dimension_starts:
                    not_set_lines = [
                        line.strip()[1:].strip()
                        for line in lines[level_start + 1 : level_end]
                        if line.strip().startswith(">")
                    ]
                    levels[level_code] = {
                        "inRange": False,
                        "notSetReason": "\n".join(not_set_lines).strip(),
                        "dimensions": {},
                        "sourceLine": level_start + 1,
                    }
                    continue

                if {name for _, name in dimension_starts} != set(DIMENSION_LABELS):
                    raise ValueError(
                        f"{path.name}:{level_start + 1} {assessment_code} {level_code} "
                        "四维不完整"
                    )
                dimensions: dict[str, Any] = {}
                for dimension_position, (dimension_start, dimension_label) in enumerate(
                    dimension_starts
                ):
                    dimension_end = (
                        dimension_starts[dimension_position + 1][0]
                        if dimension_position + 1 < len(dimension_starts)
                        else level_end
                    )
                    original, _ = paragraph_between(
                        lines,
                        dimension_start + 1,
                        dimension_end,
                        "**原评分依据**",
                        ("**优化后评分依据**",),
                    )
                    proposed, proposed_line = paragraph_between(
                        lines,
                        dimension_start + 1,
                        dimension_end,
                        "**优化后评分依据**",
                        ("**修改说明**",),
                    )
                    reason, _ = paragraph_between(
                        lines,
                        dimension_start + 1,
                        dimension_end,
                        "**修改说明**",
                        (),
                    )
                    if not proposed or not reason:
                        raise ValueError(
                            f"{path.name}:{dimension_start + 1} {assessment_code} "
                            f"{level_code}/{dimension_label} 缺优化文或修改说明"
                        )
                    dimensions[DIMENSION_LABELS[dimension_label]] = {
                        "dimensionName": dimension_label,
                        "candidateOriginalText": original,
                        "candidateProposedText": proposed,
                        "candidateChangeReason": reason,
                        "sourceFile": path.name,
                        "sourceLine": proposed_line,
                    }
                levels[level_code] = {
                    "inRange": True,
                    "notSetReason": "",
                    "dimensions": dimensions,
                    "sourceLine": level_start + 1,
                }

            assessments[assessment_code] = {
                "assessmentCode": assessment_code,
                "assessmentTitle": assessment_title,
                "focusCode": focus_code,
                "assessmentObject": metadata_value(
                    lines, assessment_start + 1, first_level_start, "评估对象"
                ),
                "objectFocus": metadata_value(
                    lines, assessment_start + 1, first_level_start, "对象化重点"
                ),
                "levelStart": assessment_range_match.group(1),
                "levelEnd": assessment_range_match.group(2),
                "levels": levels,
                "sourceFile": path.name,
                "sourceLine": assessment_start + 1,
            }
    return focuses, assessments


def validate(
    focuses: dict[str, Any],
    assessments: dict[str, Any],
    base: dict[str, Any],
) -> dict[str, Any]:
    base_focuses = set(base["focusMappings"])
    candidate_focuses = set(focuses)
    base_assessments = {row["assessmentCode"] for row in base["rows"]}
    candidate_assessments = set(assessments)
    if candidate_focuses != base_focuses:
        raise ValueError(
            f"关注点映射不一致：missing={sorted(base_focuses - candidate_focuses)}, "
            f"extra={sorted(candidate_focuses - base_focuses)}"
        )
    if candidate_assessments != base_assessments:
        raise ValueError(
            f"评估点映射不一致：missing={sorted(base_assessments - candidate_assessments)}, "
            f"extra={sorted(candidate_assessments - base_assessments)}"
        )

    in_range_cells = 0
    out_of_range_cells = 0
    for code, focus in focuses.items():
        start = int(focus["levelStart"][1:])
        end = int(focus["levelEnd"][1:])
        if start > end:
            raise ValueError(f"{code} 等级范围不连续")
    for code, assessment in assessments.items():
        focus = focuses[assessment["focusCode"]]
        if (assessment["levelStart"], assessment["levelEnd"]) != (
            focus["levelStart"],
            focus["levelEnd"],
        ):
            raise ValueError(f"{code} 评估点范围与关注点范围不一致")
        start = int(assessment["levelStart"][1:])
        end = int(assessment["levelEnd"][1:])
        for level_number in range(1, 6):
            level = assessment["levels"][f"L{level_number}"]
            expected = start <= level_number <= end
            if level["inRange"] != expected:
                raise ValueError(f"{code} L{level_number} 范围设置与连续范围不一致")
            if expected:
                in_range_cells += 4
            else:
                out_of_range_cells += 4
    return {
        "focusCount": len(focuses),
        "assessmentCount": len(assessments),
        "cellCount": (in_range_cells + out_of_range_cells),
        "inRangeCellCount": in_range_cells,
        "outOfRangeCellCount": out_of_range_cells,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    focuses: dict[str, Any] = {}
    assessments: dict[str, Any] = {}
    for filename in DETAIL_FILES:
        path = args.source_dir / filename
        if not path.exists():
            raise FileNotFoundError(path)
        file_focuses, file_assessments = parse_detail_file(path)
        overlap_focuses = set(focuses) & set(file_focuses)
        overlap_assessments = set(assessments) & set(file_assessments)
        if overlap_focuses or overlap_assessments:
            raise ValueError(
                f"{filename} 出现重复：focus={sorted(overlap_focuses)}, "
                f"assessment={sorted(overlap_assessments)}"
            )
        focuses.update(file_focuses)
        assessments.update(file_assessments)

    base = load_base_data()
    counts = validate(focuses, assessments, base)
    payload = {
        "schemaVersion": "sapd-v3-chat-md-candidates-v1",
        "sourceType": "CHAT_MODE_REVIEW_CANDIDATES",
        "sourceDirectoryAtImport": str(args.source_dir),
        "sourceFiles": DETAIL_FILES,
        "counts": counts,
        "focuses": focuses,
        "assessments": assessments,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), **counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
