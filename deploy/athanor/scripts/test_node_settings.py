from pathlib import Path
import re
import unittest

import shard
import deploy
from test_shard import configuration


class NodeSettingsTest(unittest.TestCase):
    def test_the_shipped_block_caps_are_the_measured_leader_without_changing_game_clock(self):
        text = (shard.ROOT / "deploy/athanor/chain-config.yaml").read_text()
        self.assertRegex(text, r'(?m)^block_time: "2s"$')
        expected = {"n_txs": 10000, "state_diff_size": 1000000, "n_events": 1000000,
                    "sierra_gas": 10**13, "proving_gas": 10**13, "receipt_l2_gas": 10**13}
        for field, value in expected.items():
            with self.subTest(field=field):
                actual = re.search(rf"(?m)^    {field}: (\d+)$", text)
                self.assertIsNotNone(actual)
                self.assertEqual(int(actual[1]), value)

    def test_package_and_runner_keep_parallel_merkle_and_no_historical_snapshots(self):
        compose = shard.compose_configuration(configuration(), Path("/tmp/not-deployed"))
        flags = compose["services"]["madara"]["command"]
        self.assertEqual(flags.count("--parallel-merkle-enabled"), 1)
        self.assertEqual(flags.count("--db-max-kept-snapshots=0"), 1)
        self.assertIn("--rpc-max-response-size=15", flags)
        self.assertNotIn("gateway", compose["services"])
        explicit = {**configuration(), "rpc_max_response_size_mib": 32,
                    "node_flags": [*configuration()["node_flags"], "--db-max-kept-snapshots=0"]}
        flags = shard.compose_configuration(explicit, Path("/tmp/not-deployed"))["services"]["madara"]["command"]
        self.assertEqual(flags.count("--db-max-kept-snapshots=0"), 1)
        self.assertIn("--rpc-max-response-size=32", flags)

    def test_response_limit_is_one_named_positive_integer_setting(self):
        allowed = set(range(8,12)) | set(range(20,24))
        for invalid in (0, -1, True, "32"):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                shard.validate_configuration({**configuration(), "rpc_max_response_size_mib": invalid}, allowed)

    def test_released_environment_passes_the_same_response_setting_without_another_default(self):
        config = configuration()
        inputs = {**config, "shard_name": config["shard"], "node_memory": "24g", "herald_memory": "6g"}
        self.assertNotIn("RPC_MAX_RESPONSE_SIZE_MIB", deploy.render_environment(inputs, ""))
        self.assertIn("RPC_MAX_RESPONSE_SIZE_MIB=32\n", deploy.render_environment({**inputs, "rpc_max_response_size_mib": 32}, ""))
        with self.assertRaisesRegex(ValueError, "positive u32"):
            deploy.render_environment({**inputs, "rpc_max_response_size_mib": 0}, "")
