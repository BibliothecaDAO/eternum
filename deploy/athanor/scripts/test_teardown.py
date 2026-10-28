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

    def stack(self, verifies=True, down_fails=False):
        """The shard's box as teardown's commands see it: its chain volume exists until compose down removes it."""
        state = {"volume": True, "verifies": verifies, "down_fails": down_fails, "calls": []}
        def run(command, **kwargs):
            if "verify" in command:
                state["calls"].append("verify")
                code = 0 if state["verifies"] else 1
                return subprocess.CompletedProcess(command, code, '{"problems": ["the shard still accepts writes"]}', "")
            if "volume" in command:
                return subprocess.CompletedProcess(command, 0 if state["volume"] else 1, "", "")
            state["calls"].append("down")
            if state["down_fails"]:
                raise subprocess.CalledProcessError(1, command)
            state["volume"] = False
            return subprocess.CompletedProcess(command, 0, "", "")
        return state, run

    def test_production_is_removed_only_after_its_backup_verifies(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            retired = []
            state, commands = self.stack(verifies=False)
            with self.assertRaisesRegex(ValueError, "does not verify; nothing was removed: .*still accepts writes"):
                self.run_teardown(root, commands, retired)
            self.assertTrue((run / ".env").exists())
            self.assertEqual(retired, [])
            self.assertEqual(list((root / "logs").iterdir()), [])
            state["verifies"] = True
            original = commands
            def verified(command, **kwargs):
                if "down" in command:
                    # Compose down runs only once the verification is recorded.
                    self.assertEqual(json.loads((root / "logs/teardown-production.json").read_text()),
                                     {"project": "realms-production", "chain_id": "PRODUCTION_1", "backup": BACKUP})
                return original(command, **kwargs)
            state["calls"].clear()
            self.run_teardown(root, verified, retired)
            self.assertFalse(run.exists())
            self.assertEqual(retired, ["retired"])
            self.assertEqual(state["calls"], ["verify", "down"])
            self.assertFalse((root / "logs/teardown-production.json").exists())
            self.assertEqual(json.loads((root / "logs/teardown-PRODUCTION_1.json").read_text())["backup"], BACKUP)

    def test_a_teardown_stopped_right_after_its_volumes_are_removed_finishes_on_a_rerun(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            retired = []
            state, commands = self.stack()
            def disk_full(*args):
                raise OSError("no space left on device")
            # Verified, volumes removed, then the run stops copying its logs.
            with self.assertRaisesRegex(OSError, "no space left"):
                self.run_teardown(root, commands, retired, copy=disk_full)
            self.assertEqual(state["calls"], ["verify", "down"])
            self.assertFalse(state["volume"])
            self.assertTrue(run.exists())
            self.assertEqual(retired, [])
            # The node is gone now: verification would refuse, and the rerun finishes from the record without it.
            state["verifies"] = False
            state["calls"].clear()
            self.run_teardown(root, commands, retired)
            self.assertEqual(state["calls"], ["down"])
            self.assertFalse(run.exists())
            self.assertEqual(retired, ["retired"])
            self.assertTrue((root / "logs/teardown-PRODUCTION_1.json").exists())

    def test_a_verified_shard_that_reopens_its_writes_is_never_removed_on_the_old_record(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            retired = []
            # Verified and recorded, then compose down fails: nothing was removed, the chain is intact.
            state, commands = self.stack(down_fails=True)
            with self.assertRaises(subprocess.CalledProcessError):
                self.run_teardown(root, commands, retired)
            self.assertTrue(state["volume"])
            self.assertTrue((root / "logs/teardown-production.json").exists())
            # The operator reopens writes (backup.py reopen) and S0 takes them; the backup no longer verifies.
            state.update(verifies=False, down_fails=False)
            state["calls"].clear()
            with self.assertRaisesRegex(ValueError, "does not verify; nothing was removed"):
                self.run_teardown(root, commands, retired)
            self.assertEqual(state["calls"], ["verify"])
            self.assertTrue(state["volume"])
            self.assertTrue((run / ".env").exists())
            self.assertEqual(retired, [])

    def test_a_record_never_stands_for_another_chain_or_another_backup(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            run = self.production(root)
            record = root / "logs/teardown-production.json"
            retired = []
            state, commands = self.stack(verifies=False)
            state["volume"] = False
            # The chain is gone, and the record is an older world's: nothing stands for this chain.
            record.write_text(json.dumps({"project": "realms-production", "chain_id": "PRODUCTION_0", "backup": BACKUP}))
            with self.assertRaisesRegex(ValueError, "chain is gone and no teardown of it verified this backup"):
                self.run_teardown(root, commands, retired)
            self.assertEqual(state["calls"], [])
            # A removal stopped part way, its .env gone: only a record of this very backup lets it finish.
            (run / ".env").unlink()
            record.write_text(json.dumps({"project": "realms-production", "chain_id": "PRODUCTION_1",
                                          "backup": "/opt/athanor/backups/other"}))
            with self.assertRaisesRegex(ValueError, "can no longer be identified"):
                self.run_teardown(root, commands, retired)
            self.assertTrue(run.exists())
            record.write_text(json.dumps({"project": "realms-production", "chain_id": "PRODUCTION_1", "backup": BACKUP}))
            self.run_teardown(root, commands, retired)
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

    def test_quiesce_closes_writes_through_the_proxy_and_reopen_lifts_it(self):
        with tempfile.TemporaryDirectory() as temporary:
            config = Path(temporary)
            refused = json.dumps({"error": {"code": -32010, "message": verify_backup.WRITES_CLOSED_MESSAGE}})
            judged = json.dumps({"error": {"code": -32601, "message": "RPC method is not public"}})
            def proxy(arguments, check=True):
                closed = (config / "writes-closed").exists()
                return subprocess.CompletedProcess(arguments, 0, refused if closed else judged, "")
            with patch.object(verify_backup, "volume_path", return_value=config) as volume, \
                    patch.object(verify_backup, "docker", side_effect=proxy) as docker:
                self.assertEqual(verify_backup.quiesce("realms-production"),
                                 {"project": "realms-production", "writes": "closed"})
                self.assertFalse(verify_backup.accepts_writes("realms-production"))
                self.assertEqual(verify_backup.reopen("realms-production"),
                                 {"project": "realms-production", "writes": "open"})
            volume.assert_called_with("realms-production_public-config")
            probe = docker.call_args.args[0]
            self.assertEqual(probe[:3], ["exec", "realms-production-madara-1", "curl"])
            self.assertEqual(probe[-1], "http://rpc:8080/")

    def test_a_proxy_without_the_switch_counts_as_open(self):
        old = json.dumps({"error": {"code": -32010, "message": "Transaction refused"}})
        for answer in (old, "", "not json"):
            with self.subTest(answer=answer), patch.object(
                    verify_backup, "docker", return_value=subprocess.CompletedProcess([], 0, answer, "")):
                self.assertTrue(verify_backup.accepts_writes("realms-production"))


spec_backup = importlib.util.spec_from_file_location("shard_backup", Path(__file__).resolve().parents[3] / "deploy/shard/backup.py")
verify_backup = importlib.util.module_from_spec(spec_backup)
spec_backup.loader.exec_module(verify_backup)
