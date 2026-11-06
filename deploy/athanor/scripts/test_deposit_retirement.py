import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import deposit_retirement
import shard
import deploy
import teardown


class DepositRetirementTest(unittest.TestCase):
    def fixture(self, directory, runner):
        data = directory if runner else directory / "data"
        data.mkdir(exist_ok=True)
        config = {"chain_id": "S1_DEPOSIT_TEST", "guardian_url": "https://candidate.test/api/identity/guardian",
                  "shard": "s1-deposit-test", "shard_name": "s1-deposit-test"}
        chain = "0x" + config["chain_id"].encode().hex()
        (data / "native-world.json").write_text(json.dumps({"shard": {"chainId": chain}, "world": {"address": "0x20"}}))
        (directory / "configuration.json").write_text(json.dumps(config))
        return config, {"chainId": chain, "gamesAddress": "0x20", "retirementReady": True}

    def test_only_matching_ready_source_can_leave_durable_evidence(self):
        for runner in (True, False):
            with self.subTest(runner=runner), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                config, result = self.fixture(directory, runner)
                with patch.object(deposit_retirement, "service_json", return_value=result) as request:
                    deposit_retirement.require_deposit_retirement(config, directory, runner=runner)
                request.assert_called_once_with("https://candidate.test/api/value/operator/deposit-retirement",
                                                {"chainId": result["chainId"]}, timeout=120)
                self.assertEqual(json.loads((directory / "deposit-retirement.json").read_text()), result)
                for wrong in ({**result, "retirementReady": False}, {**result, "gamesAddress": "0x99"}, {**result, "chainId": "0x99"}):
                    with patch.object(deposit_retirement, "chain_volume_exists", return_value=True), patch.object(deposit_retirement, "service_json", return_value=wrong):
                        with self.assertRaises(ValueError):
                            deposit_retirement.require_deposit_retirement(config, directory, runner=runner)

    def test_old_evidence_cannot_bypass_live_verification_and_rerun_after_removal_needs_no_shard(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            config, result = self.fixture(directory, True)
            (directory / "deposit-retirement.json").write_text(json.dumps(result))
            with patch.object(deposit_retirement, "chain_volume_exists", return_value=True), patch.object(deposit_retirement, "service_json", side_effect=RuntimeError("principal return pending")):
                with self.assertRaisesRegex(RuntimeError, "principal return pending"):
                    deposit_retirement.require_deposit_retirement(config, directory, runner=True)
            with patch.object(deposit_retirement, "chain_volume_exists", return_value=False), patch.object(deposit_retirement, "service_json") as request:
                deposit_retirement.require_deposit_retirement(config, directory, runner=True)
                request.assert_not_called()

    def test_runner_never_stops_or_removes_state_when_deposit_gate_refuses(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.fixture(directory, True)
            with patch.object(deposit_retirement, "service_json", side_effect=RuntimeError("undelivered deposit")), patch.object(shard, "run") as command, patch.object(shard, "directory_status") as retire:
                with self.assertRaisesRegex(RuntimeError, "undelivered deposit"):
                    shard.remove_shard(directory)
                command.assert_not_called()
                retire.assert_not_called()
                self.assertTrue((directory / "native-world.json").exists())

    def test_official_teardown_runs_the_same_gate_before_removal(self):
        from contextlib import nullcontext
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            directory = root / "run"
            directory.mkdir()
            config, _ = self.fixture(directory, False)
            settings = root / "deploy/first"
            settings.mkdir(parents=True)
            (settings / "environments.json").write_text(json.dumps({"dev": {"runDirectory": str(directory), "environment": "dev"}}))
            with patch.object(teardown.shard, "ROOT", root), patch.object(teardown.shard, "isolated_stack_lock", return_value=nullcontext()), patch.object(teardown.deploy, "load_inputs", return_value=config), patch.object(deposit_retirement, "service_json", side_effect=RuntimeError("principal return pending")), patch.object(teardown.subprocess, "run") as command, patch.object(teardown.shutil, "rmtree") as remove, patch.object(teardown, "directory_status") as retire:
                with self.assertRaisesRegex(RuntimeError, "principal return pending"):
                    teardown.teardown(["dev"], lambda _: None)
                command.assert_not_called()
                remove.assert_not_called()
                retire.assert_not_called()

    def test_pending_reinitialization_cannot_remove_unpaid_principal(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary)
            config,result=self.fixture(directory,False)
            config["public_herald_url"]="https://candidate-herald.test"
            row={"chainId":result["chainId"],"url":config["public_herald_url"],"status":"pending"}
            with patch.object(deploy,"service_json",return_value={"shards":[row]}), patch.object(deploy,"unfinished_differences",return_value=["initialization incomplete"]), patch.object(deposit_retirement,"service_json",side_effect=RuntimeError("principal return pending")), patch.object(deploy.subprocess,"run") as command, patch.object(deploy.shutil,"rmtree") as remove:
                with self.assertRaisesRegex(RuntimeError,"principal return pending"):
                    deploy.restart_unfinished(directory,config,{},lambda _:None)
                command.assert_not_called()
                remove.assert_not_called()
                self.assertTrue((directory/"data/native-world.json").exists())


if __name__ == "__main__":
    unittest.main()
