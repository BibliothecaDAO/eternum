import importlib.util
from pathlib import Path
import unittest
import json
import tempfile
from contextlib import nullcontext
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

    def test_directory_outage_does_not_keep_local_state(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = root / "run"
            run.mkdir()
            (run / "state").write_text("disposable")
            settings = root / "deploy/first"
            settings.mkdir(parents=True)
            (settings / "environments.json").write_text(json.dumps({"dev": {"runDirectory": str(run), "environment": "dev"}}))
            stages = []
            def unavailable(*args):
                self.assertFalse(run.exists())
                raise RuntimeError("identity unavailable")
            with patch.object(teardown.shard, "ROOT", root), patch.object(teardown.deploy, "load_inputs", return_value={}), \
                    patch.object(teardown.shard, "isolated_stack_lock", return_value=nullcontext()), \
                    patch.object(teardown, "directory_status", side_effect=unavailable), \
                    patch.object(teardown.Path, "mkdir"):
                with self.assertRaisesRegex(RuntimeError, "identity unavailable"):
                    teardown.teardown("dev", stages.append)
            self.assertEqual(stages[-2:], ["remove run directory", "retire directory row"])
