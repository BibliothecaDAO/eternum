from contextlib import redirect_stdout
import io
import importlib.util
import json
from pathlib import Path
import resource
import shutil
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

import deploy
import shard


NODE_IMAGE = "ghcr.io/madara-alliance/madara@sha256:" + "a" * 64


def deployed_compose(config=None, environment=None):
    config = {**configuration(), **(config or {})}
    inputs = {**config, "shard_name": f"athanor-{config['shard']}"}
    images = "".join(f"SHARD_{name.upper()}_IMAGE={config[name + '_image']}\n" for name in ("herald", "init", "metrics"))
    with tempfile.TemporaryDirectory() as directory:
        shutil.copy(shard.ROOT / "deploy/shard/compose.yml", Path(directory) / "compose.yml")
        (Path(directory) / ".env").write_text(deploy.render_environment(inputs, images))
        return json.loads(subprocess.check_output(
            ["docker", "compose", "--project-directory", directory, "--profile", "harness", "config", "--format", "json"],
            env={**shard.os.environ, **(environment or {})}, text=True))


def operator_fixture(data, testcase):
    path = data / "operator-token"
    path.write_text("test-token")
    path.chmod(0o600)
    testcase.enterContext(patch("operator_token.OPERATOR_TOKEN_FILE", path))
    return {"PUBLIC_RPC_URL": "https://rpc.test/rpc/v0_10_2", "PUBLIC_HERALD_URL": "https://herald.test"}


def configuration():
    return {
        "shard": "smoke", "chain_id": "SHARD_A", "port_base": 28050, "cpuset": "8-11,20-23",
        "player_capacity": 96,
        "herald_image": "sha256:" + "b" * 64,
        "init_image": "sha256:" + "d" * 64,
        "metrics_image": "sha256:" + "f" * 64,
        "chain_config": "/tmp/chain-config.yaml",
        "guardian_url": "https://identity.test/api/guardian",
        "public_rpc_url": "https://rpc.test/rpc/v0_10_2",
        "public_herald_url": "https://herald.test", "l2_gas_bound": "0x47868c00",
        "node_flags": ["--enable-native-execution=true", "--native-compilation-mode=async"],
    }


def load_cpu_sampler():
    spec = importlib.util.spec_from_file_location("collect_cpu", shard.ROOT / "deploy/athanor/metrics/collect_cpu.py")
    sampler = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sampler)
    return sampler


def load_package_script(name):
    """A script the shard package ships in deploy/shard, loaded as a module."""
    spec = importlib.util.spec_from_file_location(f"shard_{name}", shard.ROOT / f"deploy/shard/{name}.py")
    script = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(script)
    return script


