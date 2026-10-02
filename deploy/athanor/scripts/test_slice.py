import configparser
from pathlib import Path
import tempfile
import unittest

import shard

SLICE_UNIT = Path(__file__).resolve().parents[1] / "systemd/athanor.slice"


class SliceTests(unittest.TestCase):
    def test_the_shard_host_budget_accepts_a_64_gib_node_and_keeps_an_upper_bound(self):
        unit = configparser.ConfigParser()
        unit.read(SLICE_UNIT)
        limits = unit["Slice"]
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "memory.max").write_text(str(shard.memory_bytes(limits["MemoryMax"])))
            compose = {"services": {name: {"mem_limit": "1G"} for name in shard.LONG_RUNNING}}
            compose["services"]["madara"]["mem_limit"] = "64G"
            shard.check_slice_memory(compose, directory)
            compose["services"]["madara"]["mem_limit"] = "80G"
            with self.assertRaisesRegex(ValueError, "over its"):
                shard.check_slice_memory(compose, directory)
        self.assertEqual(limits["MemoryHigh"], "76G")
        self.assertEqual(limits["MemorySwapMax"], "0")
        self.assertEqual([limits["CPUWeight"], limits["IOWeight"]], ["100", "100"])


if __name__ == "__main__":
    unittest.main()
