"""Filesystem custody for local MCP runtime state.

POSIX keeps the existing owner-only mode contract.  Windows uses a native
security descriptor owned by the current user with a protected DACL granting
full control to exactly that user and SYSTEM.  Reparse points and hard-linked
regular files fail closed on both read and mutation paths.
"""

from __future__ import annotations

import os
import secrets
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


WINDOWS_MCP_RELATIVE_ROOT = ("SAPD Wiki", "LocalMCP")
_FILE_ATTRIBUTE_DIRECTORY = 0x10
_FILE_ATTRIBUTE_REPARSE_POINT = 0x400
_INVALID_FILE_ATTRIBUTES = 0xFFFFFFFF
_FILE_ALL_ACCESS = 0x001F01FF
_FILE_TYPE_DISK = 0x0001
_SYSTEM_SID = "S-1-5-18"


class PathSecurityError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True, slots=True)
class WindowsPathInspection:
    exists: bool
    is_directory: bool
    is_regular_file: bool
    is_reparse_point: bool
    hardlink_count: int
    owner_is_current_user: bool
    dacl_is_protected: bool
    current_user_full_control: bool
    system_full_control: bool
    unexpected_ace_count: int

    @property
    def secure_directory(self) -> bool:
        return (
            self.exists
            and self.is_directory
            and not self.is_reparse_point
            and self.owner_is_current_user
            and self.dacl_is_protected
            and self.current_user_full_control
            and self.system_full_control
            and self.unexpected_ace_count == 0
        )

    @property
    def secure_regular_file(self) -> bool:
        return (
            self.exists
            and self.is_regular_file
            and not self.is_reparse_point
            and self.hardlink_count == 1
            and self.owner_is_current_user
            and self.dacl_is_protected
            and self.current_user_full_control
            and self.system_full_control
            and self.unexpected_ace_count == 0
        )


class WindowsPathNativeApi(Protocol):
    def inspect(self, path: Path) -> WindowsPathInspection: ...

    def protect(self, path: Path) -> None: ...


