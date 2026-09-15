# /// script
# requires-python = "==3.12.*"
# dependencies = ["ijson==3.4.0"]
# ///
"""Behavioural checks for streamed action accounting."""
import json
import tempfile
import unittest
from pathlib import Path

from measure_trace import execution_cost, pair_actions, read_call_tree


def call(contract="StructuresDomain", function="transfer_structure_ownership", writes=3, gas=100, events=(), children=()):
    return {
        "entry_point": {"contract_name": contract, "function_name": function, "class_hash": "0x123", "events_summary": list(events)},
        "used_execution_resources": {"syscall_counter": {"StorageWrite": {"call_count": writes}}, "gas_consumed": gas},
        "nested_calls": [{"EntryPointCall": child} for child in children],
    }


class TraceAccountingTest(unittest.TestCase):
    def test_stream_preserves_sibling_calls_and_discards_vm_steps(self):
        tree = call(children=[call(function="first"), call(function="second")])
        tree["cairo_execution_info"] = {"steps": [{"pc": 1}, {"pc": 2}]}
        tree["nested_calls"][0]["EntryPointCall"]["cairo_execution_info"] = [1, 2]
        expected = call(children=[call(function="first"), call(function="second")])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "trace.json"
            path.write_text(json.dumps(tree))
            self.assertEqual(read_call_tree(path), expected)

    def test_inclusive_counters_are_not_added_twice(self):
        child = call(writes=2, gas=40, events=[{"keys_len": 1, "data_len": 4}])
        parent = call(writes=3, gas=100, events=[{"keys_len": 2, "data_len": 6}], children=[child])
        self.assertEqual(execution_cost(parent), {"storageWrites": 3, "events": 2, "eventFelts": 13, "l2Gas": 100, "classHash": "0x123"})

    def pair_fixture(self):
        command = "transfer_structure_ownership"
        oracle = call(contract="ownership_systems", function=command)
        native = call(contract="SeasonDomain", function="execute", children=[call(function=command)])
        fixture = {"systems": ["ownership_systems"], "commands": [command], "measuredSequence": [{"command": command, "case": "transfer", "succeeded": True}]}
        schema = {"domains": {"season": {"contract": "SeasonDomain"}}}
        return oracle, native, fixture, schema

    def test_pairs_gameplay_and_recorded_execution(self):
        oracle, native, fixture, schema = self.pair_fixture()
        result = pair_actions(call(children=[oracle, native]), fixture, schema)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["case"], "transfer")
        self.assertEqual(result[0]["nativeGameplay"], execution_cost(native["nested_calls"][0]["EntryPointCall"]))

    def test_missing_or_duplicate_native_execution_rejected(self):
        oracle, native, fixture, schema = self.pair_fixture()
        for children in ([oracle], [native], [oracle, native, native], [oracle, oracle, native]):
            with self.subTest(children=len(children)), self.assertRaises(ValueError):
                pair_actions(call(children=children), fixture, schema)

    def test_wrong_command_order_and_count_rejected(self):
        oracle, native, fixture, schema = self.pair_fixture()
        tree = call(children=[oracle, native])
        fixture["measuredSequence"][0]["command"] = "different_command"
        with self.assertRaisesRegex(ValueError, "order"):
            pair_actions(tree, fixture, schema)
        fixture["measuredSequence"] = []
        with self.assertRaisesRegex(ValueError, "count"):
            pair_actions(tree, fixture, schema)


if __name__ == "__main__":
    unittest.main()
