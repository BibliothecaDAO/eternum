from pathlib import Path
import unittest

import shard
from test_shard import configuration


class NodeSettingsTest(unittest.TestCase):
    def test_package_and_runner_use_the_live_node_without_resource_or_database_overrides(self):
        compose = shard.compose_configuration(configuration(), Path("/tmp/not-deployed"))
        self.assertEqual(compose["services"]["prepare"]["environment"]["BLOCK_TIME"], "2s")
        dev = shard.compose_configuration({**configuration(), "block_time": "1s"}, Path("/tmp/not-deployed"))
        self.assertEqual(dev["services"]["prepare"]["environment"]["BLOCK_TIME"], "1s")
        node = compose["services"]["madara"]
        self.assertTrue(node["image"].endswith("ec30298d51ce0780e1ad88cc00e1c17bef31530d0e338fe7fcc1d71d1bad31b2"))
        for key in ("mem_limit", "memswap_limit", "cpuset", "cpus", "cpu_quota", "ulimits", "cgroup_parent", "pids_limit"):
            self.assertNotIn(key, node)
        for prefix in ("--db-", "--parallel-merkle", "--flush-every", "--rpc-admin", "--gateway", "--feeder-gateway"):
            self.assertFalse(any(flag.startswith(prefix) for flag in node["command"]))
        self.assertIn("--devnet-contracts=0", node["command"])
        self.assertIn("--enable-native-execution=true", node["command"])
        self.assertNotIn("gateway", compose["services"])
