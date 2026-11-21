import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import deposit_retirement
import deploy
import teardown


class DepositRetirementTest(unittest.TestCase):
    def fixture(self, directory, chain_id="S1_DEPOSIT_TEST"):
        data = directory / "data"
        data.mkdir(exist_ok=True)
        config = {"chain_id": chain_id, "guardian_url": "https://candidate.test/api/identity/guardian",
                  "shard_name": "s1-deposit-test", "public_herald_url": "https://herald.candidate.test"}
        chain = "0x" + config["chain_id"].encode().hex()
        (data / "native-world.json").write_text(json.dumps({"shard": {"chainId": chain}, "world": {"address": "0x20"}}))
        (directory / ".env").write_text(f"SHARD_NAME={config['shard_name']}\nCHAIN_ID={config['chain_id']}\n")
        return config, {"chainId": chain, "gamesAddress": "0x20", "retirementReady": True}

    def test_only_matching_ready_source_can_leave_durable_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            config, result = self.fixture(directory)
            with patch.object(deposit_retirement, "service_json", return_value=result) as request:
                deposit_retirement.require_deposit_retirement(config, directory)
            request.assert_called_once_with("https://candidate.test/api/value/operator/deposit-retirement",
                                            {"chainId": result["chainId"], "url": "https://herald.candidate.test"},
                                            timeout=120)
            self.assertEqual(json.loads((directory / "deposit-retirement.json").read_text()), result)
            for wrong in ({**result, "retirementReady": False}, {**result, "gamesAddress": "0x99"}, {**result, "chainId": "0x99"}):
                with patch.object(deposit_retirement, "chain_volume_exists", return_value=True), patch.object(deposit_retirement, "service_json", return_value=wrong):
                    with self.assertRaises(ValueError):
                        deposit_retirement.require_deposit_retirement(config, directory)

    def test_old_evidence_cannot_bypass_live_verification_and_rerun_after_removal_needs_no_shard(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            config, result = self.fixture(directory)
            (directory / "deposit-retirement.json").write_text(json.dumps(result))
            with patch.object(deposit_retirement, "chain_volume_exists", return_value=True), patch.object(deposit_retirement, "service_json", side_effect=RuntimeError("principal return pending")):
                with self.assertRaisesRegex(RuntimeError, "principal return pending"):
                    deposit_retirement.require_deposit_retirement(config, directory)
            with patch.object(deposit_retirement, "chain_volume_exists", return_value=False), patch.object(deposit_retirement, "service_json") as request:
                deposit_retirement.require_deposit_retirement(config, directory)
                request.assert_not_called()

    def test_teardown_asks_for_the_run_directory_chain_with_the_committed_inputs_before_removal(self):
        from contextlib import nullcontext
        environment = json.loads((teardown.shard.ROOT / "deploy/first/environments.json").read_text())["dev"]
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            _, result = self.fixture(directory, "DEV_19a2b3c4d5e6f")
            def at_run_directory(path):
                return directory if path == environment["runDirectory"] else Path(path)
            run, box_commands = subprocess.run, []
            def only_git_runs(command, **options):
                if command[0] == "git":
                    return run(command, **options)
                box_commands.append(command)
                return subprocess.CompletedProcess(command, 0, "", "")
            with patch.object(teardown, "Path", side_effect=at_run_directory), patch.object(teardown.shard, "isolated_stack_lock", return_value=nullcontext()), patch.object(deposit_retirement, "service_json", side_effect=RuntimeError("principal return pending")) as request, patch.object(subprocess, "run", side_effect=only_git_runs), patch.object(teardown.shutil, "rmtree") as remove:
                with self.assertRaisesRegex(RuntimeError, "principal return pending"):
                    teardown.teardown(["dev"], lambda _: None)
                request.assert_called_once_with(environment["origin"] + "/api/value/operator/deposit-retirement",
                                                {"chainId": result["chainId"], "url": "https://herald.dev-realms.party"},
                                                timeout=120)
                self.assertEqual(box_commands, [])
                remove.assert_not_called()

    def test_unfinished_reinitialization_cannot_remove_unpaid_principal(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary)
            config,_=self.fixture(directory)
            with patch.object(deploy,"unfinished_differences",return_value=[deploy.INCOMPLETE]), patch.object(deposit_retirement,"service_json",side_effect=RuntimeError("principal return pending")), patch.object(deploy.subprocess,"run") as command, patch.object(deploy.shutil,"rmtree") as remove:
                with self.assertRaisesRegex(RuntimeError,"principal return pending"):
                    deploy.restart_unfinished(directory,config,{},lambda _:None)
                command.assert_not_called()
                remove.assert_not_called()
                self.assertTrue((directory/"data/native-world.json").exists())


if __name__ == "__main__":
    unittest.main()
