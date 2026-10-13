from pathlib import Path
import re
import unittest

import shard
from test_shard import configuration


class NodeSettingsTest(unittest.TestCase):
    def test_the_shipped_block_caps_are_the_measured_leader_without_changing_game_clock(self):
        text = (shard.ROOT / "deploy/athanor/chain-config.yaml").read_text()
        self.assertRegex(text, r'(?m)^block_time: "2s"$')
        self.assertRegex(text, r"(?m)^execution_batch_size: 4$")
        self.assertRegex(text, r"(?m)^block_production_concurrency:\n  batch_size: 1024$")
        expected = {"n_txs": 10000, "state_diff_size": 1000000, "n_events": 1000000,
                    "sierra_gas": 10**13, "proving_gas": 10**13, "receipt_l2_gas": 10**13}
        for field, value in expected.items():
            with self.subTest(field=field):
                actual = re.search(rf"(?m)^    {field}: (\d+)$", text)
                self.assertIsNotNone(actual)
                self.assertEqual(int(actual[1]), value)

    def test_package_and_runner_use_the_live_node_without_resource_or_database_overrides(self):
        compose = shard.compose_configuration(configuration(), Path("/tmp/not-deployed"))
        node = compose["services"]["madara"]
        self.assertTrue(node["image"].endswith("ec30298d51ce0780e1ad88cc00e1c17bef31530d0e338fe7fcc1d71d1bad31b2"))
        for key in ("mem_limit", "memswap_limit", "cpuset", "cpus", "cpu_quota", "ulimits", "cgroup_parent", "pids_limit"):
            self.assertNotIn(key, node)
        for prefix in ("--db-", "--parallel-merkle", "--flush-every", "--rpc-admin", "--gateway", "--feeder-gateway"):
            self.assertFalse(any(flag.startswith(prefix) for flag in node["command"]))
        self.assertIn("--devnet-contracts=0", node["command"])
        self.assertIn("--enable-native-execution=true", node["command"])
        self.assertNotIn("gateway", compose["services"])
