from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.profile_lock import (
    ProfileLockError,
    ProfileWriterLock,
)


class ProfileWriterLockTests(unittest.TestCase):
    def test_only_one_writer_can_hold_a_profile_lock(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "profile.lock"
            first = ProfileWriterLock(path)
            second = ProfileWriterLock(path)
            first.acquire()
            try:
                with self.assertRaises(ProfileLockError) as raised:
                    second.acquire()
                self.assertEqual(
                    raised.exception.code,
                    "CERTIFICATE_PROFILE_BUSY",
                )
            finally:
                first.release()
            second.acquire()
            second.release()


if __name__ == "__main__":
    unittest.main()
