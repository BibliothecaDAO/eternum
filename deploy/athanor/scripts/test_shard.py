import copy
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import shard


def configuration():
    return {
        "shard": "smoke", "port_base": 28050, "cpuset": "8-11,20-23", "node_memory_mib": 16384,
        "madara_image": "sha256:" + "a" * 64, "herald_image": "sha256:" + "b" * 64,
        "chain_config": "/tmp/chain-config.yaml",
        "node_flags": ["--enable-native-execution=true", "--native-compilation-mode=async"],
    }


class ShardTest(unittest.TestCase):
    def test_resource_and_target_validation_precedes_deployment(self):
        config = configuration()
        allowed = set(range(8, 12)) | set(range(20, 24))
        shard.validate_configuration(config, allowed)
        for key, value in (
            ("port_base", 5050), ("cpuset", "0-23"), ("node_memory_mib", 65536),
            ("madara_image", "madara:latest"), ("shard", "../live"),
            ("node_flags", ["--base-path=/live"]),
            ("node_flags", ["--enable-native-execution=true"]),
        ):
            with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                shard.validate_configuration({**config, key: value}, allowed)

    def test_shards_have_distinct_projects_ports_volumes_and_databases(self):
        first = configuration()
        second = {**first, "shard": "another", "port_base": 29050}
        original = copy.deepcopy(first)
        a = shard.compose_configuration(first, Path("/runs/a"))
        b = shard.compose_configuration(second, Path("/runs/b"))
        self.assertEqual(first, original)
        self.assertNotEqual(a["name"], b["name"])
        for name in ("madara", "herald", "postgres"):
            service = a["services"][name]
            self.assertEqual(service["cgroup_parent"], "athanor.slice")
            self.assertEqual(service["cpuset"], "8-11,20-23")
            self.assertNotEqual(service["ports"], b["services"][name]["ports"])
            self.assertTrue(service["ports"][0].startswith("127.0.0.1:"))
        self.assertEqual(a["services"]["postgres"]["volumes"], ["postgres:/var/lib/postgresql/data"])
        self.assertEqual(a["volumes"], {"chain": {}, "postgres": {}})
        self.assertIn("--db-wal", a["services"]["madara"]["command"])
        self.assertIn("--db-fsync", a["services"]["madara"]["command"])

    def test_existing_containers_or_volumes_are_never_reused(self):
        for replies in (["container"], ["", "volume"]):
            with patch.object(shard, "read", side_effect=replies), self.assertRaisesRegex(ValueError, "already owns state"):
                shard.ensure_fresh_project(configuration())

    def test_private_outputs_exclude_inherited_credentials(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
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
            self.assertEqual(values["RPC_URL"], "http://127.0.0.1:28050/rpc/v0_10_2")
            self.assertEqual(values["GAMEPLAY_CONTRACTS_PATH"], str(directory / "gameplay-contracts.json"))

    def test_environment_rejects_line_injection(self):
        with tempfile.TemporaryDirectory() as temporary, self.assertRaises(ValueError):
            shard.write_private_environment(Path(temporary) / "node.env", {"KEY": "value\nOTHER=bad"})


if __name__ == "__main__":
    unittest.main()
