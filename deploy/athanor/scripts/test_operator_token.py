from pathlib import Path
import os
import sys
import tempfile
import unittest
from unittest.mock import patch
import operator_token

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shard"))
from operator_token import read_protected_text, operator_environment


class OperatorTokenTest(unittest.TestCase):
    def test_reads_only_a_regular_owned_0600_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credential"
            value = os.urandom(32).hex()
            path.write_text(value + "\n")
            path.chmod(0o600)
            self.assertTrue(read_protected_text(path) == value + "\n")
            for mode in (0o644, 0o640, 0o666):
                path.chmod(mode)
                with self.assertRaisesRegex(ValueError, "0600"):
                    read_protected_text(path)
            path.chmod(0o600)
            with patch.object(operator_token.os, "geteuid", return_value=os.geteuid() + 1), self.assertRaisesRegex(ValueError, "effective uid"):
                read_protected_text(path)
            alias = Path(directory) / "alias"
            alias.symlink_to(path)
            with self.assertRaisesRegex(ValueError, "unavailable"):
                read_protected_text(alias)

    def test_rejects_invalid_content_without_including_it_in_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credential"
            for value in (b"", b"\xff", b"a b", b"a" * 4097):
                path.write_bytes(value)
                path.chmod(0o600)
                with patch.object(operator_token, "OPERATOR_TOKEN_FILE", path), self.assertRaises(ValueError) as error:
                    operator_environment()
                self.assertTrue("credential" in str(error.exception))