class CtypesWindowsPathNativeApi:
    """Narrow Win32 bridge for file attributes, owner and protected DACL."""

    _OWNER_SECURITY_INFORMATION = 0x00000001
    _DACL_SECURITY_INFORMATION = 0x00000004
    _PROTECTED_DACL_SECURITY_INFORMATION = 0x80000000
    _SE_DACL_PROTECTED = 0x1000
    _TOKEN_QUERY = 0x0008
    _TOKEN_USER = 1
    _ERROR_INSUFFICIENT_BUFFER = 122
    _SDDL_REVISION_1 = 1
    _ACCESS_ALLOWED_ACE_TYPE = 0
    _OPEN_EXISTING = 3
    _FILE_READ_ATTRIBUTES = 0x80
    _FILE_SHARE_ALL = 0x7
    _FILE_FLAG_BACKUP_SEMANTICS = 0x02000000
    _FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000

    def __init__(self) -> None:
        if os.name != "nt":
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        try:
            import ctypes
            from ctypes import wintypes

            class SidAndAttributes(ctypes.Structure):
                _fields_ = (
                    ("Sid", ctypes.c_void_p),
                    ("Attributes", wintypes.DWORD),
                )

            class TokenUser(ctypes.Structure):
                _fields_ = (("User", SidAndAttributes),)

            class AccessAllowedAce(ctypes.Structure):
                _fields_ = (
                    ("AceType", ctypes.c_ubyte),
                    ("AceFlags", ctypes.c_ubyte),
                    ("AceSize", wintypes.WORD),
                    ("Mask", wintypes.DWORD),
                    ("SidStart", wintypes.DWORD),
                )

            class AclSizeInformation(ctypes.Structure):
                _fields_ = (
                    ("AceCount", wintypes.DWORD),
                    ("AclBytesInUse", wintypes.DWORD),
                    ("AclBytesFree", wintypes.DWORD),
                )

            class ByHandleFileInformation(ctypes.Structure):
                _fields_ = (
                    ("dwFileAttributes", wintypes.DWORD),
                    ("ftCreationTime", wintypes.FILETIME),
                    ("ftLastAccessTime", wintypes.FILETIME),
                    ("ftLastWriteTime", wintypes.FILETIME),
                    ("dwVolumeSerialNumber", wintypes.DWORD),
                    ("nFileSizeHigh", wintypes.DWORD),
                    ("nFileSizeLow", wintypes.DWORD),
                    ("nNumberOfLinks", wintypes.DWORD),
                    ("nFileIndexHigh", wintypes.DWORD),
                    ("nFileIndexLow", wintypes.DWORD),
                )

            advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
            kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
            advapi32.OpenProcessToken.argtypes = (
                wintypes.HANDLE,
                wintypes.DWORD,
                ctypes.POINTER(wintypes.HANDLE),
            )
            advapi32.OpenProcessToken.restype = wintypes.BOOL
            advapi32.GetTokenInformation.argtypes = (
                wintypes.HANDLE,
                ctypes.c_uint,
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.POINTER(wintypes.DWORD),
            )
            advapi32.GetTokenInformation.restype = wintypes.BOOL
            advapi32.ConvertSidToStringSidW.argtypes = (
                ctypes.c_void_p,
                ctypes.POINTER(wintypes.LPWSTR),
            )
            advapi32.ConvertSidToStringSidW.restype = wintypes.BOOL
            advapi32.ConvertStringSidToSidW.argtypes = (
                wintypes.LPCWSTR,
                ctypes.POINTER(ctypes.c_void_p),
            )
            advapi32.ConvertStringSidToSidW.restype = wintypes.BOOL
            advapi32.EqualSid.argtypes = (ctypes.c_void_p, ctypes.c_void_p)
            advapi32.EqualSid.restype = wintypes.BOOL
            advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = (
                wintypes.LPCWSTR,
                wintypes.DWORD,
                ctypes.POINTER(ctypes.c_void_p),
                ctypes.POINTER(wintypes.DWORD),
            )
            advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW.restype = (
                wintypes.BOOL
            )
            advapi32.SetFileSecurityW.argtypes = (
                wintypes.LPCWSTR,
                wintypes.DWORD,
                ctypes.c_void_p,
            )
            advapi32.SetFileSecurityW.restype = wintypes.BOOL
            advapi32.GetFileSecurityW.argtypes = (
                wintypes.LPCWSTR,
                wintypes.DWORD,
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.POINTER(wintypes.DWORD),
            )
            advapi32.GetFileSecurityW.restype = wintypes.BOOL
            advapi32.GetSecurityDescriptorOwner.argtypes = (
                ctypes.c_void_p,
                ctypes.POINTER(ctypes.c_void_p),
                ctypes.POINTER(wintypes.BOOL),
            )
            advapi32.GetSecurityDescriptorOwner.restype = wintypes.BOOL
            advapi32.GetSecurityDescriptorDacl.argtypes = (
                ctypes.c_void_p,
                ctypes.POINTER(wintypes.BOOL),
                ctypes.POINTER(ctypes.c_void_p),
                ctypes.POINTER(wintypes.BOOL),
            )
            advapi32.GetSecurityDescriptorDacl.restype = wintypes.BOOL
            advapi32.GetSecurityDescriptorControl.argtypes = (
                ctypes.c_void_p,
                ctypes.POINTER(wintypes.WORD),
                ctypes.POINTER(wintypes.DWORD),
            )
            advapi32.GetSecurityDescriptorControl.restype = wintypes.BOOL
            advapi32.GetAclInformation.argtypes = (
                ctypes.c_void_p,
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.c_uint,
            )
            advapi32.GetAclInformation.restype = wintypes.BOOL
            advapi32.GetAce.argtypes = (
                ctypes.c_void_p,
                wintypes.DWORD,
                ctypes.POINTER(ctypes.c_void_p),
            )
            advapi32.GetAce.restype = wintypes.BOOL
            kernel32.GetFileAttributesW.argtypes = (wintypes.LPCWSTR,)
            kernel32.GetFileAttributesW.restype = wintypes.DWORD
            kernel32.CreateFileW.argtypes = (
                wintypes.LPCWSTR,
                wintypes.DWORD,
                wintypes.DWORD,
                ctypes.c_void_p,
                wintypes.DWORD,
                wintypes.DWORD,
                wintypes.HANDLE,
            )
            kernel32.CreateFileW.restype = wintypes.HANDLE
            kernel32.GetFileInformationByHandle.argtypes = (
                wintypes.HANDLE,
                ctypes.POINTER(ByHandleFileInformation),
            )
            kernel32.GetFileInformationByHandle.restype = wintypes.BOOL
            kernel32.GetFileType.argtypes = (wintypes.HANDLE,)
            kernel32.GetFileType.restype = wintypes.DWORD
            kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
            kernel32.CloseHandle.restype = wintypes.BOOL
            kernel32.GetCurrentProcess.restype = wintypes.HANDLE
            kernel32.LocalFree.argtypes = (ctypes.c_void_p,)
            kernel32.LocalFree.restype = ctypes.c_void_p
        except (AttributeError, OSError) as exc:
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE") from exc
        self._ctypes = ctypes
        self._wintypes = wintypes
        self._SidAndAttributes = SidAndAttributes
        self._TokenUser = TokenUser
        self._AccessAllowedAce = AccessAllowedAce
        self._AclSizeInformation = AclSizeInformation
        self._ByHandleFileInformation = ByHandleFileInformation
        self._advapi32 = advapi32
        self._kernel32 = kernel32
        self._current_user_sid = self._current_user_sid_string()

    def _current_user_sid_string(self) -> str:
        token = self._wintypes.HANDLE()
        if not self._advapi32.OpenProcessToken(
            self._kernel32.GetCurrentProcess(),
            self._TOKEN_QUERY,
            self._ctypes.byref(token),
        ):
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        try:
            required = self._wintypes.DWORD()
            self._advapi32.GetTokenInformation(
                token,
                self._TOKEN_USER,
                None,
                0,
                self._ctypes.byref(required),
            )
            if (
                self._ctypes.get_last_error() != self._ERROR_INSUFFICIENT_BUFFER
                or required.value == 0
            ):
                raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
            buffer = self._ctypes.create_string_buffer(required.value)
            if not self._advapi32.GetTokenInformation(
                token,
                self._TOKEN_USER,
                buffer,
                required,
                self._ctypes.byref(required),
            ):
                raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
            token_user = self._ctypes.cast(
                buffer,
                self._ctypes.POINTER(self._TokenUser),
            ).contents
            text = self._wintypes.LPWSTR()
            if not self._advapi32.ConvertSidToStringSidW(
                token_user.User.Sid,
                self._ctypes.byref(text),
            ):
                raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
            try:
                return str(text.value)
            finally:
                self._kernel32.LocalFree(text)
        finally:
            self._kernel32.CloseHandle(token)

    def _sid(self, value: str):
        pointer = self._ctypes.c_void_p()
        if not self._advapi32.ConvertStringSidToSidW(
            value,
            self._ctypes.byref(pointer),
        ):
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        return pointer

    def _security_descriptor(self, path: Path):
        information = (
            self._OWNER_SECURITY_INFORMATION | self._DACL_SECURITY_INFORMATION
        )
        required = self._wintypes.DWORD()
        self._advapi32.GetFileSecurityW(
            str(path),
            information,
            None,
            0,
            self._ctypes.byref(required),
        )
        if (
            self._ctypes.get_last_error() != self._ERROR_INSUFFICIENT_BUFFER
            or required.value == 0
        ):
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        descriptor = self._ctypes.create_string_buffer(required.value)
        if not self._advapi32.GetFileSecurityW(
            str(path),
            information,
            descriptor,
            required,
            self._ctypes.byref(required),
        ):
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        return descriptor

    def inspect(self, path: Path) -> WindowsPathInspection:
        attributes = self._kernel32.GetFileAttributesW(str(path))
        if attributes == _INVALID_FILE_ATTRIBUTES:
            return WindowsPathInspection(
                False, False, False, False, 0, False, False, False, False, 0
            )
        is_directory = bool(attributes & _FILE_ATTRIBUTE_DIRECTORY)
        is_reparse = bool(attributes & _FILE_ATTRIBUTE_REPARSE_POINT)
        handle = self._kernel32.CreateFileW(
            str(path),
            self._FILE_READ_ATTRIBUTES,
            self._FILE_SHARE_ALL,
            None,
            self._OPEN_EXISTING,
            self._FILE_FLAG_BACKUP_SEMANTICS
            | self._FILE_FLAG_OPEN_REPARSE_POINT,
            None,
        )
        if handle == self._wintypes.HANDLE(-1).value:
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        try:
            file_info = self._ByHandleFileInformation()
            if not self._kernel32.GetFileInformationByHandle(
                handle,
                self._ctypes.byref(file_info),
            ):
                raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
            hardlinks = int(file_info.nNumberOfLinks)
            is_disk = self._kernel32.GetFileType(handle) == _FILE_TYPE_DISK
        finally:
            self._kernel32.CloseHandle(handle)

        descriptor = self._security_descriptor(path)
        owner = self._ctypes.c_void_p()
        owner_defaulted = self._wintypes.BOOL()
        if not self._advapi32.GetSecurityDescriptorOwner(
            descriptor,
            self._ctypes.byref(owner),
            self._ctypes.byref(owner_defaulted),
        ):
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        current_sid = self._sid(self._current_user_sid)
        system_sid = self._sid(_SYSTEM_SID)
        try:
            owner_is_current = bool(self._advapi32.EqualSid(owner, current_sid))
            dacl_present = self._wintypes.BOOL()
            dacl = self._ctypes.c_void_p()
            dacl_defaulted = self._wintypes.BOOL()
            if not self._advapi32.GetSecurityDescriptorDacl(
                descriptor,
                self._ctypes.byref(dacl_present),
                self._ctypes.byref(dacl),
                self._ctypes.byref(dacl_defaulted),
            ):
                raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
            control = self._wintypes.WORD()
            revision = self._wintypes.DWORD()
            if not self._advapi32.GetSecurityDescriptorControl(
                descriptor,
                self._ctypes.byref(control),
                self._ctypes.byref(revision),
            ):
                raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
            current_full = False
            system_full = False
            unexpected = 0
            if not dacl_present or not dacl:
                unexpected = 1
            else:
                size = self._AclSizeInformation()
                if not self._advapi32.GetAclInformation(
                    dacl,
                    self._ctypes.byref(size),
                    self._ctypes.sizeof(size),
                    2,
                ):
                    raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
                for index in range(size.AceCount):
                    ace_pointer = self._ctypes.c_void_p()
                    if not self._advapi32.GetAce(
                        dacl,
                        index,
                        self._ctypes.byref(ace_pointer),
                    ):
                        raise PathSecurityError(
                            "WINDOWS_PATH_SECURITY_UNAVAILABLE"
                        )
                    ace = self._ctypes.cast(
                        ace_pointer,
                        self._ctypes.POINTER(self._AccessAllowedAce),
                    ).contents
                    sid = self._ctypes.c_void_p(
                        ace_pointer.value
                        + self._AccessAllowedAce.SidStart.offset
                    )
                    is_full = (int(ace.Mask) & _FILE_ALL_ACCESS) == _FILE_ALL_ACCESS
                    if (
                        ace.AceType == self._ACCESS_ALLOWED_ACE_TYPE
                        and is_full
                        and self._advapi32.EqualSid(sid, current_sid)
                    ):
                        current_full = True
                    elif (
                        ace.AceType == self._ACCESS_ALLOWED_ACE_TYPE
                        and is_full
                        and self._advapi32.EqualSid(sid, system_sid)
                    ):
                        system_full = True
                    else:
                        unexpected += 1
            return WindowsPathInspection(
                exists=True,
                is_directory=is_directory,
                is_regular_file=(
                    is_disk and not is_directory and not is_reparse
                ),
                is_reparse_point=is_reparse,
                hardlink_count=hardlinks,
                owner_is_current_user=owner_is_current,
                dacl_is_protected=bool(control.value & self._SE_DACL_PROTECTED),
                current_user_full_control=current_full,
                system_full_control=system_full,
                unexpected_ace_count=unexpected,
            )
        finally:
            self._kernel32.LocalFree(current_sid)
            self._kernel32.LocalFree(system_sid)

    def protect(self, path: Path) -> None:
        inspection = self.inspect(path)
        if (
            not inspection.exists
            or inspection.is_reparse_point
            or (not inspection.is_directory and inspection.hardlink_count != 1)
        ):
            raise PathSecurityError("PATH_FILE_UNSAFE")
        inheritance = "OICI" if inspection.is_directory else ""
        sddl = (
            f"O:{self._current_user_sid}"
            f"D:P(A;{inheritance};FA;;;{self._current_user_sid})"
            f"(A;{inheritance};FA;;;SY)"
        )
        descriptor = self._ctypes.c_void_p()
        if not self._advapi32.ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl,
            self._SDDL_REVISION_1,
            self._ctypes.byref(descriptor),
            None,
        ):
            raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        try:
            information = (
                self._OWNER_SECURITY_INFORMATION
                | self._DACL_SECURITY_INFORMATION
                | self._PROTECTED_DACL_SECURITY_INFORMATION
            )
            if not self._advapi32.SetFileSecurityW(
                str(path),
                information,
                descriptor,
            ):
                raise PathSecurityError("WINDOWS_PATH_SECURITY_UNAVAILABLE")
        finally:
            self._kernel32.LocalFree(descriptor)


