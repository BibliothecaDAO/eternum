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

    def test_package_and_runner_keep_parallel_merkle_and_no_historical_snapshots(self):
        compose = shard.compose_configuration(configuration(), Path("/tmp/not-deployed"))
        flags = compose["services"]["madara"]["command"]
        self.assertEqual(flags.count("--parallel-merkle-enabled"), 1)
        self.assertEqual(flags.count("--db-max-kept-snapshots=0"), 1)
        self.assertFalse(any(flag.startswith("--rpc-max-response-size") for flag in flags))
        self.assertNotIn("gateway", compose["services"])
        explicit = {**configuration(),
                    "node_flags": [*configuration()["node_flags"], "--db-max-kept-snapshots=0"]}
        flags = shard.compose_configuration(explicit, Path("/tmp/not-deployed"))["services"]["madara"]["command"]
        self.assertEqual(flags.count("--db-max-kept-snapshots=0"), 1)
        self.assertFalse(any(flag.startswith("--rpc-max-response-size") for flag in flags))

