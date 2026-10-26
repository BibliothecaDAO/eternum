"""pull_events keeps the Games contract's events whole across runs stopped at any point, and reads each block once.

Run: python3 -m unittest discover -s apps/game/scripts/live-data -p "test_*.py"
"""
import gzip
import importlib.util
import json
import os
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
GAMES = "0x56ea85ca3b4fc1a5b12c97fc2f683be170b09ed11b32c39bf294cfc0823b78"


def load_live_data(cwd):
    """The script as `python3 live-data.py` runs it from `cwd`, so its raw/ folder is that folder's."""
    spec = importlib.util.spec_from_file_location("live_data", os.path.join(HERE, "live-data.py"))
    module = importlib.util.module_from_spec(spec)
    before = os.getcwd()
    os.chdir(cwd)
    try:
        spec.loader.exec_module(module)
    finally:
        os.chdir(before)
    return module


class Chain:
    """Prod's public answers for the calls pull_events makes: the manifest, the schema and getEvents pages."""

    def __init__(self, blocks):
        self.events = [{"block_number": b, "transaction_hash": hex(b), "transaction_index": 0, "event_index": 0,
                        "keys": ["0x1"], "data": []} for b in blocks]
        self.fail_on_page = None
        self.pages = 0

    def get(self, url):
        if url.endswith("/manifest"):
            return {"contracts": {"games": GAMES}, "releaseSchemas": {"1": "abc"}, "rpcUrl": "rpc"}
        return {"identity": "abc"}

    def rpc_batch(self, _url, calls):
        (_, params), = calls
        flt = params["filter"]
        self.pages += 1
        if self.pages == self.fail_on_page:
            raise ConnectionError("the run stops here")
        first, last = flt["from_block"]["block_number"], flt["to_block"]["block_number"]
        events = [e for e in self.events if first <= e["block_number"] <= last]
        # Two events a page, so a pull spans pages.
        start = int(flt.get("continuation_token") or 0)
        page = {"events": events[start : start + 2]}
        if start + 2 < len(events):
            page["continuation_token"] = str(start + 2)
        return [page]


class PullEvents(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.live = load_live_data(self.root)
        self.pull = os.path.join(self.root, "raw", "pull")
        os.makedirs(self.pull)
        self.chain = Chain(blocks=[3, 5, 8, 12, 15, 19])
        self.live.get, self.live.rpc_batch = self.chain.get, self.chain.rpc_batch
        self.segments = os.path.join(self.root, "raw", "games-events", GAMES)

    def kept(self):
        """Every event the published segments hold, in the order the usage step reads them."""
        names = sorted((n for n in os.listdir(self.segments) if self.live.EVENT_SEGMENT.match(n)),
                       key=lambda n: int(n.split("-")[0]))
        blocks = []
        for name in names:
            with gzip.open(os.path.join(self.segments, name), "rt") as f:
                blocks += [json.loads(line)["block_number"] for line in f]
        return names, blocks

    def test_a_run_stopped_while_writing_leaves_nothing_published_and_the_next_run_reads_every_block(self):
        self.chain.fail_on_page = 2
        with self.assertRaises(ConnectionError):
            self.live.pull_events(self.pull, "herald", 10)
        # A writer killed mid-segment leaves only its .part, half written.
        with open(os.path.join(self.segments, "0-10.jsonl.gz.part"), "wb") as f:
            f.write(gzip.compress(b'{"block_number": 3}\n')[:12])
        self.assertEqual(self.live.events_scanned_through(self.segments), -1)
        self.chain.fail_on_page = None
        self.live.pull_events(self.pull, "herald", 10)
        self.assertEqual(self.kept(), (["0-10.jsonl.gz"], [3, 5, 8]))

    def test_a_run_again_after_its_segment_was_published_adds_nothing_and_the_next_pull_starts_after_it(self):
        self.live.pull_events(self.pull, "herald", 10)
        pages = self.chain.pages
        self.live.pull_events(self.pull, "herald", 10)
        self.assertEqual(self.chain.pages, pages, "a block already kept is not read again")
        self.live.pull_events(self.pull, "herald", 20)
        self.assertEqual(self.kept(), (["0-10.jsonl.gz", "11-20.jsonl.gz"], [3, 5, 8, 12, 15, 19]))

    def test_the_pull_keeps_the_manifest_and_schema_the_usage_step_decodes_with(self):
        self.live.pull_events(self.pull, "herald", 10)
        with open(os.path.join(self.pull, "manifest.json")) as f:
            self.assertEqual(json.load(f)["contracts"]["games"], GAMES)
        with open(os.path.join(self.pull, "schema.json")) as f:
            self.assertEqual(json.load(f)["identity"], "abc")


if __name__ == "__main__":
    unittest.main()
