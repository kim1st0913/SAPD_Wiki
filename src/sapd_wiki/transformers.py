from __future__ import annotations

import re

from .candidates import normalize_text


CODE_AT_END_RE = re.compile(r"^(?P<title>.+?)\s+(?P<code>[A-Z]{1,3}(?:-[A-Z]{2,3})+(?:\.[A-Z]{2})?(?:-\d{2})?)$")
CODE_AT_START_RE = re.compile(r"^(?P<code>[A-Z]{1,3}(?:-[A-Z]{2,3})*(?:\.[A-Z]{2})?(?:-\d{2})?)\s*(?P<title>.*)$")
SERVICE_CODE_RE = re.compile(r"^(?P<code>(?:[A-Z]{1,3}-[A-Z]{2,3}|ALL)&[A-Z]{1,3}(?:-[A-Z]{2,3})+\.[A-Z]{2}-\d{2})\s*(?P<title>.*)$")
SERVICE_CODE_SHORT_FOCUS_RE = re.compile(
    r"^(?P<scope>(?:[A-Z]{1,3}-[A-Z]{2,3}|ALL))&(?P<focus>(?:(?:[GMT])-)?[A-Z]{2,3}(?:-[A-Z]{2,3})?\.[A-Z]{2}-\d{2})\s*(?P<title>.*)$"
)
REPEATED_TRAILING_PAREN_RE = re.compile(r"^(?P<prefix>.+?)(?P<paren>（[^（）]+）)(?P=paren)$")
PROTECTED_SLASH_TERMS = {
    "CI/CD",
    "CI/CD流水线",
}


def is_blank_or_placeholder(value: object) -> bool:
    text = normalize_text(value)
    return not text or text in {"/", "-", "—", "...", "…"}


def split_multivalue_text(value: object, *, split_on_ideographic_comma: bool = True) -> list[str]:
    text = str(value or "").replace("\xa0", " ").strip()
    if is_blank_or_placeholder(text):
        return []
    normalized = text.replace("；", "\n").replace(";", "\n")
    if split_on_ideographic_comma:
        normalized = normalized.replace("、", "\n")
    values: list[str] = []
    for line in normalized.splitlines():
        item = normalize_text(line)
        if not item or is_blank_or_placeholder(item) or item.endswith((":", "：")):
            continue
        values.append(item)
    return values


def normalize_scope_code_text(value: str) -> str:
    return (
        normalize_text(value)
        .replace("I_US", "I-US")
        .replace("&T-TI.", "&T-IN.")
        .replace("&TI.", "&T-IN.")
    )


def split_code_title(value: object) -> tuple[str | None, str]:
    text = normalize_scope_code_text(normalize_text(value))
    if not text:
        return None, ""

    if text in PROTECTED_SLASH_TERMS or any(text.startswith(f"{term} ") for term in PROTECTED_SLASH_TERMS):
        return None, text
    if re.match(r"(?i)^N/A\s*[（(]", text):
        return None, text

    service_match = SERVICE_CODE_RE.match(text)
    if service_match:
        return service_match.group("code"), service_match.group("title").strip()

    short_service_match = SERVICE_CODE_SHORT_FOCUS_RE.match(text)
    if short_service_match:
        focus_code = short_service_match.group("focus")
        if not re.match(r"^[GMT]-", focus_code):
            focus_code = f"T-{focus_code}"
        return f"{short_service_match.group('scope')}&{focus_code}", short_service_match.group("title").strip()

    start_match = CODE_AT_START_RE.match(text)
    if start_match and start_match.group("title"):
        return start_match.group("code"), start_match.group("title").strip()

    end_match = CODE_AT_END_RE.match(text)
    if end_match:
        return end_match.group("code"), end_match.group("title").strip()

    return None, text


def normalize_service_title(value: object) -> str:
    title = normalize_text(value)
    while True:
        match = REPEATED_TRAILING_PAREN_RE.match(title)
        if not match:
            return title
        title = f"{match.group('prefix')}{match.group('paren')}"


def split_scope_values(value: object) -> list[tuple[str | None, str]]:
    text = normalize_scope_code_text(normalize_text(value))
    if not text:
        return []
    pattern = re.compile(r"([A-Z]{1,3}-[A-Z]{2,3}(?:\.[A-Z]{2})?)\s+")
    matches = list(pattern.finditer(text))
    if not matches:
        return [split_code_title(text)]

    values: list[tuple[str | None, str]] = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        chunk = text[start:end].strip()
        values.append(split_code_title(chunk))
    return values


def service_parts(value: object, fallback_scope_code: str | None = None, fallback_focus_code: str | None = None) -> dict[str, str | None]:
    code, title = split_code_title(value)
    scope_code = fallback_scope_code
    focus_code = fallback_focus_code
    if code and "&" in code:
        left, right = code.split("&", 1)
        scope_code = left
        focus_code = right
    return {
        "code": code,
        "title": title,
        "scope_code": scope_code,
        "capability_focus_code": focus_code,
    }