def windows_fixed_mcp_root(
    *,
    local_app_data: str | Path | None = None,
) -> Path:
    value = local_app_data or os.environ.get("LOCALAPPDATA")
    if not value:
        raise PathSecurityError("WINDOWS_LOCALAPPDATA_REQUIRED")
    root = Path(value)
    if not root.is_absolute():
        raise PathSecurityError("WINDOWS_MCP_ROOT_UNSAFE")
    return root.joinpath(*WINDOWS_MCP_RELATIVE_ROOT)


def assert_windows_mcp_descendant(
    path: Path,
    *,
    local_app_data: str | Path | None = None,
) -> Path:
    candidate = Path(path)
    expected = windows_fixed_mcp_root(local_app_data=local_app_data)
    if not candidate.is_absolute():
        raise PathSecurityError("WINDOWS_MCP_ROOT_UNSAFE")
    normalized = Path(os.path.normcase(os.path.abspath(candidate)))
    normalized_expected = Path(os.path.normcase(os.path.abspath(expected)))
    try:
        relative = normalized.relative_to(normalized_expected)
    except ValueError as exc:
        raise PathSecurityError("WINDOWS_MCP_ROOT_UNSAFE") from exc
    if not relative.parts:
        return normalized
    if any(part in {"", ".", ".."} for part in relative.parts):
        raise PathSecurityError("WINDOWS_MCP_ROOT_UNSAFE")
    return normalized


