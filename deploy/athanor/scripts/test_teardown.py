import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

import teardown

spec = importlib.util.spec_from_file_location("operator_command", Path(__file__).with_name("operator-command.py"))
operator_command = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator_command)


class TeardownBoundaryTest(unittest.TestCase):
    def test_other_environments_are_refused_before_credentials_or_files(self):
        for environment in ("production", "staging", "", "dev/../production"):
            with self.subTest(environment=environment), patch.object(operator_command, "operator_environment") as credential:
                with self.assertRaisesRegex(ValueError, "only for dev"):
                    operator_command.run("teardown", [environment])
                credential.assert_not_called()
            with patch.object(teardown.Path, "mkdir") as mkdir:
                with self.assertRaisesRegex(ValueError, "only for dev"):
                    teardown.run(environment)
                mkdir.assert_not_called()
