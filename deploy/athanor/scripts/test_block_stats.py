import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('block_stats', Path(__file__).with_name('block-stats.py'))
stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stats)


class AugustBlockStatsTests(unittest.TestCase):
    def test_total_close_is_measured_and_absent_stages_are_reported(self):
        row = dict(block_number=7, close_block_total_ms=3, block_production_ms=2000,
                   txs_executed=1, txs_added_to_block=1, txs_reverted=0, txs_rejected=0,
                   classes_declared=0, deployed_contracts=0, l2_gas_consumed=9,
                   bouncer_sierra_gas=10, merklization_ms=1, db_write_ms=1)
        points = {(name, None): [dict(timestamp=1, value=0, start=None)]
                  for name in ('mempool_current_size', 'mempool_ready_transactions')}
        result = stats.summarize([row], points)
        self.assertEqual(result['missingRequired'], [])
        self.assertEqual(result['closeBlockMs']['p95'], 3)
        self.assertIsNone(result['executionAmplification']['attempts'])
        self.assertIn('blockifier_execution_attempts_total', result['unavailableMetrics'])
        self.assertIn('close_commit_stage_ms', result['unavailableBlockFields'])
        self.assertIsNone(result['mempool']['maxPreconfirmedStatuses'])
        del row['close_block_total_ms']
        missing = stats.summarize([row], points)
        self.assertIn('close_block_total_ms', missing['missingRequired'])
        self.assertIsNone(missing['closeBlockMs']['p95'])
        self.assertIsNone(missing['transactions']['l2GasConsumed'])