def _native(
    value: WindowsPathNativeApi | None = None,
) -> WindowsPathNativeApi:
    return value or CtypesWindowsPathNativeApi()


def _fixed_windows_components(
    candidate: Path,
    *,
    required: bool,
) -> tuple[Path, list[Path]] | None:
    try:
        boundary = assert_windows_mcp_descendant(windows_fixed_mcp_root())
        normalized = assert_windows_mcp_descendant(candidate)
    except PathSecurityError:
        if required:
            raise
        return None
    relative = normalized.relative_to(boundary)
    components = [boundary.parent, boundary]
    cursor = boundary
    for part in relative.parts:
        cursor = cursor / part
        components.append(cursor)
    return boundary.parents[1], components


def assert_secure_directory(
    path: Path,
    *,
    native_api: WindowsPathNativeApi | None = None,
    require_fixed_windows_mcp_root: bool = False,
) -> Path:
    candidate = Path(path)
    if not candidate.is_absolute() or candidate.is_symlink():
        raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
    if os.name == "nt" or native_api is not None:
        native = _native(native_api)
        fixed = _fixed_windows_components(
            candidate,
            required=require_fixed_windows_mcp_root,
        )
        if fixed is None:
            components = [candidate]
        else:
            local_app_data, components = fixed
            local_info = native.inspect(local_app_data)
            if (
                not local_info.exists
                or not local_info.is_directory
                or local_info.is_reparse_point
            ):
                raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
        if any(
            not native.inspect(component).secure_directory
            for component in components
        ):
            raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
        return components[-1]
    try:
        resolved = candidate.resolve(strict=True)
        info = resolved.stat()
    except OSError as exc:
        raise PathSecurityError("PATH_DIRECTORY_UNSAFE") from exc
    if (
        resolved != candidate.resolve(strict=False)
        or not stat.S_ISDIR(info.st_mode)
        or info.st_mode & 0o077
    ):
        raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
    return resolved


