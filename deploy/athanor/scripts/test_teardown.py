import importlib.util
from pathlib import Path
import unittest
import json
import shutil
import subprocess
import tempfile
from contextlib import ExitStack, nullcontext
from unittest.mock import patch

import teardown

BACKUP = "/opt/athanor/backups/s0-20261102"

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

    def production(self, root):
        """A production run directory, its settings and an empty logs directory, all under `root`."""
        run = root / "run"
        run.mkdir()
        (run / ".env").write_text("SHARD_NAME=realms-production\nCHAIN_ID=PRODUCTION_1\n")
        (run / "compose.yml").write_text("services: {}\n")
        (run / "deploy-1.log").write_text("deployed\n")
        settings = root / "deploy/first"
        settings.mkdir(parents=True)
        (settings / "environments.json").write_text(
            json.dumps({"production": {"runDirectory": str(run), "environment": "production"}}))
        (root / "logs").mkdir()
        return run

    def boundaries(self, root, commands, retired, copy=None):
        """Teardown's outside world: its settings, lock, directory row, logs and commands, each observed."""
        return [patch.object(teardown.shard, "ROOT", root), patch.object(teardown, "LOGS", root / "logs"),
                patch.object(teardown.deploy, "load_inputs", return_value={}),
                patch.object(teardown.shard, "isolated_stack_lock", return_value=nullcontext()),
                patch.object(teardown, "directory_status", side_effect=lambda *args: retired.append(args[1])),
                patch.object(teardown.subprocess, "run", side_effect=commands),
                patch.object(teardown.shutil, "copyfile", side_effect=copy or shutil.copyfile)]

    def run_teardown(self, root, commands, retired, copy=None):
        with ExitStack() as stack:
            for boundary in self.boundaries(root, commands, retired, copy):
                stack.enter_context(boundary)
            teardown.teardown(["production", BACKUP], lambda stage: None)

    def test_production_is_removed_only_after_its_backup_verifies(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            calls, retired = [], []
            def refused(command, **kwargs):
                calls.append(command)
                return subprocess.CompletedProcess(command, 1, '{"problems": ["writes are open"]}', "")
            with self.assertRaisesRegex(ValueError, "does not verify; nothing was removed: .*writes are open"):
                self.run_teardown(root, refused, retired)
            self.assertTrue((run / ".env").exists())
            self.assertEqual(retired, [])
            self.assertEqual(list((root / "logs").iterdir()), [])
            self.assertEqual(calls[0][:2], ["sudo", "-n"])
            self.assertEqual(calls[0][-3:], ["verify", "realms-production", BACKUP])

            def verified(command, **kwargs):
                calls.append(command)
                if command[-3] == "verify":
                    return subprocess.CompletedProcess(command, 0, "{}", "")
                # Compose down runs only once the verification is recorded.
                self.assertEqual(json.loads((root / "logs/teardown-production.json").read_text()),
                                 {"project": "realms-production", "chain_id": "PRODUCTION_1", "backup": BACKUP})
                return subprocess.CompletedProcess(command, 0, "", "")
            calls.clear()
            self.run_teardown(root, verified, retired)
            self.assertFalse(run.exists())
            self.assertEqual(retired, ["retired"])
            self.assertEqual([command[-3] for command in calls], ["verify", "down"])
            self.assertFalse((root / "logs/teardown-production.json").exists())
            self.assertEqual(json.loads((root / "logs/teardown-PRODUCTION_1.json").read_text())["backup"], BACKUP)

    def test_a_teardown_stopped_right_after_its_volumes_are_removed_finishes_on_a_rerun(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            retired, calls = [], []
            def first_run(command, **kwargs):
                calls.append(command)
                return subprocess.CompletedProcess(command, 0, "{}", "")
            def disk_full(*args):
                raise OSError("no space left on device")
            # Verified, volumes removed, then the run stops copying its logs.
            with self.assertRaisesRegex(OSError, "no space left"):
                self.run_teardown(root, first_run, retired, copy=disk_full)
            self.assertEqual([command[-3] for command in calls], ["verify", "down"])
            self.assertTrue(run.exists())
            self.assertEqual(retired, [])
            # The node is gone now: a rerun must not need it, and finishes from the record.
            def node_gone(command, **kwargs):
                calls.append(command)
                if command[-3] == "verify":
                    return subprocess.CompletedProcess(command, 1, '{"problems": ["node no longer exists"]}', "")
                return subprocess.CompletedProcess(command, 0, "", "")
            calls.clear()
            self.run_teardown(root, node_gone, retired)
            self.assertEqual([command[-3] for command in calls], ["down"])
            self.assertFalse(run.exists())
            self.assertEqual(retired, ["retired"])
            self.assertTrue((root / "logs/teardown-PRODUCTION_1.json").exists())

    def test_a_record_never_stands_for_another_chain_or_another_backup(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            record = root / "logs/teardown-production.json"
            retired, calls = [], []
            def node_gone(command, **kwargs):
                calls.append(command)
                return subprocess.CompletedProcess(command, 1 if command[-3] == "verify" else 0, "{}", "")
            # A record of an older world's chain: this shard is verified afresh, and its node refuses.
            record.write_text(json.dumps({"project": "realms-production", "chain_id": "PRODUCTION_0", "backup": BACKUP}))
            with self.assertRaisesRegex(ValueError, "does not verify"):
                self.run_teardown(root, node_gone, retired)
            self.assertEqual([command[-3] for command in calls], ["verify"])
            # A removal stopped part way, its .env gone: only a record of this very backup lets it finish.
            (run / ".env").unlink()
            record.write_text(json.dumps({"project": "realms-production", "chain_id": "PRODUCTION_1",
                                          "backup": "/opt/athanor/backups/other"}))
            with self.assertRaisesRegex(ValueError, "can no longer be identified"):
                self.run_teardown(root, node_gone, retired)
            self.assertTrue(run.exists())
            record.write_text(json.dumps({"project": "realms-production", "chain_id": "PRODUCTION_1", "backup": BACKUP}))
            self.run_teardown(root, node_gone, retired)
            self.assertFalse(run.exists())
            self.assertEqual(retired, ["retired"])

    def test_a_rerun_after_the_directory_is_gone_only_retires_the_row(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            shutil.rmtree(run)
            retired, calls = [], []
            self.run_teardown(root, lambda command, **kwargs: calls.append(command), retired)
            self.assertEqual(calls, [])
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
    head = {"block_number": 9, "block_hash": "0xa", "new_root": "0xb"}

    def backup(self, root, passed=True, project="realms-production"):
        (root / "restore-test").mkdir(parents=True)
        (root / "capture.json").write_text(json.dumps({"project": project, "chain": {"head": self.head}}))
        (root / "restore-test/result.json").write_text(json.dumps({"project": project, "passed": passed}))
        (root / "SHA256SUMS").write_text(f"{verify_backup.sha256(root / 'capture.json')}  capture.json\n")

    def verify(self, root, live=None, writes=False, accepted=0):
        with patch.object(verify_backup, "node_block", return_value=live or self.head) as read, \
                patch.object(verify_backup, "accepts_writes", return_value=writes), \
                patch.object(verify_backup, "transactions_after", return_value=accepted) as after:
            problems = verify_backup.verify("realms-production", root)
        read.assert_called_once_with("realms-production-madara-1", {"block_number": 9})
        after.assert_called_once_with("realms-production-madara-1", 9)
        return problems

    def test_only_a_restorable_copy_of_the_drained_running_chain_verifies(self):
        cases = {
            "verified": ({}, {}, []),
            "another chain": ({}, {"live": {**self.head, "block_hash": "0xc"}},
                              ["the running chain differs from the copy's head"]),
            "writes open": ({}, {"writes": True}, ["the shard still accepts writes: quiesce it, drain, then capture"]),
            "changed after capture": ({}, {"accepted": 1},
                                      ["1 transactions were accepted after the capture: capture the drained shard again"]),
            "unrestorable": ({"passed": False}, {}, ["its restore test did not pass"]),
            "another shard": ({"project": "realms-dev"}, {}, ["the copy is of another shard"]),
        }
        for name, (copy, live, problems) in cases.items():
            with self.subTest(name), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                self.backup(root, **copy)
                self.assertEqual(self.verify(root, **live), problems)

    def test_a_changed_file_fails_its_checksum(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.backup(root)
            (root / "capture.json").write_text((root / "capture.json").read_text().replace("0xa", "0xa "))
            self.assertIn("capture.json does not match its checksum", self.verify(root))

    def test_every_block_after_the_capture_is_counted_in_batches(self):
        batches = []
        def answer(container, requests):
            batches.append([request["params"][0]["block_number"] for request in requests])
            return [{"result": 1 if request["params"][0]["block_number"] == 160 else 0} for request in requests]
        with patch.object(verify_backup, "node_rpc", return_value=259), \
                patch.object(verify_backup, "node_batch", side_effect=answer):
            self.assertEqual(verify_backup.transactions_after("realms-production-madara-1", 9), 1)
        self.assertEqual([batch[0] for batch in batches], [10, 110, 210])
        self.assertEqual(batches[-1][-1], 259)
        self.assertEqual(sum(len(batch) for batch in batches), 250)

    def test_quiesce_stops_the_write_path_alone(self):
        with patch.object(verify_backup, "docker") as docker, \
                patch.object(verify_backup, "docker_output", return_value="false"):
            self.assertEqual(verify_backup.quiesce("realms-production"),
                             {"project": "realms-production", "writes": "closed"})
        docker.assert_called_once_with(["stop", "-t", "60", "realms-production-rpc-1"])


spec_backup = importlib.util.spec_from_file_location("shard_backup", Path(__file__).resolve().parents[3] / "deploy/shard/backup.py")
verify_backup = importlib.util.module_from_spec(spec_backup)
spec_backup.loader.exec_module(verify_backup)