class ShardTest(unittest.TestCase):

    def test_identity_and_runtime_validation_refuse_bad_shard_settings(self):
        config = configuration()
        shard.validate_shard_identity(config)
        shard.validate_runtime_configuration(config)
        for key, value in (
            ("chain_id", ""), ("chain_id", "a" * 32), ("chain_id", "a\nb"), ("player_capacity", 0),
            ("trusted_proxy", "cloudflared"), ("guardian_url", "https://identity.test/api"),
        ):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                shard.validate_shard_identity({**config, key: value})
        for key, value in (
            ("block_time", 1), ("block_time", "0s"), ("l2_gas_bound", "0x0"), ("l2_gas_bound", "0x10000000000000000"),
        ):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                shard.validate_runtime_configuration({**config, key: value})

    def test_package_backup_restores_the_node_without_its_collector_and_names_missing_tables(self):
        backup = load_package_script("backup")
        args = ["--base-path=/data", "--otel-collector-endpoint=http://metrics:4317", "--otel-export-metrics=true",
                "--db-fsync"]
        self.assertEqual(backup.restored_node_args(args), ["--base-path=/data", "--db-fsync"])
        live = backup.parse_counts("public.games|4\npublic.heads|1\n")
        self.assertEqual(live, {"public.games": 4, "public.heads": 1})
        self.assertEqual(backup.missing_tables(live, {"public.games": 5}), ["public.heads"])

    def test_package_backup_refuses_a_file_that_changed_after_capture(self):
        backup = load_package_script("backup")
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "herald.dump").write_bytes(b"dump")
            backup.write_checksums(directory)
            backup.verify_checksums(directory)
            (directory / "herald.dump").write_bytes(b"changed")
            with self.assertRaisesRegex(RuntimeError, "herald.dump does not match its checksum"):
                backup.verify_checksums(directory)

    def test_package_backup_stops_no_node_while_another_command_holds_the_box_lock(self):
        backup = load_package_script("backup")
        with tempfile.TemporaryDirectory() as temporary:
            lock = Path(temporary) / "isolated-stack.lock"
            holders = []

            def capture(*_):
                holders.append(lock.read_text().split()[:3])
                return {}

            command = ["capture", "athanor-smoke", temporary, f"{temporary}/backup"]
            with patch.object(backup, "LOCK", lock), patch.object(backup, "capture", side_effect=capture), \
                 patch.object(backup.os, "geteuid", return_value=0), patch.object(backup.os, "umask"), \
                 redirect_stdout(io.StringIO()):
                with shard.isolated_stack_lock("deploy staging", lock):
                    with self.assertRaisesRegex(RuntimeError, "is held: deploy staging"):
                        backup.main(command)
                self.assertEqual(holders, [])
                backup.main(command)
            self.assertEqual(holders, [["backup", "capture", "athanor-smoke"]])
            self.assertFalse(lock.exists())

    def test_the_package_harness_runs_with_the_shards_settings_and_reports_into_data(self):
        package = load_package_script("init")
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            shard.write_json(data / "host-keys.json", {"deployerAddress": "0x1", "deployerPrivateKey": "0x2"})
            (data / "host-keys.json").chmod(0o600)
            shard.write_json(data / "gameplay-contracts.json", {"operatorAccountAddress": "0x9"})
            shard.write_private_environment(data / "harness.env", {"RPC_URL": "http://madara:9944/rpc/v0_10_2"})
            started = time.struct_time((2026, 10, 7, 16, 2, 47, 0, 0, 0))
            argv, environment = package.harness_invocation(["--bots", "1"], operator_fixture(data, self), data, started)
            self.assertEqual(argv, ["bun", "deploy/athanor/harness/run.ts", "--bots", "1"])
            self.assertEqual(environment["RPC_URL"], "https://rpc.test/rpc/v0_10_2")
            self.assertEqual(environment["HERALD_URL"], "https://herald.test")
            self.assertEqual(environment["HARNESS_ADMIN_RPC_URL"], "http://madara:9944/rpc/v0_10_2")
            self.assertEqual(environment["DEPLOYER_PRIVATE_KEY"], "0x2")
            self.assertEqual(environment["DEPLOYER_ACCOUNT_ADDRESS"], "0x9")
            self.assertEqual(environment["OPERATOR_TOKEN"], "test-token")
            self.assertEqual(environment["HARNESS_OUTPUT_DIRECTORY"], str(data / "harness" / "20261007T160247Z"))
            chosen = {**operator_fixture(data, self), "HARNESS_OUTPUT_DIRECTORY": "/data/measure/soak/workload"}
            _, environment = package.harness_invocation([], chosen, data, started)
            self.assertEqual(environment["HARNESS_OUTPUT_DIRECTORY"], "/data/measure/soak/workload")

    def test_container_harness_resolves_files_from_its_data_mount_not_host_paths(self):
        package = load_package_script("init")
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            shard.write_json(data / "host-keys.json", {"deployerAddress": "0x1", "deployerPrivateKey": "0x2"})
            (data / "host-keys.json").chmod(0o600)
            shard.write_json(data / "gameplay-contracts.json", {"operatorAccountAddress": "0x9"})
            shard.write_private_environment(data / "harness.env", {
                "NATIVE_WORLD_MANIFEST": "/opt/run/data/native-world.json",
                "GAMEPLAY_CONTRACTS_PATH": "/opt/run/data/gameplay-contracts.json",
                "SHARD_HOST_ACCOUNTS": "/opt/run/data/host-accounts.json",
            })
            _, environment = package.harness_invocation([], operator_fixture(data, self), data)
            for field, filename in [("NATIVE_WORLD_MANIFEST", "native-world.json"),
                                    ("GAMEPLAY_CONTRACTS_PATH", "gameplay-contracts.json"),
                                    ("SHARD_HOST_ACCOUNTS", "host-accounts.json")]:
                self.assertEqual(environment[field], str(data / filename))

    def test_the_package_harness_runs_as_the_host_user_without_cpu_limits(self):
        harness = deployed_compose()["services"]["harness"]
        self.assertEqual(harness["user"], f"{shard.os.getuid()}:{shard.os.getgid()}")
        self.assertNotIn("cpuset", harness)
        self.assertEqual(harness["profiles"], ["harness"])

    def test_package_init_derives_the_trusted_proxy_only_behind_loopback_bindings(self):
        package = load_package_script("init")
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
            template.write_text('block_time: "9s"\nchain_name: "Template"\nchain_id: "OLD_SHARD"\nsequencer_address: "0x123"\n')
            for name, cadence in (("SHARD_A", "1s"), ("SHARD_B", "2s")):
                directory = root / name
                directory.mkdir()
                (directory / "host-accounts.json").write_text(json.dumps({"vrfPublicKey": {"x": "0x4", "y": "0x5"}}))
                config = {**configuration(), "chain_id": name, "block_time": cadence, "chain_config": str(template)}
                guardian = {"publicKey": "0x123", "accountClassHash": "0x456"}
                with patch("urllib.request.OpenerDirector.open", return_value=io.StringIO(json.dumps(guardian))):
                    shard.initialize_shard_identity(config, directory, "0x789")
                manifest = json.loads((directory / "native-world.json").read_text())
                self.assertEqual(bytes.fromhex(manifest["shard"]["chainId"][2:]).decode(), name)
                self.assertEqual(manifest["shard"]["guardianPublicKey"], guardian["publicKey"])
                self.assertEqual(manifest["shard"]["accountClassHash"], guardian["accountClassHash"])
                config = (directory / "chain-config.yaml").read_text()
                self.assertIn(f'block_time: "{cadence}"', config)
                self.assertEqual(config.count("block_time:"), 1)
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

    def test_the_rendered_shard_keeps_the_operator_token_out_of_its_files(self):
        compose = deployed_compose(environment={"OPERATOR_TOKEN": "operator-secret"})
        self.assertNotIn("operator-secret", json.dumps(compose))
        for name in ("prepare", "init", "harness"):
            self.assertNotIn("OPERATOR_TOKEN", compose["services"][name]["environment"])
            self.assertNotIn("OPERATOR_TOKEN_FILE", compose["services"][name]["environment"])

    def test_the_shard_exposes_neither_the_node_nor_postgres(self):
        compose = deployed_compose()
        for name in ("madara", "postgres"):
            self.assertFalse(compose["services"][name].get("ports"))

    def test_private_outputs_exclude_inherited_credentials(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "host-keys.json").write_text(json.dumps({
                "deployerAddress": "0x789", "deployerPrivateKey": "0xabc", "sequencingPrivateKey": "0xdef",
            }))
            (directory / "host-keys.json").chmod(0o600)
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
            self.assertNotIn("RANDOMNESS_PRIVATE_KEY", values)
            self.assertEqual(values["DEPLOYER_ACCOUNT_ADDRESS"], "0x789")
            self.assertNotIn("DEPLOYER_PRIVATE_KEY", values)
            self.assertNotIn("0xabc", output.read_text())
            self.assertEqual(values["RPC_URL"], "http://madara:9944/rpc/v0_10_2")
            self.assertEqual(values["IDENTITY_URL"], "https://identity.test/api")
            self.assertEqual(values["GAMEPLAY_CONTRACTS_PATH"], str(directory / "gameplay-contracts.json"))
            # The node's image, container and metrics belong to the host-side measurement, not to the harness.
            self.assertFalse({"MADARA_IMAGE", "MADARA_CONTAINER", "MADARA_METRICS_FILE"} & set(values))

    def test_collector_output_is_the_harness_metrics_input(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            environment = {"HERALD_PUBLIC_RPC_URL": "https://rpc.test"}
            shard.prepare_runtime_files(directory, environment)
            config = json.loads((directory / "collector.json").read_text())
            self.assertEqual(config["service"]["pipelines"]["metrics"], {
                "receivers": ["otlp"], "exporters": ["file"],
            })
            self.assertEqual(config["exporters"]["file"]["path"], "/data/metrics.jsonl")
            self.assertEqual((directory / "metrics").stat().st_mode & 0o777, 0o700)

    def test_player_capacity_stops_at_campaign_g_target(self):
        config = {"chain_id": "REALMS_TEST", "guardian_url": "https://id.test/api/guardian",
                  "public_rpc_url": "https://rpc.test", "public_herald_url": "https://herald.test"}
        shard.validate_shard_identity({**config, "player_capacity": 2000})
        shard.validate_shard_identity({**config, "player_capacity": shard.MAX_PLAYER_CAPACITY})
        with self.assertRaisesRegex(ValueError, "1 to 2000, campaign G's target"):
            shard.validate_shard_identity({**config, "player_capacity": shard.MAX_PLAYER_CAPACITY + 1})

    def test_the_lock_appears_whole_names_its_holder_and_refuses_a_second_taker(self):
        with tempfile.TemporaryDirectory() as temporary:
            lock = Path(temporary) / "isolated-stack.lock"
            with shard.isolated_stack_lock("deploy staging", lock):
                self.assertTrue(lock.read_text().startswith("deploy staging "))
                with self.assertRaisesRegex(RuntimeError, "is held: deploy staging"):
                    with shard.isolated_stack_lock("runner trial", lock):
                        pass
                self.assertTrue(lock.read_text().startswith("deploy staging "))
            self.assertFalse(lock.exists())
            # The holder text is drafted beside the lock and linked into place; no draft outlives either outcome.
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_docker_does_not_forward_environment_through_sudo(self):
        # Containers read their token from the fixed mount.
        preserved = [flag for flag in shard.DOCKER if flag.startswith("--preserve-env")]
        self.assertEqual(preserved, [])

    def test_the_collector_has_no_retired_gateway_scrape(self):
        collector = shard.collector_configuration()
        self.assertEqual(set(collector["receivers"]), {"otlp"})
        self.assertNotIn("gateway", json.dumps(collector))

    def test_the_initializer_refuses_a_zero_play_gas_bound(self):
        package = load_package_script("init")
        environment = {"CHAIN_ID": "CHECK", "GUARDIAN_URL": "https://id.test/api/guardian",
                       "PUBLIC_RPC_URL": "https://rpc.test", "PUBLIC_HERALD_URL": "https://herald.test",
                       "PLAYER_CAPACITY": "24", "L2_GAS_BOUND": "0x47868c00"}
        with patch.dict(shard.os.environ, {**environment, "L2_GAS_BOUND": "0x0"}), self.assertRaises(ValueError):
            package.configuration()

    def test_harness_key_loading_refuses_a_group_readable_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            shard.write_json(data / "host-keys.json", {"deployerAddress": "0x1", "deployerPrivateKey": "0x2"})
            (data / "host-keys.json").chmod(0o640)
            with self.assertRaisesRegex(ValueError, "owner-only mode 0600"):
                shard.host_credentials(data)

    def test_the_package_runs_its_collector_and_the_node_exports_to_it(self):
        compose = deployed_compose()
        node, metrics = compose["services"]["madara"], compose["services"]["metrics"]
        receiver = shard.collector_configuration()["receivers"]["otlp"]["protocols"]["grpc"]["endpoint"]
        self.assertIn(f"--otel-collector-endpoint=http://metrics:{receiver.rsplit(':', 1)[1]}", node["command"])
        self.assertIn("--otel-export-metrics=true", node["command"])
        # The release's published collector, the same on every shard; the runner builds none of its own.
        self.assertEqual(metrics["image"], configuration()["metrics_image"])
        self.assertNotIn("mem_limit", metrics)
        self.assertNotIn("memswap_limit", metrics)
        self.assertTrue(metrics["read_only"])
        self.assertEqual(metrics["cap_drop"], ["ALL"])

    def test_close_alarm_requires_fresh_sustained_slow_exports_and_recovers(self):
        alarm = load_cpu_sampler().CloseAlarm()
        self.assertIsNone(alarm.observe(1, .111))  # One periodic flush is not an incident.
        self.assertIsNone(alarm.observe(2, .001))
        self.assertIsNone(alarm.observe(3, .007))
        self.assertIsNone(alarm.observe(3, .007))  # Re-reading a point cannot advance the count.
        self.assertIsNone(alarm.observe(4, .008))
        self.assertEqual(alarm.observe(5, .009), {'event': 'node_close_slow', 'timeUnixNano': '5', 'closeMs': 9, 'limitMs': 6})
        self.assertIsNone(alarm.observe(6, .060))
        self.assertEqual(alarm.observe(7, .001)['event'], 'node_close_recovered')

    def test_node_health_reads_the_node_slice_working_set_and_reports_a_missing_node_as_null(self):
        sampler = load_cpu_sampler()
        self.assertEqual(sampler.slice_directory("node-realms-dev.slice"),
                         Path("node.slice/node-realms.slice/node-realms-dev.slice"))
        with tempfile.TemporaryDirectory() as directory:
            root, output = Path(directory) / "cgroup", Path(directory) / "node-health.json"
            node = root / "node.slice/node-realms.slice/node-realms-dev.slice"
            sampler.write_node_health(root, "node-realms-dev.slice", output, 1_800_000_000)
            self.assertIsNone(json.loads(output.read_text())["memory_bytes"])
            (node / "docker-abc.scope").mkdir(parents=True)
            (node / "docker-abc.scope/memory.current").write_text("1900000000\n")
            # Inactive page cache is reclaimable, so it is not the node's: only the working set counts.
            (node / "docker-abc.scope/memory.stat").write_text("anon 1500000000\ninactive_file 400000000\n")
            # Another shard's node, one dash deeper, is not this one's.
            (node / "node-realms-dev-two.slice/docker-def.scope").mkdir(parents=True)
            (node / "node-realms-dev-two.slice/docker-def.scope/memory.current").write_text("5\n")
            (node / "node-realms-dev-two.slice/docker-def.scope/memory.stat").write_text("inactive_file 0\n")
            sampler.write_node_health(root, "node-realms-dev.slice", output, 1_800_000_010)
            health = json.loads(output.read_text())
            self.assertEqual(health["sampled_at"], 1_800_000_010)
            self.assertEqual(health["memory_bytes"], 1_500_000_000)
            self.assertGreater(health["host_memory_bytes"], 0)
            self.assertEqual(sorted(path.name for path in Path(directory).iterdir()), ["cgroup", "node-health.json"])

    def test_close_alarm_tails_complete_records_across_export_rotation(self):
        sampler = load_cpu_sampler()
        alarm = sampler.CloseAlarm()
        def record(timestamp):
            return json.dumps({'resourceMetrics': [{'scopeMetrics': [{'metrics': [{
                'name': 'close_block_total_last_seconds',
                'gauge': {'dataPoints': [{'timeUnixNano': str(timestamp), 'asDouble': .030}]},
            }]}]}]}) + '\n'
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'metrics.jsonl'
            self.assertEqual(alarm.poll(path), [])
            path.write_text(record(1))
            self.assertEqual(alarm.poll(path), [])  # Ignore records from before startup.
            with path.open('a') as stream:
                stream.write(record(2) + record(3)[:-1])
            self.assertEqual(alarm.poll(path), [])
            with path.open('a') as stream:
                stream.write('\n')
            self.assertEqual(alarm.poll(path), [])
            path.rename(path.with_suffix('.old'))
            path.write_text(record(4))
            self.assertEqual([row['event'] for row in alarm.poll(path)], ['node_close_slow'])
            self.assertEqual(alarm.poll(path), [])

    def test_close_alarm_starting_during_a_write_skips_that_record(self):
        alarm = load_cpu_sampler().CloseAlarm()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'metrics.jsonl'
            path.write_text('{"resourceMetrics":')
            self.assertEqual(alarm.poll(path), [])
            with path.open('a') as stream:
                stream.write('[]}\n{}\n')
            self.assertEqual(alarm.poll(path), [])
            self.assertEqual(alarm.offset, path.stat().st_size)

    def test_close_alarm_reports_missing_and_stale_exports_then_restores(self):
        sampler = load_cpu_sampler()
        with tempfile.TemporaryDirectory() as directory, patch.object(sampler.time, 'monotonic', return_value=0) as clock:
            alarm = sampler.CloseAlarm()
            path = Path(directory) / 'metrics.jsonl'
            self.assertEqual(alarm.poll(path), [])
            clock.return_value = 30
            self.assertEqual(alarm.poll(path), [{'event': 'node_close_metric_missing'}])
            path.write_text('{}\n')
            self.assertEqual(alarm.poll(path), [])
            point = {'timeUnixNano': '1', 'asInt': '0'}
            record = json.dumps({'resourceMetrics': [{'scopeMetrics': [{'metrics': [{
                'name': 'close_block_total_last_seconds', 'gauge': {'dataPoints': [point]},
            }]}]}]}) + '\n'
            with path.open('a') as stream:
                stream.write(record)
            self.assertEqual(alarm.poll(path), [{'event': 'node_close_metric_restored'}])
            clock.return_value = 60
            with path.open('a') as stream:
                stream.write(record)  # A repeated old point is not restored telemetry.
            self.assertEqual(alarm.poll(path), [{'event': 'node_close_metric_missing'}])
            self.assertFalse(alarm.active)

    def test_close_alarm_skips_bad_records_loudly_and_keeps_reading(self):
        sampler = load_cpu_sampler()
        alarm = sampler.CloseAlarm()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'metrics.jsonl'
            path.touch()
            alarm.poll(path)
            def record(point):
                return json.dumps({'resourceMetrics': [{'scopeMetrics': [{'metrics': [{
                    'name': 'close_block_total_last_seconds', 'gauge': {'dataPoints': [point]},
                }]}]}]}) + '\n'
            with path.open('a') as stream:
                stream.write('not json\n' + record({'timeUnixNano': '1'}))
                stream.write(record({'timeUnixNano': '2', 'asDouble': 'NaN'}))
                for timestamp in range(3, 6):
                    stream.write(record({'timeUnixNano': str(timestamp), 'asDouble': .030}))
            events = alarm.poll(path)
            self.assertEqual([row['event'] for row in events],
                             ['node_metric_record_invalid'] * 3 + ['node_close_slow'])
            self.assertEqual([row['error'] for row in events[:3]], ['JSONDecodeError', 'KeyError', 'ValueError'])
            self.assertEqual(alarm.poll(path), [])
            with path.open('a') as stream:
                stream.write(record({'timeUnixNano': '6', 'asInt': '0'}))
            self.assertEqual([row['event'] for row in alarm.poll(path)], ['node_close_recovered'])

    def test_cpu_samples_rotate_as_the_collector_export_does(self):
        sampler = load_cpu_sampler()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            container = root / ("docker-" + "a" * 64 + ".scope")
            container.mkdir()
            (container / "cpu.stat").write_text("usage_usec 120\n")
            output = root / "container-metrics.jsonl"
            for generation in ("oldest", "older", "full"):
                output.write_text(generation.ljust(sampler.ROTATE_BYTES, "."))
                sampler.append_samples(root, output, {})
            self.assertEqual(len(output.read_text().splitlines()), 1)
            backups = sorted(root.glob("container-metrics.jsonl.*"))
            self.assertEqual([path.name for path in backups],
                             ["container-metrics.jsonl.1", "container-metrics.jsonl.2"])
            self.assertTrue(backups[0].read_text().startswith("full"))
            self.assertTrue(backups[1].read_text().startswith("older"))

    def test_cgroup_samples_keep_units_and_history_across_container_replacement(self):
        sampler = load_cpu_sampler()
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
            shard.write_private_environment(Path(temporary) / "private.env", {"KEY": "value\nOTHER=bad"})


class PackageStartTest(unittest.TestCase):
    """An initialized shard's data/ started on configuration volumes that hold nothing: a backup restored on a new
    host."""

    def setUp(self):
        self.package = load_package_script("init")
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        self.data = root / "data"
        self.volumes = {name: root / name for name in ("PUBLIC", "HERALD_CONFIG", "POSTGRES_CONFIG")}
        for volume in self.volumes.values():
            volume.mkdir()
        self.write_initialized_data()
        self.facts = root / "release-facts.json"
        self.facts.write_text(json.dumps({"releaseId": 1}))
        self.environ = {
            **operator_fixture(self.data, self),
            "CHAIN_ID": "RESTORED_SHARD", "GUARDIAN_URL": "https://identity.test/api/guardian",
            "PUBLIC_RPC_URL": "https://rpc.test/rpc/v0_10_2", "PUBLIC_HERALD_URL": "https://herald.test", "L2_GAS_BOUND": "0x47868c00",
            "PLAYER_CAPACITY": "16",
            "TRUSTED_PROXY": "172.18.0.1",
        }
        for name, volume in self.volumes.items():
            self.enterContext(patch.object(self.package, name, volume))
        self.enterContext(patch.object(self.package, "DATA", self.data))
        self.enterContext(patch.object(self.package, "RELEASE_FACTS", self.facts))
        self.enterContext(patch.object(shard, "wait_for_endpoint"))
        self.enterContext(patch.object(shard, "run"))

    def write_initialized_data(self):
        self.data.mkdir(mode=0o700)
        files = {
            "host-keys.json": {"deployerAddress": "0x789", "deployerPrivateKey": "0xabc", "sequencingPrivateKey": "0xdef"},
            "native-world.json": {"shard": {"chainId": "0x1"}, "world": {"address": "0x4"}, "native": {"releaseId": 1}},
            "gameplay-contracts.json": {"operatorAccountAddress": "0x1", "launcherAccountAddress": "0x5",
                                        "ledgerOperatorAccountAddress": "0x6"},
            "authority.json": {"address": "0x3", "signingKey": "0xdef"},
            "initialized.json": {"chainId": "0x1", "world": "0x4"},
            # A record written before init kept only identity: operational settings beside it are ignored.
            "init-configuration.json": {"shard": "restored-shard", "chain_id": "RESTORED_SHARD", "port_base": 0,
                                        "guardian_url": "https://identity.test/api/guardian", "l2_gas_bound": "0x47868c00", "player_capacity": 16,
                                        "madara_image": NODE_IMAGE, "public_rpc_url": "https://rpc.test/rpc/v0_10_2"},
        }
        for name, value in files.items():
            (self.data / name).write_text(json.dumps(value))
        (self.data / "host-keys.json").chmod(0o600)
        (self.data / "chain-config.yaml").write_text('chain_id: "RESTORED_SHARD"\n')
        shard.write_private_environment(self.data / "postgres.env", {
            "POSTGRES_USER": "herald", "POSTGRES_DB": "herald", "POSTGRES_PASSWORD": "restored-password",
        })

    def start(self, **settings):
        with patch.dict(shard.os.environ, {**self.environ, **settings}), redirect_stdout(io.StringIO()):
            config = self.package.configuration()
            self.package.prepare(config)
            self.package.deploy(config)

    def published(self, volume, name):
        return self.volumes[volume] / name

    def test_initialize_identity_ignores_host_uid_when_reading_its_own_key(self):
        (self.data / "native-world.json").unlink()
        (self.data / "chain-config.yaml").unlink()
        (self.data / "initialized.json").unlink()
        with patch.dict(shard.os.environ, {"HOST_UID": str(shard.os.geteuid() + 1)}), patch.object(shard, "initialize_shard_identity") as initialize:
            self.package.initialize_identity(configuration())
        self.assertEqual(initialize.call_args.args[2], "0x789")

    def test_failed_first_prepare_can_resume_with_the_same_keys(self):
        for name in ("init-configuration.json", "initialized.json", "gameplay-contracts.json", "native-world.json", "chain-config.yaml"):
            (self.data / name).unlink()
        shard.write_json(self.data / "host-accounts.json", {"vrfPublicKey": {"x": "0x1", "y": "0x2"}})
        original = (self.data / "host-keys.json").read_bytes()
        with patch.dict(shard.os.environ, self.environ), patch.object(shard, "read_guardian_identity", return_value={"guardianPublicKey": "0x1", "accountClassHash": "0x2"}):
            config = self.package.configuration()
            with patch.object(self.package, "publish_prepared_config", side_effect=OSError("temporary publication failure")):
                with self.assertRaisesRegex(OSError, "publication failure"):
                    self.package.prepare(config)
            self.package.prepare(config)
        self.assertEqual((self.data / "host-keys.json").read_bytes(), original)
        self.assertTrue((self.data / "init-configuration.json").exists())

    def test_every_service_configuration_is_published_from_data_on_fresh_volumes(self):
        self.start()
        for volume, name in (("PUBLIC", "chain-config.yaml"), ("PUBLIC", "collector.json"), ("PUBLIC", "proxy.env"),
                             ("PUBLIC", "native-world.json"), ("PUBLIC", "gameplay-contracts.json"),
                             ("HERALD_CONFIG", "herald.env")):
            with self.subTest(name=name):
                self.assertTrue(self.published(volume, name).exists())
        self.assertEqual(self.published("POSTGRES_CONFIG", "postgres-password").read_text(), "restored-password")
        herald = shard.read_private_environment(self.published("HERALD_CONFIG", "herald.env"))
        self.assertIn(":restored-password@", herald["DATABASE_URL"])

    def test_operational_settings_change_on_restart_and_identity_never_does(self):
        self.start()
        self.start(PLAYER_CAPACITY="200", PUBLIC_RPC_URL="https://rpc.moved.test/rpc/v0_10_2")
        herald = shard.read_private_environment(self.published("HERALD_CONFIG", "herald.env"))
        self.assertEqual(herald["HERALD_PUBLIC_RPC_URL"], "https://rpc.moved.test/rpc/v0_10_2")
        for settings in ({"CHAIN_ID": "OTHER"}, {"GUARDIAN_URL": "https://other.test/api/guardian"}, {"L2_GAS_BOUND": "0x1"}):
            with self.subTest(settings=settings), self.assertRaisesRegex(ValueError, "never reinitialize"):
                self.start(**settings)

    def world_commands(self):
        return [call.args[0] for call in shard.run.call_args_list if "config/deployer/clean/cli/deploy-world.ts" in call.args[0]]

    def test_a_restart_on_the_shard_release_registers_nothing(self):
        self.start()
        self.assertEqual(self.world_commands(), [])

    def test_the_next_release_is_registered_on_the_running_shard_then_inspected(self):
        self.facts.write_text(json.dumps({"releaseId": 2}))
        self.start()
        commands = self.world_commands()
        self.assertEqual(len(commands), 2)
        self.assertEqual(commands[0][commands[0].index("--launcher") + 1], "0x5")
        self.assertEqual(commands[1], [*commands[0], "--inspect"])
        logs = [call.args[2] for call in shard.run.call_args_list if call.args[0] in commands]
        self.assertEqual(logs, ["release-2-deploy", "release-2-inspect"])

    def test_restart_verifies_the_existing_vrf_credential_without_rotation(self):
        self.start()
        run_calls = shard.run.call_args_list
        self.assertTrue(any("verify-vrf" in call.args[0] for call in run_calls))
        self.assertFalse(any("prepare-authority" in str(call.args[0]) for call in run_calls))


if __name__ == "__main__":
    unittest.main()


class OfficialBackupLockTest(unittest.TestCase):
    def test_a_missing_official_lock_directory_refuses_instead_of_running_unlocked(self):
        from contextlib import redirect_stdout
        import backup
        with tempfile.TemporaryDirectory() as temporary:
            lock = Path(temporary) / "missing/isolated-stack.lock"
            with patch.object(backup, "LOCK", lock), patch.object(backup.os, "geteuid", return_value=0), \
                    patch.object(backup, "capture", return_value={}) as capture, redirect_stdout(io.StringIO()):
                with self.assertRaises((FileNotFoundError, RuntimeError)):
                    backup.main(["capture", "fixture", temporary, temporary])
                capture.assert_not_called()


class ResolvedProxyCapacityTest(unittest.TestCase):
    def test_the_resolved_proxy_and_initialization_use_the_same_shard_capacity(self):
        for capacity in (24, 2000):
            compose = deployed_compose({"player_capacity": capacity})
            values = [compose["services"][name]["environment"]["PLAYER_CAPACITY"] for name in ("prepare", "rpc")]
            self.assertEqual([int(value) for value in values], [capacity, capacity])