def ensure_secure_directory(
    path: Path,
    *,
    native_api: WindowsPathNativeApi | None = None,
    require_fixed_windows_mcp_root: bool = False,
) -> Path:
    candidate = Path(path)
    if not candidate.is_absolute() or candidate.is_symlink():
        raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
    if os.name == "nt" or native_api is not None:
        native = _native(native_api)
        fixed = _fixed_windows_components(
            candidate,
            required=require_fixed_windows_mcp_root,
        )
        if fixed is not None:
            local_app_data, components = fixed
            local_info = native.inspect(local_app_data)
            if (
                not local_info.exists
                or not local_info.is_directory
                or local_info.is_reparse_point
            ):
                raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
            for directory in components:
                inspection = native.inspect(directory)
                if inspection.exists and (
                    inspection.is_reparse_point
                    or not inspection.is_directory
                ):
                    raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
                if not inspection.exists:
                    directory.mkdir()
                native.protect(directory)
                if not native.inspect(directory).secure_directory:
                    raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
            return components[-1]
        missing: list[Path] = []
        cursor = candidate
        while True:
            inspection = native.inspect(cursor)
            if inspection.exists:
                if inspection.is_reparse_point or not inspection.is_directory:
                    raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
                break
            missing.append(cursor)
            if cursor.parent == cursor:
                raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
            cursor = cursor.parent
        for directory in reversed(missing):
            directory.mkdir()
            native.protect(directory)
            if not native.inspect(directory).secure_directory:
                raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
        native.protect(candidate)
        if not native.inspect(candidate).secure_directory:
            raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
        return candidate
    candidate.mkdir(mode=0o700, parents=True, exist_ok=True)
    resolved = candidate.resolve(strict=True)
    info = resolved.stat()
    if (
        not stat.S_ISDIR(info.st_mode)
        or info.st_mode & 0o077
        or resolved.is_symlink()
    ):
        raise PathSecurityError("PATH_DIRECTORY_UNSAFE")
    os.chmod(resolved, 0o700)
    return resolved


