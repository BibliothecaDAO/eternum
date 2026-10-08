from contextlib import redirect_stdout
import io
import importlib.util
import json
from pathlib import Path
import resource
import subprocess
import tempfile
import time
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
        "metrics_image": "sha256:" + "f" * 64,
        "chain_config": "/tmp/chain-config.yaml",
        "guardian_url": "https://identity.test/api/guardian",
        "public_rpc_url": "https://rpc.test/rpc/v0_10_2",
        "public_admission_url": "https://rpc.test/rpc/v0_10_2",
        "node_flags": ["--enable-native-execution=true", "--native-compilation-mode=async"],
        "presets": [2],
    }


def write_deployed_world(directory):
    """The deployment records the gateway's environment is rendered from."""
    (directory / "gameplay-contracts.json").write_text(json.dumps({"operatorAccountAddress": "0x1"}))
    (directory / "authority.json").write_text(json.dumps({"address": "0x3", "signingKey": "0x2"}))
    (directory / "native-world.json").write_text(json.dumps({"world": {"address": "0x4"}}))


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
    def test_execution_lever_cannot_override_shard_ownership_or_add_unknown_keys(self):
        config = configuration()
        prefix = "--chain-config-override=block_production_concurrency.disable_concurrency="
        for value in ("true", "false"):
            shard.validate_configuration({**config, "node_flags": [*config["node_flags"], prefix + value]},
                                         set(range(24)))
        for flag in (prefix + "true,chain_id=OTHER", prefix + "yes", prefix + "true,block_time=4s",
                     "--chain-config-override=block_production_concurrency.unknown=true",
                     "--chain-config-path=/other/config.yaml", "--chain-config-override=chain_id=OTHER"):
            with self.subTest(flag=flag), self.assertRaises(ValueError):
                shard.validate_configuration({**config, "node_flags": [*config["node_flags"], flag]},
                                             set(range(24)))

    def test_allocator_trial_changes_only_the_nodes_environment_and_read_only_mounts(self):
        config = configuration()
        mount = {"source": "/opt/athanor/allocators/jemalloc/libjemalloc.so.2",
                 "target": "/opt/allocator/libjemalloc.so.2", "read_only": True}
        trial = {**config, "node_environment": {"LD_PRELOAD": mount["target"], "MALLOC_ARENA_MAX": "2"},
                 "node_volumes": [mount]}
        shard.validate_configuration(trial, set(range(24)))
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            write_deployed_world(directory)
            baseline = shard.compose_configuration(config, directory)
            rendered = shard.compose_configuration(trial, directory)
        node = rendered["services"]["madara"]
        original = baseline["services"]["madara"]
        self.assertEqual(node["image"], original["image"])
        self.assertEqual(node["command"], original["command"])
        self.assertEqual(node["volumes"], [*original["volumes"], {"type": "bind", **mount}])
        self.assertEqual(node["environment"], {**original.get("environment", {}), **trial["node_environment"]})
        for name, service in baseline["services"].items():
            if name != "madara":
                self.assertEqual(rendered["services"][name], service)

    def test_allocator_trials_cannot_change_chain_environment_or_mount_writable_files(self):
        config = configuration()
        mount = {"source": "/opt/athanor/allocators/libjemalloc.so.2",
                 "target": "/opt/allocator/libjemalloc.so.2", "read_only": True}
        for setting in (
            {"node_environment": {"CHAIN_ID": "other"}},
            {"node_environment": {"MALLOC_ARENA_MAX": 2}},
            {"node_environment": {"MALLOC_CONF": "a\nb"}},
            {"node_volumes": [{**mount, "read_only": False}]},
            {"node_volumes": [{**mount, "target": "/data"}]},
            {"node_volumes": [{**mount, "source": "/opt/athanor/allocators/../secrets/key"}]},
        ):
            with self.subTest(setting=setting), self.assertRaises(ValueError):
                shard.validate_configuration({**config, **setting}, set(range(24)))

    def test_resource_and_target_validation_precedes_deployment(self):
        config = configuration()
        allowed = set(range(8, 12)) | set(range(20, 24))
        shard.validate_configuration(config, allowed)
        shard.validate_configuration({key: value for key, value in config.items() if key != "node_memory_mib"}, allowed)
        shard.validate_configuration({**config, "node_flags": [*config["node_flags"], "--db-max-kept-snapshots=0"]},
                                     allowed)
        for key, value in (
            ("chain_id", ""), ("chain_id", "a" * 32), ("chain_id", "a\nb"),
            ("port_base", 5050), ("cpuset", "0-23"), ("node_memory_mib", 512), ("player_capacity", 0),
            ("madara_image", NODE_IMAGE), ("gateway_image", "gateway:latest"), ("shard", "../live"),
            ("trusted_proxy", "cloudflared"), ("presets", []), ("presets", ["2"]),
            ("guardian_url", "https://identity.test/api"),
            ("node_flags", ["--base-path=/live"]),
            ("node_flags", [*config["node_flags"], "--db-fsync=false"]),
            ("node_flags", ["--enable-native-execution=true"]),
        ):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                shard.validate_configuration({**config, key: value}, allowed)

    def test_package_init_refuses_a_preset_outside_the_release_catalogue(self):
        package = load_package_script("init")
        facts = {"presets": {"2": "0x2", "3": "0x3", "5": "0x5", "101": "0x65"}}
        self.assertEqual(package.requested_presets({"PRESETS": "2,5"}, facts), {2: "0x2", 5: "0x5"})
        with self.assertRaisesRegex(ValueError, r"Presets \[1\] are not in this release's catalogue"):
            package.requested_presets({"PRESETS": "2,1"}, facts)
        with self.assertRaisesRegex(ValueError, "PRESETS must name"):
            package.requested_presets({"PRESETS": ""}, facts)

    def test_package_init_refuses_a_preset_whose_chain_commitment_is_not_the_release(self):
        package = load_package_script("init")
        self.assertEqual(package.chain_commitment(2, "0x02", "0x2"), "0x02")
        with self.assertRaisesRegex(ValueError, "Preset 2 commits to 0x3 on chain; this release's facts say 0x2"):
            package.chain_commitment(2, "0x3", "0x2")

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
            shard.write_private_environment(data / "harness.env", {"RPC_URL": "http://madara:9944/rpc/v0_10_2"})
            started = time.struct_time((2026, 10, 7, 16, 2, 47, 0, 0, 0))
            argv, environment = package.harness_invocation(["--bots", "1"], {"OPERATOR_TOKEN": "t"}, data, started)
            self.assertEqual(argv, ["bun", "deploy/athanor/harness/run.ts", "--bots", "1"])
            self.assertEqual(environment["RPC_URL"], "http://madara:9944/rpc/v0_10_2")
            self.assertEqual(environment["OPERATOR_TOKEN"], "t")
            self.assertEqual(environment["HARNESS_OUTPUT_DIRECTORY"], str(data / "harness" / "20261007T160247Z"))
            chosen = {"HARNESS_OUTPUT_DIRECTORY": "/data/measure/soak/workload"}
            _, environment = package.harness_invocation([], chosen, data, started)
            self.assertEqual(environment["HARNESS_OUTPUT_DIRECTORY"], "/data/measure/soak/workload")

    def test_the_package_harness_runs_as_the_host_user_on_its_own_cpus(self):
        with tempfile.TemporaryDirectory() as temporary, patch.dict(shard.os.environ, {"HARNESS_CPUSET": "20-23"}):
            harness = shard.compose_configuration(configuration(), Path(temporary))["services"]["harness"]
        self.assertEqual(harness["user"], f"{shard.os.getuid()}:{shard.os.getgid()}")
        self.assertEqual(harness["cpuset"], "20-23")
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

    def test_the_rendered_shard_keeps_the_operator_token_out_of_its_files(self):
        rendered = {"name": "athanor-smoke", "services": {
            name: {"environment": {"OPERATOR_TOKEN": "operator-secret"}, "volumes": []}
            for name in ("prepare", "init", "harness")
        } | {name: {"command": [], "environment": {}} for name in ("madara", "postgres", "herald", "gateway", "rpc")}}
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(shard.subprocess, "check_output", return_value=json.dumps(rendered)):
            compose = shard.compose_configuration(configuration(), Path(directory))
        self.assertNotIn("operator-secret", json.dumps(compose))
        for name in ("prepare", "init", "harness"):
            self.assertIn("OPERATOR_TOKEN", compose["services"][name]["environment"])
            self.assertIsNone(compose["services"][name]["environment"]["OPERATOR_TOKEN"])

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
            self.assertNotIn("RANDOMNESS_PRIVATE_KEY", values)
            self.assertEqual(values["DEPLOYER_ACCOUNT_ADDRESS"], "0x789")
            self.assertEqual(values["DEPLOYER_PRIVATE_KEY"], "0xabc")
            self.assertEqual(values["RPC_URL"], "http://127.0.0.1:28050/rpc/v0_10_2")
            self.assertEqual(values["IDENTITY_URL"], "https://identity.test/api")
            self.assertEqual(values["GAMEPLAY_CONTRACTS_PATH"], str(directory / "gameplay-contracts.json"))
            # The node's image, container and metrics belong to the host-side measurement, not to the harness.
            self.assertFalse({"MADARA_IMAGE", "MADARA_CONTAINER", "MADARA_METRICS_FILE"} & set(values))

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

    def test_a_matrix_workload_runs_any_harness_shape(self):
        frontier = shard.workload_command({"game_type": "frontier", "bots": 2000, "frontier_burst": "booth",
                                           "preset": 101, "minutes": 30})
        self.assertEqual(frontier[2:], ["--game-type", "frontier", "--bots", "2000", "--frontier-burst", "booth",
                                        "--preset", "101", "--minutes", "30"])
        slot = shard.workload_command({"game_type": "blitz", "slot": "evening", "functional": True})
        self.assertEqual(slot[2:], ["--game-type", "blitz", "--slot", "evening", "--functional"])
        with self.assertRaisesRegex(ValueError, "must name the harness run"):
            shard.workload_command({})

    def test_player_capacity_stops_at_campaign_g_target(self):
        config = {"chain_id": "REALMS_TEST", "guardian_url": "https://id.test/api/guardian",
                  "public_rpc_url": "https://rpc.test", "public_admission_url": "https://admission.test"}
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

    def test_docker_keeps_exactly_the_operator_token_and_the_driver_cpus_through_sudo(self):
        # sudo resets the environment: without this the token never reaches initialization, and a measured driver
        # would share the shard's CPUs.
        preserved = [flag for flag in shard.DOCKER if flag.startswith("--preserve-env")]
        self.assertEqual(preserved, ["--preserve-env=OPERATOR_TOKEN,HARNESS_CPUSET"])

    def test_the_collector_scrapes_the_gateway_metrics_listener_not_its_admission_port(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            write_deployed_world(directory)
            shard.write_gateway_environment({"player_capacity": 96}, directory)
            gateway = dict(line.split("=", 1) for line in (directory / "gateway.env").read_text().splitlines())
            [target] = shard.collector_configuration()["receivers"]["prometheus"]["config"]["scrape_configs"][0][
                "static_configs"][0]["targets"]
            self.assertEqual(target.split(":")[1], gateway["GATEWAY_METRICS_LISTEN"].split(":")[1])
            self.assertNotEqual(gateway["GATEWAY_METRICS_LISTEN"], gateway["GATEWAY_LISTEN"])

    def test_the_gateway_starts_with_a_descriptor_for_every_connection_it_admits(self):
        # Docker starts containers at a soft limit of 1024 open files, and the gateway does not raise its own.
        config = {**configuration(), "player_capacity": 2000}
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name in ("config", "public"):
                (root / name).mkdir()
            write_deployed_world(root / "config")
            shard.write_gateway_environment(config, root / "config")
            (root / "public" / "proxy.env").write_text("")
            gateway = root / "realms-gateway"
            gateway.write_text("#!/bin/sh\nulimit -Sn\n")
            gateway.chmod(0o755)
            # The runner renders the package's Compose file, so this is the entrypoint both start; Compose unescapes $$.
            shell, flag, script = shard.compose_configuration(config, root / "run")["services"]["gateway"]["entrypoint"]
            script = (script.replace("$$", "$").replace("/config/", f"{root}/config/")
                      .replace("/public/", f"{root}/public/").replace("/usr/local/bin/realms-gateway", str(gateway)))
            hard = resource.getrlimit(resource.RLIMIT_NOFILE)[1]
            started = subprocess.run([shell, flag, script], capture_output=True, text=True, check=True,
                                     preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_NOFILE, (1024, hard)))
        self.assertEqual(int(started.stdout), shard.admission_connections(config) + shard.GATEWAY_OWN_FILES)

    def test_the_package_runs_its_collector_within_its_budget_and_the_node_exports_to_it(self):
        with tempfile.TemporaryDirectory() as temporary:
            compose = shard.compose_configuration(configuration(), Path(temporary))
        node, metrics = compose["services"]["madara"], compose["services"]["metrics"]
        receiver = shard.collector_configuration()["receivers"]["otlp"]["protocols"]["grpc"]["endpoint"]
        self.assertIn(f"--otel-collector-endpoint=http://metrics:{receiver.rsplit(':', 1)[1]}", node["command"])
        self.assertIn("--otel-export-metrics=true", node["command"])
        # The release's published collector, the same on every shard; the runner builds none of its own.
        self.assertEqual(metrics["image"], configuration()["metrics_image"])
        self.assertEqual(shard.memory_bytes(metrics["mem_limit"]), 256 * 2**20)
        self.assertEqual(shard.memory_bytes(metrics["memswap_limit"]), 256 * 2**20)
        self.assertTrue(metrics["read_only"])
        self.assertEqual(metrics["cap_drop"], ["ALL"])

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
            shard.write_private_environment(Path(temporary) / "gateway.env", {"KEY": "value\nOTHER=bad"})

    def test_a_trial_runs_its_package_images_and_builds_a_lever_gateway(self):
        package = {"init_image": "ghcr.io/i@sha256:" + "1" * 64, "herald_image": "ghcr.io/h@sha256:" + "2" * 64,
                   "gateway_image": "ghcr.io/g@sha256:" + "3" * 64}
        lever = "sha256:" + "4" * 64
        with patch.object(shard, "release_images", return_value=package) as release, \
             patch.object(shard, "gateway_image_at", return_value=lever) as build:
            base = shard.resolve_images({"package": "shard-v1.0.0"})
            trial = shard.resolve_images({"package": "shard-v1.0.0", "gateway_revision": "abc1234",
                                          "herald_image": "sha256:" + "5" * 64})
        self.assertEqual({key: base[key] for key in package}, package)
        self.assertEqual(trial["gateway_image"], lever)
        self.assertEqual(trial["herald_image"], "sha256:" + "5" * 64)
        self.assertEqual(trial["init_image"], package["init_image"])
        release.assert_called_with("shard-v1.0.0")
        build.assert_called_once_with("abc1234")

    def test_matrix_runs_in_order_and_stops_only_its_own_projects(self):
        for failure in (None, RuntimeError("workload failed")):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                matrix = {
                    "configurations": [configuration(), {**configuration(), "shard": "second",
                                                          "workload": {"minutes": 30}}],
                    "workload": {"games": 2, "accounts_per_game": 3, "minutes": 1,
                                 "interval_seconds": 16, "setup_concurrency": 3, "workload": "build-order"},
                }
                started = []

                def start(config, directory):
                    started.append(config["shard"])
                    directory.mkdir()
                    (directory / "compose.json").write_text("{}")
                    (directory / "harness.env").write_text("COMPOSE_PROJECT_NAME=athanor-smoke\n")

                def measure(_docker, run_workload, node, *_paths):
                    measured.append(node)
                    run_workload()
                    return {"blockStats": {"blocks": {"count": 1}}}

                measured = []
                with patch.object(shard, "start_shard", side_effect=start), \
                     patch.object(shard.measures, "measure_workload", side_effect=measure), \
                     patch.object(shard, "run") as stop, \
                     patch.object(shard, "run_workload", side_effect=failure) as workload:
                    output = root / "matrix"
                    if failure:
                        with self.assertRaisesRegex(RuntimeError, "workload failed"):
                            shard.run_matrix(matrix, output)
                    else:
                        self.assertTrue(shard.run_matrix(matrix, output)["passed"])
                    self.assertEqual(started, ["smoke"] if failure else ["smoke", "second"])
                    minutes = [call.args[0][call.args[0].index("--minutes") + 1] for call in workload.call_args_list]
                    self.assertEqual(minutes, ["1"] if failure else ["1", "30"])
                    self.assertEqual(measured, [f"athanor-{name}-madara-1" for name in started])
                    for call, name in zip(stop.call_args_list, started):
                        self.assertEqual(call.args[0][-2:], [str(output / name / "compose.json"), "stop"])
                        result = json.loads((output / name / "matrix-result.json").read_text())
                        self.assertEqual(result["passed"], failure is None)


