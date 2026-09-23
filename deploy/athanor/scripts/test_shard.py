import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, MagicMock

import shard


def configuration():
    return {
        "shard": "smoke", "chain_id": "SHARD_A", "port_base": 28050, "cpuset": "8-11,20-23", "node_memory_mib": 16384,
        "player_capacity": 96,
        "madara_image": "sha256:" + "a" * 64, "herald_image": "sha256:" + "b" * 64,
        "gateway_image": "sha256:" + "c" * 64, "init_image": "sha256:" + "d" * 64,
        "chain_config": "/tmp/chain-config.yaml",
        "guardian_url": "https://identity.test/api/guardian",
        "public_rpc_url": "https://rpc.test/rpc/v0_10_2",
        "public_admission_url": "https://rpc.test/rpc/v0_10_2",
        "node_flags": ["--enable-native-execution=true", "--native-compilation-mode=async"],
    }


class ShardTest(unittest.TestCase):
    def test_resource_and_target_validation_precedes_deployment(self):
        config = configuration()
        allowed = set(range(8, 12)) | set(range(20, 24))
        shard.validate_configuration(config, allowed)
        for key, value in (
            ("chain_id", ""), ("chain_id", "a" * 32), ("chain_id", "a\nb"),
            ("port_base", 5050), ("cpuset", "0-23"), ("node_memory_mib", 65536), ("player_capacity", 0),
            ("madara_image", "madara:latest"), ("gateway_image", "gateway:latest"), ("shard", "../live"),
            ("trusted_proxy", "cloudflared"),
            ("node_flags", ["--base-path=/live"]),
            ("node_flags", ["--enable-native-execution=true"]),
        ):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                shard.validate_configuration({**config, key: value}, allowed)

    def test_package_init_retains_the_actual_node_evidence(self):
        spec = importlib.util.spec_from_file_location("shard_init", shard.ROOT / "deploy/shard/init.py")
        package = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(package)
        config = configuration()
        values = {
            "CHAIN_ID": "COMMUNITY", "GUARDIAN_URL": config["guardian_url"],
            "PUBLIC_RPC_URL": config["public_rpc_url"], "PUBLIC_ADMISSION_URL": config["public_admission_url"],
            "PLAYER_CAPACITY": "16", "MADARA_IMAGE": config["madara_image"],
            "MADARA_CONTAINER": "community-madara-1",
        }
        with tempfile.TemporaryDirectory() as temporary, patch.dict(shard.os.environ, values):
            directory = Path(temporary)
            (directory / "host-keys.json").write_text(json.dumps({
                "deployerAddress": "0x789", "deployerPrivateKey": "0xabc", "sequencingPrivateKey": "0xdef",
            }))
            with patch.object(package, "DATA", directory):
                environment = package.environment(package.configuration())
            shard.save_harness_environment(directory, environment)
            saved = dict(line.split("=", 1) for line in (directory / "harness.env").read_text().splitlines())
            self.assertEqual(saved["MADARA_IMAGE"], config["madara_image"])
            self.assertEqual(saved["MADARA_CONTAINER"], "community-madara-1")

    def test_initialization_replaces_template_identity_for_each_shard(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            template = root / "template.yaml"
            template.write_text('chain_name: "Template"\nchain_id: "OLD_SHARD"\nsequencer_address: "0x123"\n')
            for name in ("SHARD_A", "SHARD_B"):
                directory = root / name
                directory.mkdir()
                config = {**configuration(), "chain_id": name, "chain_config": str(template)}
                guardian = {"publicKey": "0x123", "accountClassHash": "0x456"}
                with patch("urllib.request.OpenerDirector.open", return_value=io.StringIO(json.dumps(guardian))):
                    shard.initialize_shard_identity(config, directory, "0x789")
                manifest = json.loads((directory / "native-world.json").read_text())
                self.assertEqual(bytes.fromhex(manifest["shard"]["chainId"][2:]).decode(), name)
                self.assertEqual(manifest["shard"]["guardianPublicKey"], guardian["publicKey"])
                self.assertEqual(manifest["shard"]["accountClassHash"], guardian["accountClassHash"])
                config = (directory / "chain-config.yaml").read_text()
                self.assertEqual(config.count("chain_id:"), 1)
                self.assertIn(f'chain_id: "{name}"', config)
                self.assertNotIn("OLD_SHARD", config)
                self.assertEqual(config.count("sequencer_address:"), 1)
                self.assertIn('sequencer_address: "0x789"', config)

    def test_initialization_refuses_missing_or_invalid_guardian_identity(self):
        for value in ({}, {"publicKey": "0x0", "accountClassHash": "0x1"},
                      {"publicKey": "0x1", "accountClassHash": "0x" + "f" * 64}):
            with self.subTest(value=value), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                with patch("urllib.request.OpenerDirector.open", return_value=io.StringIO(json.dumps(value))):
                    with self.assertRaises((KeyError, ValueError)):
                        shard.initialize_shard_identity(configuration(), directory, "0x789")
                self.assertFalse((directory / "native-world.json").exists())

    def test_existing_containers_or_volumes_are_never_reused(self):
        for replies in (["container"], ["", "volume"]):
            with patch.object(shard, "read", side_effect=replies), self.assertRaisesRegex(ValueError, "already owns state"):
                shard.ensure_fresh_project(configuration())

    def test_private_outputs_exclude_inherited_credentials(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "host-keys.json").write_text(json.dumps({
                "deployerAddress": "0x789", "deployerPrivateKey": "0xabc", "sequencingPrivateKey": "0xdef",
            }))
            with patch.dict(shard.os.environ, {
                "DEPLOYER_ACCOUNT_ADDRESS": "0x123", "DEPLOYER_PRIVATE_KEY": "0x456",
                "UNRELATED_SECRET": "not-for-this-shard",
            }):
                environment = shard.deployment_environment(configuration(), directory)
                shard.save_harness_environment(directory, environment)
            output = directory / "harness.env"
            values = dict(line.split("=", 1) for line in output.read_text().splitlines())
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertNotIn("UNRELATED_SECRET", values)
            self.assertEqual(values["DEPLOYER_ACCOUNT_ADDRESS"], "0x789")
            self.assertEqual(values["DEPLOYER_PRIVATE_KEY"], "0xabc")
            self.assertEqual(values["RPC_URL"], "http://127.0.0.1:28050/rpc/v0_10_2")
            self.assertEqual(values["GAMEPLAY_CONTRACTS_PATH"], str(directory / "gameplay-contracts.json"))
            self.assertEqual(values["MADARA_METRICS_FILE"], str(directory / "metrics" / "metrics.jsonl"))
            self.assertEqual(values["MADARA_IMAGE"], configuration()["madara_image"])
            self.assertEqual(values["MADARA_CONTAINER"], f"athanor-{configuration()['shard']}-madara-1")

    def test_collector_output_is_the_harness_metrics_input(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            environment = {"HERALD_PUBLIC_RPC_URL": "https://rpc.test", "HERALD_PUBLIC_ADMISSION_URL": "https://admission.test"}
            shard.prepare_runtime_files(directory, environment)
            config = json.loads((directory / "collector.json").read_text())
            self.assertEqual(config["service"]["pipelines"]["metrics"], {
                "receivers": ["otlp", "prometheus"], "exporters": ["file"],
            })
            self.assertEqual(config["exporters"]["file"]["path"], "/data/metrics.jsonl")
            self.assertEqual((directory / "metrics").stat().st_mode & 0o777, 0o700)

    def test_environment_rejects_line_injection(self):
        with tempfile.TemporaryDirectory() as temporary, self.assertRaises(ValueError):
            shard.write_private_environment(Path(temporary) / "gateway.env", {"KEY": "value\nOTHER=bad"})

    def test_matrix_runs_in_order_and_stops_only_its_own_projects(self):
        for failure in (None, RuntimeError("live budget exceeded")):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                budget = root / "budget.json"
                budget.write_text("{}")
                matrix = {
                    "configurations": [configuration(), {**configuration(), "shard": "second"}],
                    "workload": {"games": 2, "accounts_per_game": 3, "minutes": 1,
                                 "interval_seconds": 16, "setup_concurrency": 3, "workload": "build-order"},
                    "live": {"budget": str(budget)},
                }
                started = []

                def start(config, directory):
                    started.append(config["shard"])
                    directory.mkdir()
                    (directory / "compose.json").write_text("{}")
                    (directory / "harness.env").write_text("COMPOSE_PROJECT_NAME=athanor-smoke\n")

                with patch.object(shard, "start_shard", side_effect=start), \
                     patch.object(shard, "check_live_budget"), patch.object(shard, "capture_hosts") as hosts, \
                     patch.object(shard.subprocess, "run"), patch.object(shard, "run") as stop, \
                     patch.object(shard, "run_guarded_workload", side_effect=failure):
                    output = root / "matrix"
                    if failure:
                        with self.assertRaisesRegex(RuntimeError, "live budget"):
                            shard.run_matrix(matrix, output)
                    else:
                        self.assertTrue(shard.run_matrix(matrix, output)["passed"])
                    self.assertEqual(started, ["smoke"] if failure else ["smoke", "second"])
                    self.assertEqual(hosts.call_count, len(started) * 2)
                    for call, name in zip(stop.call_args_list, started):
                        self.assertEqual(call.args[0][-2:], [str(output / name / "compose.json"), "stop"])
                        result = json.loads((output / name / "matrix-result.json").read_text())
                        self.assertEqual(result["passed"], failure is None)

    def test_guard_failure_terminates_the_workload(self):
        with tempfile.TemporaryDirectory() as temporary:
            process = MagicMock(pid=999)
            process.poll.return_value = None
            with patch.object(shard.subprocess, "Popen", return_value=process), \
                 patch.object(shard, "check_live_budget", side_effect=RuntimeError("budget")), \
                 patch.object(shard.os, "killpg") as terminate:
                with self.assertRaisesRegex(RuntimeError, "budget"):
                    shard.run_guarded_workload(["bun", "harness"], Path(temporary), {}, {})
                terminate.assert_called_once_with(999, shard.signal.SIGTERM)
                process.wait.assert_called_once_with(timeout=10)


if __name__ == "__main__":
    unittest.main()
