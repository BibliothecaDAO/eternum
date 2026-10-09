from pathlib import Path
import os
import tempfile
import unittest
from unittest.mock import patch
import importlib.util
import shard
import operator_token

spec = importlib.util.spec_from_file_location("shard_operator", Path(__file__).with_name("operator-command.py"))
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)


class OperatorCredentialTest(unittest.TestCase):
    def test_the_protected_file_supplies_only_the_child_environment_never_arguments(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "staging").mkdir()
            token = root / "staging/operator-token"
            token.write_text("fixture-credential\n")
            token.chmod(0o600)
            with patch.object(operator_token, "OPERATOR_TOKEN_FILE", token), patch.object(operator.os, "execve") as execute:
                operator.run("deploy", ["staging", "/srv/shard"])
                self.assertNotIn("OPERATOR_TOKEN_FILE", operator_token.operator_environment())
            _, arguments, environment = execute.call_args.args
            self.assertNotIn("fixture-credential", " ".join(arguments))
            self.assertEqual(arguments[-2:], ["staging", "/srv/shard"])
            self.assertEqual(environment["OPERATOR_TOKEN"], "fixture-credential")

    def test_group_readable_foreign_owned_and_symlinked_tokens_are_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "operator-token"
            path.write_text("fixture-credential")
            path.chmod(0o640)
            with self.assertRaisesRegex(ValueError, "0600"):
                shard.read_protected_text(path)
            path.chmod(0o600)
            with patch.object(shard.os, "geteuid", return_value=os.geteuid() + 1), self.assertRaises(ValueError):
                shard.read_protected_text(path)
            link = path.with_name("link")
            link.symlink_to(path)
            with self.assertRaises(ValueError):
                shard.read_protected_text(link)

    def test_a_command_cannot_escape_the_allowed_script_list(self):
        with self.assertRaises(ValueError):
            operator.run("../other", ["/srv/shard"])
