import json
from pathlib import Path
import tempfile
import unittest

import measures


def snapshot_export(count):
    return {"resourceMetrics": [{"scopeMetrics": [{"metrics": [{
        "name": "db_num_snapshots", "gauge": {"dataPoints": [{"asInt": str(count)}]},
    }]}]}]}


class MeasuresTests(unittest.TestCase):
    def test_snapshot_count_uses_the_latest_complete_export_including_the_first(self):
        with tempfile.TemporaryDirectory() as temporary:
            metrics = Path(temporary) / "metrics.jsonl"
            metrics.write_text(json.dumps(snapshot_export(4)) + "\n")
            self.assertEqual(measures.node_snapshots(metrics), 4)
            with metrics.open("a") as stream:
                stream.write(json.dumps(snapshot_export(7)) + '\n{"resourceMetrics":')
            self.assertEqual(measures.node_snapshots(metrics), 7)

    def test_latency_split_distinguishes_bursts_calm_and_incomplete_actions(self):
        def action(second):
            return {"outcome": "completed", "submitStartedAt": f"2026-09-25T10:00:{second:02}.000Z",
                    "submittedAt": f"2026-09-25T10:00:{second:02}.100Z",
                    "visibleAt": f"2026-09-25T10:00:{second:02}.350Z",
                    "submitMs": 100, "admissionToVisibleMs": 350}

        with tempfile.TemporaryDirectory() as temporary:
            report = Path(temporary) / "report.json"
            report.write_text(json.dumps({"workload": {"actions": [
                *[action(0) for _ in range(13)], action(5), {"outcome": "submit_failed"},
            ]}}))
            split = measures.admission_split(temporary)
        self.assertEqual([split[kind]["n"] for kind in ("all", "burst", "calm")], [14, 13, 1])
        self.assertEqual(split["notCompleted"], 1)
        self.assertEqual(split["all"]["gatewayMs"][95], 100)
        self.assertEqual(split["all"]["afterRecordedMs"][95], 250)
        self.assertEqual(split["all"]["admissionToVisibleMs"][95], 350)


if __name__ == "__main__":
    unittest.main()
