from pathlib import Path
import os
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "shard"))
from operator_token import read_operator_token


class OperatorTokenTest(unittest.TestCase):
    def test_reads_only_a_regular_owned_0600_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credential"
            value = os.urandom(32).hex()
            path.write_text(value + "\n")
            path.chmod(0o600)
            self.assertTrue(read_operator_token(path) == value)
            for mode in (0o644, 0o640, 0o666):
                path.chmod(mode)
                with self.assertRaisesRegex(ValueError, "0600"):
                    read_operator_token(path)
            path.chmod(0o600)
            with self.assertRaisesRegex(ValueError, "deployment owner"):
                read_operator_token(path, os.geteuid() + 1)
            alias = Path(directory) / "alias"
            alias.symlink_to(path)
            with self.assertRaisesRegex(ValueError, "unavailable"):
                read_operator_token(alias)

    def test_rejects_invalid_content_without_including_it_in_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credential"
            for value in (b"", b"\xff", b"a b", b"a" * 4097):
                path.write_bytes(value)
                path.chmod(0o600)
                with self.assertRaises(ValueError) as error:
                    read_operator_token(path)
                self.assertTrue(str(error.exception).startswith("Operator credential"))
