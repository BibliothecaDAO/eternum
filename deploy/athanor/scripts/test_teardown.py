import importlib.util
from pathlib import Path
import unittest
import calendar
import json
import time
import subprocess
import tempfile
from contextlib import nullcontext
from unittest.mock import patch

import teardown

spec = importlib.util.spec_from_file_location("operator_command", Path(__file__).with_name("operator-command.py"))
operator_command = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator_command)


class TeardownBoundaryTest(unittest.TestCase):
    def test_other_environments_and_unverifiable_backups_are_refused_before_credentials_or_files(self):
        for arguments in (["production"], ["staging"], [""], ["dev/../production"], ["dev", "/tmp/s0"],
                          ["production", "/tmp/s0"], ["production", "/opt/athanor/backups/.."],
                          ["production", "/opt/athanor/backups/a/b"], ["production", "s0"]):
            with self.subTest(arguments=arguments), patch.object(operator_command, "operator_environment") as credential:
                with self.assertRaisesRegex(ValueError, "Teardown takes dev, or production"):
                    operator_command.run("teardown", arguments)
                credential.assert_not_called()
            with patch.object(teardown.Path, "mkdir") as mkdir:
                with self.assertRaisesRegex(ValueError, "Teardown takes dev, or production"):
                    teardown.run(arguments)
                mkdir.assert_not_called()

    def test_dev_takes_the_same_backup_to_rehearse_production(self):
        self.assertEqual(teardown.parse_arguments(["dev"]), ("dev", None))
        self.assertEqual(teardown.parse_arguments(["dev", "/opt/athanor/backups/rehearsal"]),
                         ("dev", Path("/opt/athanor/backups/rehearsal")))

    def test_production_is_removed_only_after_its_backup_verifies(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = root / "run"
            run.mkdir()
            (run / ".env").write_text("SHARD_NAME=realms-production\nCHAIN_ID=PRODUCTION_1\n")
            settings = root / "deploy/first"
            settings.mkdir(parents=True)
            (settings / "environments.json").write_text(
                json.dumps({"production": {"runDirectory": str(run), "environment": "production"}}))
            backup = "/opt/athanor/backups/s0-20261102"
            def verified(returncode):
                return lambda command, **kwargs: subprocess.CompletedProcess(command, returncode, '{"problems": ["x"]}', "")
            for returncode in (1, 0):
                stages, retired = [], []
                with self.subTest(returncode=returncode), patch.object(teardown.shard, "ROOT", root), \
                        patch.object(teardown.deploy, "load_inputs", return_value={}), \
                        patch.object(teardown.shard, "isolated_stack_lock", return_value=nullcontext()), \
                        patch.object(teardown, "directory_status", side_effect=lambda *args: retired.append(args[1])), \
                        patch.object(teardown.subprocess, "run", side_effect=verified(returncode)) as run_command, \
                        patch.object(teardown.Path, "mkdir"):
                    if returncode:
                        with self.assertRaisesRegex(ValueError, "does not verify; nothing was removed"):
                            teardown.teardown(["production", backup], stages.append)
                        self.assertTrue(run.exists())
                        self.assertEqual(retired, [])
                    else:
                        teardown.teardown(["production", backup], stages.append)
                        self.assertFalse(run.exists())
                        self.assertEqual(retired, ["retired"])
                    verify = run_command.call_args_list[0].args[0]
                    self.assertEqual(verify[:2], ["sudo", "-n"])
                    self.assertEqual(verify[-3:], ["verify", "realms-production", backup])
                    self.assertEqual(stages[0], "verify backup")
            # A rerun after the run directory is gone only retires the row: no live shard is left to verify.
            retired = []
            with patch.object(teardown.shard, "ROOT", root), patch.object(teardown.deploy, "load_inputs", return_value={}), \
                    patch.object(teardown.shard, "isolated_stack_lock", return_value=nullcontext()), \
                    patch.object(teardown, "directory_status", side_effect=lambda *args: retired.append(args[1])), \
                    patch.object(teardown.subprocess, "run") as run_command, patch.object(teardown.Path, "mkdir"):
                teardown.teardown(["production", backup], lambda stage: None)
            run_command.assert_not_called()
            self.assertEqual(retired, ["retired"])

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
                    teardown.teardown(["dev"], stages.append)
            self.assertEqual(stages[-2:], ["remove run directory", "retire directory row"])


class BackupVerifyTest(unittest.TestCase):
    def backup(self, root, head, finished="2026-11-02T08:00:00Z", passed=True, project="realms-production"):
        (root / "restore-test").mkdir(parents=True)
        (root / "capture.json").write_text(json.dumps({"project": project, "finished": finished, "chain": {"head": head}}))
        (root / "restore-test/result.json").write_text(json.dumps({"project": project, "passed": passed}))
        (root / "SHA256SUMS").write_text(f"{verify_backup.sha256(root / 'capture.json')}  capture.json\n")

    def test_only_a_fresh_restorable_copy_of_the_running_chain_verifies(self):
        head = {"block_number": 9, "block_hash": "0xa", "new_root": "0xb"}
        now = calendar.timegm(time.strptime("2026-11-02T08:00:00Z", "%Y-%m-%dT%H:%M:%SZ"))
        cases = {
            "verified": ({}, head, now + 60, []),
            "another chain": ({}, {**head, "block_hash": "0xc"}, now, ["the running chain differs from the copy's head"]),
            "stale": ({}, head, now + 3601, ["it was captured more than an hour ago"]),
            "unrestorable": ({"passed": False}, head, now, ["its restore test did not pass"]),
            "another shard": ({"project": "realms-dev"}, head, now, ["the copy is of another shard"]),
        }
        for name, (overrides, live, at, problems) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                self.backup(root, head, **overrides)
                with patch.object(verify_backup, "node_block", return_value=live) as read:
                    self.assertEqual(verify_backup.verify("realms-production", root, now=at), problems)
                read.assert_called_once_with("realms-production-madara-1", {"block_number": 9})

    def test_a_changed_file_fails_its_checksum(self):
        head = {"block_number": 9, "block_hash": "0xa", "new_root": "0xb"}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.backup(root, head)
            (root / "capture.json").write_text((root / "capture.json").read_text().replace("0xa", "0xa "))
            with patch.object(verify_backup, "node_block", return_value=head):
                self.assertIn("capture.json does not match its checksum",
                              verify_backup.verify("realms-production", root, now=time.time()))


spec_backup = importlib.util.spec_from_file_location("shard_backup", Path(__file__).resolve().parents[3] / "deploy/shard/backup.py")
verify_backup = importlib.util.module_from_spec(spec_backup)
spec_backup.loader.exec_module(verify_backup)
