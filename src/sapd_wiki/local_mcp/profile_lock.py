"""Cross-process single-writer lock for one certificate profile."""

from __future__ import annotations

import os
import stat
from pathlib import Path
from types import TracebackType


class ProfileLockError(RuntimeError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class ProfileWriterLock:
    """Non-blocking profile lock; observers remain read-only when it is held."""

    def __init__(self, path: Path) -> None:
        if not Path(path).is_absolute() or Path(path).is_symlink():
            raise ProfileLockError("CERTIFICATE_PROFILE_LOCK_UNSAFE")
        self.path = Path(path)
        self._descriptor: int | None = None

    def acquire(self) -> None:
        if self._descriptor is not None:
            raise ProfileLockError("CERTIFICATE_PROFILE_BUSY")
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.path.parent, 0o700)
        descriptor = os.open(
            self.path,
            os.O_RDWR | os.O_CREAT,
            0o600,
        )
        try:
            info = os.fstat(descriptor)
            if (
                not stat.S_ISREG(info.st_mode)
                or info.st_nlink != 1
                or info.st_mode & 0o077
            ):
                raise ProfileLockError("CERTIFICATE_PROFILE_LOCK_UNSAFE")
            if os.name == "nt":
                import msvcrt

                os.lseek(descriptor, 0, os.SEEK_SET)
                try:
                    msvcrt.locking(descriptor, msvcrt.LK_NBLCK, 1)
                except OSError as exc:
                    raise ProfileLockError("CERTIFICATE_PROFILE_BUSY") from exc
            else:
                import fcntl

                try:
                    fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except OSError as exc:
                    raise ProfileLockError("CERTIFICATE_PROFILE_BUSY") from exc
            self._descriptor = descriptor
        except Exception:
            os.close(descriptor)
            raise

    def release(self) -> None:
        descriptor = self._descriptor
        if descriptor is None:
            return
        try:
            if os.name == "nt":
                import msvcrt

                os.lseek(descriptor, 0, os.SEEK_SET)
                msvcrt.locking(descriptor, msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(descriptor, fcntl.LOCK_UN)
        finally:
            os.close(descriptor)
            self._descriptor = None

    def __enter__(self) -> "ProfileWriterLock":
        self.acquire()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        del exc_type, exc, traceback
        self.release()