def assert_secure_regular_file(
    path: Path,
    *,
    native_api: WindowsPathNativeApi | None = None,
) -> None:
    candidate = Path(path)
    if candidate.is_symlink():
        raise PathSecurityError("PATH_FILE_UNSAFE")
    if os.name == "nt" or native_api is not None:
        native = _native(native_api)
        fixed = _fixed_windows_components(
            candidate.parent,
            required=False,
        )
        if fixed is not None:
            local_app_data, components = fixed
            local_info = native.inspect(local_app_data)
            if (
                not local_info.exists
                or not local_info.is_directory
                or local_info.is_reparse_point
                or any(
                    not native.inspect(component).secure_directory
                    for component in components
                )
            ):
                raise PathSecurityError("PATH_FILE_UNSAFE")
        inspection = native.inspect(candidate)
        if not inspection.exists:
            raise PathSecurityError("PATH_FILE_MISSING")
        if not inspection.secure_regular_file:
            raise PathSecurityError("PATH_FILE_UNSAFE")
        return
    try:
        info = candidate.stat()
    except FileNotFoundError as exc:
        raise PathSecurityError("PATH_FILE_MISSING") from exc
    if (
        not stat.S_ISREG(info.st_mode)
        or info.st_nlink != 1
        or info.st_mode & 0o077
    ):
        raise PathSecurityError("PATH_FILE_UNSAFE")


def protect_regular_file(
    path: Path,
    *,
    native_api: WindowsPathNativeApi | None = None,
) -> None:
    candidate = Path(path)
    if os.name == "nt" or native_api is not None:
        native = _native(native_api)
        before = native.inspect(candidate)
        if (
            not before.exists
            or before.is_reparse_point
            or not before.is_regular_file
            or before.hardlink_count != 1
        ):
            raise PathSecurityError("PATH_FILE_UNSAFE")
        native.protect(candidate)
        assert_secure_regular_file(candidate, native_api=native)
        return
    os.chmod(candidate, 0o600)
    assert_secure_regular_file(candidate)


def atomic_write_secure(
    path: Path,
    payload: bytes,
    *,
    native_api: WindowsPathNativeApi | None = None,
) -> None:
    target = Path(path)
    ensure_secure_directory(target.parent, native_api=native_api)
    temporary = target.with_name(
        f".{target.name}.{secrets.token_urlsafe(8)}.tmp"
    )
    descriptor = os.open(
        temporary,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL,
        0o600,
    )
    try:
        os.write(descriptor, payload)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    try:
        protect_regular_file(temporary, native_api=native_api)
        os.replace(temporary, target)
        protect_regular_file(target, native_api=native_api)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
