from pathlib import Path
import unittest

import shard
from test_shard import configuration


class NodeSettingsTest(unittest.TestCase):
    def test_package_and_runner_use_the_live_node_with_bounded_memory_and_no_other_overrides(self):
        compose = shard.compose_configuration(configuration(), Path("/tmp/not-deployed"))
        self.assertEqual(compose["services"]["prepare"]["environment"]["BLOCK_TIME"], "2s")
        dev = shard.compose_configuration({**configuration(), "block_time": "1s"}, Path("/tmp/not-deployed"))
        self.assertEqual(dev["services"]["prepare"]["environment"]["BLOCK_TIME"], "1s")
        node = compose["services"]["madara"]
        self.assertTrue(node["image"].endswith("40934db1cdcd0e37058531c9bda152b336a0b594e349cbf2578f3893e0cc20e2"))
        for key in ("mem_limit", "memswap_limit", "cpuset", "cpus", "cpu_quota", "ulimits", "cgroup_parent", "pids_limit"):
            self.assertNotIn(key, node)
        self.assertIn("--db-max-kept-snapshots=0", node["command"])
        self.assertEqual(node["environment"]["MALLOC_ARENA_MAX"], "2")
        command = [flag for flag in node["command"] if flag != "--db-max-kept-snapshots=0"]
        for prefix in ("--db-", "--parallel-merkle", "--flush-every", "--rpc-admin", "--gateway", "--feeder-gateway"):
            self.assertFalse(any(flag.startswith(prefix) for flag in command))
        self.assertIn("--devnet-contracts=0", node["command"])
        self.assertIn("--enable-native-execution=true", node["command"])
        self.assertNotIn("gateway", compose["services"])
