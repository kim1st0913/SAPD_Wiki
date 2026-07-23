"""Stable errors raised by the local MCP knowledge core."""

from __future__ import annotations


class McpCoreError(ValueError):
    """A fail-closed error safe to translate at an adapter boundary."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class ContractError(McpCoreError):
    def __init__(self, message: str) -> None:
        super().__init__("POLICY_BLOCKED", message)


class RuntimeBoundaryError(McpCoreError):
    def __init__(self, message: str) -> None:
        super().__init__("POLICY_BLOCKED", message)


class InvalidInputError(McpCoreError):
    def __init__(self, message: str) -> None:
        super().__init__("INVALID_INPUT", message)


class ObjectNotAvailableError(McpCoreError):
    def __init__(self, message: str = "object is not available") -> None:
        super().__init__("OBJECT_NOT_AVAILABLE", message)


class CursorStaleError(McpCoreError):
    def __init__(self, message: str = "cursor is stale") -> None:
        super().__init__("CURSOR_STALE", message)


class ResponseTooLargeError(McpCoreError):
    def __init__(self, message: str = "response exceeds the configured limit") -> None:
        super().__init__("RESPONSE_TOO_LARGE", message)


class PolicyBlockedError(McpCoreError):
    def __init__(self, message: str, code: str = "POLICY_BLOCKED") -> None:
        super().__init__(code, message)
