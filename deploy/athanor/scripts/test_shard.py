import io
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import shard


NODE_IMAGE = "ghcr.io/madara-alliance/madara@sha256:" + "a" * 64


def configuration():
    return {
        "shard": "smoke", "chain_id": "SHARD_A", "port_base": 28050, "cpuset": "8-11,20-23", "node_memory_mib": 16384,
        "player_capacity": 96,
        "herald_image": "sha256:" + "b" * 64,
        "gateway_image": "sha256:" + "c" * 64, "init_image": "sha256:" + "d" * 64,
        "chain_config": "/tmp/chain-config.yaml",
        "guardian_url": "https://identity.test/api/guardian",
        "public_rpc_url": "https://rpc.test/rpc/v0_10_2",
        "public_admission_url": "https://rpc.test/rpc/v0_10_2",
        "node_flags": ["--enable-native-execution=true", "--native-compilation-mode=async"],
        "presets": [2],
    }


class ShardTest(unittest.TestCase):
    def test_resource_and_target_validation_precedes_deployment(self):
        config = configuration()
        allowed = set(range(8, 12)) | set(range(20, 24))
        shard.validate_configuration(config, allowed)
        shard.validate_configuration({key: value for key, value in config.items() if key != "node_memory_mib"}, allowed)
        shard.validate_configuration({**config, "node_flags": [*config["node_flags"], "--db-max-kept-snapshots=0"]},
                                     allowed)
        for key, value in (
            ("chain_id", ""), ("chain_id", "a" * 32), ("chain_id", "a\nb"),
            ("port_base", 5050), ("cpuset", "0-23"), ("node_memory_mib", 65536), ("player_capacity", 0),
            ("madara_image", NODE_IMAGE), ("gateway_image", "gateway:latest"), ("shard", "../live"),
            ("trusted_proxy", "cloudflared"), ("presets", []), ("presets", ["2"]),
            ("guardian_url", "https://identity.test/api"),
            ("node_flags", ["--base-path=/live"]),
            ("node_flags", [*config["node_flags"], "--db-fsync=false"]),
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
            "PLAYER_CAPACITY": "16", "MADARA_IMAGE": NODE_IMAGE,
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
            self.assertEqual(saved["MADARA_IMAGE"], NODE_IMAGE)
            self.assertEqual(saved["MADARA_CONTAINER"], "community-madara-1")

    def test_package_init_refuses_a_preset_outside_the_release_catalogue(self):
        spec = importlib.util.spec_from_file_location("shard_init", shard.ROOT / "deploy/shard/init.py")
        package = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(package)
        facts = {"presets": {"2": "0x2", "3": "0x3", "5": "0x5", "101": "0x65"}}
        self.assertEqual(package.requested_presets({"PRESETS": "2,5"}, facts), [2, 5])
        with self.assertRaisesRegex(ValueError, r"Presets \[1\] are not in this release's catalogue"):
            package.requested_presets({"PRESETS": "2,1"}, facts)
        with self.assertRaisesRegex(ValueError, "PRESETS must name"):
            package.requested_presets({"PRESETS": ""}, facts)

    def test_package_init_derives_the_trusted_proxy_only_behind_loopback_bindings(self):
        spec = importlib.util.spec_from_file_location("shard_init", shard.ROOT / "deploy/shard/init.py")
        package = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(package)
        routes = ("Iface\tDestination\tGateway \tFlags\tRefCnt\tUse\tMetric\tMask\n"
                  "eth0\t00000000\t0170A8C0\t0003\t0\t0\t0\t00000000\n"
                  "eth0\t0070A8C0\t00000000\t0001\t0\t0\t0\t00F0FFFF\n")
        self.assertEqual(package.trusted_proxy({}, routes), "192.168.112.1")
        self.assertEqual(package.trusted_proxy({"BIND_ADDRESS": "127.0.0.1"}, routes), "192.168.112.1")
        self.assertEqual(package.trusted_proxy({"TRUSTED_PROXY": "10.0.0.7", "BIND_ADDRESS": "0.0.0.0"}, routes),
                         "10.0.0.7")
        self.assertIsNone(package.trusted_proxy({"BIND_ADDRESS": "0.0.0.0"}, routes))
        with self.assertRaises(ValueError):
            package.trusted_proxy({"TRUSTED_PROXY": "cloudflared"}, routes)

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

    def test_a_shard_that_does_not_fit_the_slice_beside_running_shards_is_refused(self):
        compose = {"services": {name: {"mem_limit": "1g"} for name in shard.LONG_RUNNING}}
        with tempfile.TemporaryDirectory() as directory:
            slice_directory = Path(directory)
            (slice_directory / "memory.max").write_text(str(10 * 2**30) + "\n")
            running = slice_directory / "docker-running.scope"
            running.mkdir()
            (running / "memory.max").write_text(str(4 * 2**30) + "\n")
            shard.check_slice_memory(compose, slice_directory)
            (running / "memory.max").write_text(str(5 * 2**30) + "\n")
            with self.assertRaisesRegex(ValueError, "over its 10240 MiB"):
                shard.check_slice_memory(compose, slice_directory)
            (running / "memory.max").write_text("max\n")
            with self.assertRaisesRegex(ValueError, "without a memory limit"):
                shard.check_slice_memory(compose, slice_directory)

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
                environment = shard.deployment_environment({**configuration(), "madara_image": NODE_IMAGE}, directory)
                shard.save_harness_environment(directory, environment)
            output = directory / "harness.env"
            values = dict(line.split("=", 1) for line in output.read_text().splitlines())
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertNotIn("UNRELATED_SECRET", values)
            self.assertEqual(values["DEPLOYER_ACCOUNT_ADDRESS"], "0x789")
            self.assertEqual(values["DEPLOYER_PRIVATE_KEY"], "0xabc")
            self.assertEqual(values["RPC_URL"], "http://127.0.0.1:28050/rpc/v0_10_2")
            self.assertEqual(values["IDENTITY_URL"], "https://identity.test/api")
            self.assertEqual(values["GAMEPLAY_CONTRACTS_PATH"], str(directory / "gameplay-contracts.json"))
            self.assertEqual(values["MADARA_METRICS_FILE"], str(directory / "metrics" / "metrics.jsonl"))
            self.assertEqual(values["MADARA_IMAGE"], NODE_IMAGE)
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

    def test_the_collector_scrapes_the_gateway_metrics_listener_not_its_admission_port(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "gameplay-contracts.json").write_text(json.dumps({"operatorAccountAddress": "0x1"}))
            shard.write_gateway_environment({"player_capacity": 96}, directory, {"RANDOMNESS_PRIVATE_KEY": "0x2"}, "0x3", "0x4")
            gateway = dict(line.split("=", 1) for line in (directory / "gateway.env").read_text().splitlines())
            [target] = shard.collector_configuration()["receivers"]["prometheus"]["config"]["scrape_configs"][0][
                "static_configs"][0]["targets"]
            self.assertEqual(target.split(":")[1], gateway["GATEWAY_METRICS_LISTEN"].split(":")[1])
            self.assertNotEqual(gateway["GATEWAY_METRICS_LISTEN"], gateway["GATEWAY_LISTEN"])

    def test_cgroup_samples_keep_units_and_history_across_container_replacement(self):
        spec = importlib.util.spec_from_file_location("collect_cpu", shard.METRICS_CONTEXT / "collect_cpu.py")
        sampler = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(sampler)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            output = root / "samples.jsonl"
            (root / "cpu.stat").write_text("usage_usec 999999\n")
            container = root / "athanor.slice" / ("docker-" + "a" * 64 + ".scope")
            container.mkdir(parents=True)
            stats = container / "cpu.stat"
            stats.write_text("usage_usec 120\nuser_usec 80\nsystem_usec 40\nnr_periods 5\nnr_throttled 2\nthrottled_usec 7\n")
            previous = sampler.append_samples(root, output, {})
            stats.write_text("usage_usec 220\nuser_usec 140\nsystem_usec 80\nnr_periods 6\nnr_throttled 3\nthrottled_usec 9\n")
            sampler.append_samples(root, output, previous)
            stats.unlink()
            container.rmdir()
            replacement = root / "docker" / ("b" * 64)
            replacement.mkdir(parents=True)
            (replacement / "cpu.stat").write_text("usage_usec 10\nuser_usec 6\nsystem_usec 4\n")
            current = sampler.append_samples(root, output, previous)
            lines = [json.loads(line) for line in output.read_text().splitlines()]
            self.assertEqual(len(lines), 3)  # No aggregate double counting; old samples survive restarts.
            resource = lines[0]["resourceMetrics"][0]
            attributes = {item["key"]: item["value"]["stringValue"] for item in resource["resource"]["attributes"]}
            self.assertEqual(attributes["container.id"], "a" * 64)
            self.assertEqual(attributes["container.name"], container.name)
            metrics = {metric["name"]: metric for metric in resource["scopeMetrics"][0]["metrics"]}
            self.assertEqual(metrics["container.cpu.usage.total"]["sum"]["dataPoints"][0]["asInt"], "120000")
            self.assertEqual(metrics["container.cpu.throttling_data.throttled_time"]["sum"]["dataPoints"][0]["asInt"], "7000")
            self.assertEqual(metrics["container.cpu.throttling_data.throttled_periods"]["sum"]["dataPoints"][0]["asInt"], "2")
            self.assertEqual(set(current), {"b" * 64})
            last_metrics = lines[-1]["resourceMetrics"][0]["scopeMetrics"][0]["metrics"]
            self.assertEqual(len(last_metrics), 3)  # Disabled bandwidth controller: omit unavailable counters.

    def test_environment_rejects_line_injection(self):
        with tempfile.TemporaryDirectory() as temporary, self.assertRaises(ValueError):
            shard.write_private_environment(Path(temporary) / "gateway.env", {"KEY": "value\nOTHER=bad"})

    def test_matrix_runs_in_order_and_stops_only_its_own_projects(self):
        for failure in (None, RuntimeError("workload failed")):
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
                     patch.object(shard, "capture_hosts") as hosts, \
                     patch.object(shard, "run") as stop, \
                     patch.object(shard, "run_workload", side_effect=failure):
                    output = root / "matrix"
                    if failure:
                        with self.assertRaisesRegex(RuntimeError, "workload failed"):
                            shard.run_matrix(matrix, output)
                    else:
                        self.assertTrue(shard.run_matrix(matrix, output)["passed"])
                    self.assertEqual(started, ["smoke"] if failure else ["smoke", "second"])
                    self.assertEqual(hosts.call_count, len(started) * 2)
                    for call, name in zip(stop.call_args_list, started):
                        self.assertEqual(call.args[0][-2:], [str(output / name / "compose.json"), "stop"])
                        result = json.loads((output / name / "matrix-result.json").read_text())
                        self.assertEqual(result["passed"], failure is None)


if __name__ == "__main__":
    unittest.main()