class PackageStartTest(unittest.TestCase):
    """An initialized shard's data/ started on configuration volumes that hold nothing: a backup restored on a new
    host."""

    def setUp(self):
        self.package = load_package_script("init")
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        self.data = root / "data"
        self.volumes = {name: root / name for name in ("PUBLIC", "HERALD_CONFIG", "GATEWAY_CONFIG", "POSTGRES_CONFIG")}
        for volume in self.volumes.values():
            volume.mkdir()
        self.write_initialized_data()
        self.environ = {
            "CHAIN_ID": "COMMUNITY", "GUARDIAN_URL": "https://identity.test/api/guardian",
            "PUBLIC_RPC_URL": "https://rpc.test/rpc/v0_10_2", "PUBLIC_ADMISSION_URL": "https://admission.test",
            "PLAYER_CAPACITY": "16",
            "TRUSTED_PROXY": "172.18.0.1",
        }
        for name, volume in self.volumes.items():
            self.enterContext(patch.object(self.package, name, volume))
        self.enterContext(patch.object(self.package, "DATA", self.data))
        self.enterContext(patch.object(shard, "wait_for_endpoint"))
        self.enterContext(patch.object(shard, "run"))

    def write_initialized_data(self):
        self.data.mkdir(mode=0o700)
        files = {
            "host-keys.json": {"deployerAddress": "0x789", "deployerPrivateKey": "0xabc", "sequencingPrivateKey": "0xdef"},
            "native-world.json": {"shard": {"chainId": "0x1"}, "world": {"address": "0x4"}},
            "gameplay-contracts.json": {"operatorAccountAddress": "0x1"},
            "authority.json": {"address": "0x3", "signingKey": "0xdef"},
            "initialized.json": {"chainId": "0x1", "world": "0x4"},
            # A record written before init kept only identity: operational settings beside it are ignored.
            "init-configuration.json": {"shard": "community", "chain_id": "COMMUNITY", "port_base": 0,
                                        "guardian_url": "https://identity.test/api/guardian", "player_capacity": 16,
                                        "madara_image": NODE_IMAGE, "public_rpc_url": "https://rpc.test/rpc/v0_10_2"},
        }
        for name, value in files.items():
            (self.data / name).write_text(json.dumps(value))
        (self.data / "chain-config.yaml").write_text('chain_id: "COMMUNITY"\n')
        shard.write_private_environment(self.data / "postgres.env", {
            "POSTGRES_USER": "herald", "POSTGRES_DB": "herald", "POSTGRES_PASSWORD": "restored-password",
        })

    def start(self, **settings):
        with patch.dict(shard.os.environ, {**self.environ, **settings}), redirect_stdout(io.StringIO()):
            config = self.package.configuration()
            self.package.prepare(config)
            self.package.deploy(config, {})

    def published(self, volume, name):
        return self.volumes[volume] / name

    def test_every_service_configuration_is_published_from_data_on_fresh_volumes(self):
        self.start()
        for volume, name in (("PUBLIC", "chain-config.yaml"), ("PUBLIC", "collector.json"), ("PUBLIC", "proxy.env"),
                             ("PUBLIC", "native-world.json"), ("PUBLIC", "gameplay-contracts.json"),
                             ("HERALD_CONFIG", "herald.env"), ("GATEWAY_CONFIG", "gateway.env")):
            with self.subTest(name=name):
                self.assertTrue(self.published(volume, name).exists())
        self.assertEqual(self.published("POSTGRES_CONFIG", "postgres-password").read_text(), "restored-password")
        herald = shard.read_private_environment(self.published("HERALD_CONFIG", "herald.env"))
        self.assertIn(":restored-password@", herald["DATABASE_URL"])

    def test_operational_settings_change_on_restart_and_identity_never_does(self):
        self.start()
        self.start(PLAYER_CAPACITY="200", PUBLIC_RPC_URL="https://rpc.moved.test/rpc/v0_10_2")
        gateway = shard.read_private_environment(self.published("GATEWAY_CONFIG", "gateway.env"))
        self.assertEqual(gateway["GATEWAY_PLAYER_CAPACITY"], "200")
        herald = shard.read_private_environment(self.published("HERALD_CONFIG", "herald.env"))
        self.assertEqual(herald["HERALD_PUBLIC_RPC_URL"], "https://rpc.moved.test/rpc/v0_10_2")
        for settings in ({"CHAIN_ID": "OTHER"}, {"GUARDIAN_URL": "https://other.test/api/guardian"}):
            with self.subTest(settings=settings), self.assertRaisesRegex(ValueError, "never reinitialize"):
                self.start(**settings)

    def test_the_gateway_signs_as_the_submitter_authority_json_records(self):
        self.start()
        (self.data / "authority.json").write_text(json.dumps({"address": "0x7", "signingKey": "0x8"}))
        self.start()
        gateway = shard.read_private_environment(self.published("GATEWAY_CONFIG", "gateway.env"))
        self.assertEqual((gateway["RANDOMNESS_ACCOUNT"], gateway["RANDOMNESS_PRIVATE_KEY"]), ("0x7", "0x8"))


if __name__ == "__main__":
    unittest.main()
