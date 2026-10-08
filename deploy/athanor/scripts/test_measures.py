import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

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

    def test_burst_window_includes_both_boundaries_and_duplicate_submission_times(self):
        def action(milliseconds):
            return {"outcome": "completed", "submitStartedAt": f"2026-10-08T00:00:00.{milliseconds:03}Z",
                    "submittedAt": "2026-10-08T00:00:01.000Z", "visibleAt": "2026-10-08T00:00:01.100Z",
                    "submitMs": 10, "admissionToVisibleMs": 100}

        actions = [*[action(0) for _ in range(12)], action(500), action(501)]
        with tempfile.TemporaryDirectory() as temporary:
            (Path(temporary) / "report.json").write_text(json.dumps({"workload": {"actions": actions}}))
            split = measures.admission_split(temporary)
        self.assertEqual(split["burst"]["n"], 13)
        self.assertEqual(split["calm"]["n"], 1)
        self.assertEqual(split["all"]["n"], 14)

    def test_node_memory_is_read_from_the_containers_own_cgroup(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "proc" / "4242").mkdir(parents=True)
            (root / "proc" / "4242" / "cgroup").write_text("0::/system.slice/docker-" + "a" * 64 + ".scope\n")
            scope = root / "cgroup" / "system.slice" / ("docker-" + "a" * 64 + ".scope")
            scope.mkdir(parents=True)
            (scope / "memory.stat").write_text("anon 104857600\nfile 4096\n")
            with patch.object(measures.subprocess, "check_output", return_value="4242\n") as inspect:
                self.assertEqual(measures.node_anon_mib(["docker"], "node", root / "proc", root / "cgroup"), 100)
            self.assertEqual(inspect.call_args.args[0], ["docker", "inspect", "node", "--format", "{{.State.Pid}}"])

    def test_the_workload_window_spans_every_report_a_run_wrote(self):
        with tempfile.TemporaryDirectory() as temporary:
            workload = Path(temporary)
            (workload / "players").mkdir()
            for name, started, ended in (("a", "10:00:05", "10:30:00"), ("players/b", "10:00:01", "10:31:00")):
                (workload / f"{name}.json").write_text(json.dumps({"workload": {
                    "startedAt": f"2026-10-07T{started}.000Z", "endedAt": f"2026-10-07T{ended}.000Z"}}))
            (workload / "summary.json").write_text(json.dumps({"passed": True}))
            self.assertEqual(measures.workload_window(workload),
                             {"since": "2026-10-07T10:00:01.000Z", "until": "2026-10-07T10:31:00.000Z"})
            with self.assertRaisesRegex(ValueError, "no workload window"):
                measures.workload_window(workload / "players" / "empty")

    def test_block_statistics_need_a_closed_block_in_the_window(self):
        window = {"since": "2026-10-07T10:00:00.000Z", "until": "2026-10-07T10:10:00.000Z"}
        with tempfile.TemporaryDirectory() as temporary:
            script = Path(temporary) / "block-stats.sh"
            script.write_text('#!/bin/sh\n'
                              'echo "{\\"blocks\\": {\\"count\\": $COUNT}, \\"node\\": \\"$MADARA_CONTAINER\\"}"\n')
            script.chmod(0o755)
            with patch.object(measures, "BLOCK_STATS", script), patch.dict(measures.os.environ, {"COUNT": "3"}):
                stats = measures.block_statistics("node", Path("metrics.jsonl"), window)
            self.assertEqual(stats, {"blocks": {"count": 3}, "node": "node", "window": window})
            with patch.object(measures, "BLOCK_STATS", script), patch.dict(measures.os.environ, {"COUNT": "0"}), \
                 self.assertRaisesRegex(RuntimeError, "no closed blocks"):
                measures.block_statistics("node", Path("metrics.jsonl"), window)

    def test_the_harness_gas_reconciles_against_the_nodes_blocks(self):
        with tempfile.TemporaryDirectory() as temporary:
            workload = Path(temporary)
            (workload / "a.json").write_text(json.dumps({"gas": {"l2GasByBlock": {"10": 1000, "11": 300}}}))
            (workload / "b.json").write_text(json.dumps({"gas": {"l2GasByBlock": {"11": 200, "13": 310, "20": 7}}}))
            stats = {"blocks": {"first": 11, "last": 13}, "transactions": {"l2GasConsumed": 810}}
            self.assertEqual(measures.gas_reconciliation(workload, stats), {
                "nodeBlocks": {"first": 11, "last": 13}, "nodeL2Gas": 810, "harnessL2GasInNodeBlocks": 810,
                "deltaL2Gas": 0, "reconciled": True,
            })

    def test_a_failed_workload_keeps_its_node_samples_and_host_state(self):
        def failing():
            raise RuntimeError("workload failed")

        with patch.object(measures, "host_state", return_value={"load": 1}) as host, \
             patch.object(measures, "sample_node"), self.assertRaisesRegex(RuntimeError, "workload failed"):
            measures.measure_workload(["docker"], failing, "node", Path("m"), Path("c"), Path("w"))
        self.assertEqual(host.call_count, 2)

    def test_the_package_measurement_drives_the_harness_service_on_its_own_cpus(self):
        with patch.object(measures.subprocess, "run") as run:
            run.return_value.returncode = 0
            self.assertTrue(measures.run_package_harness(["docker", "compose"], "soak", "20-23", ["--bots", "1"]))
        command, environment = run.call_args.args[0], run.call_args.kwargs["env"]
        self.assertEqual(command, ["docker", "compose", "run", "--rm", "-e",
                                   "HARNESS_OUTPUT_DIRECTORY=/data/measure/soak/workload", "harness", "--bots", "1"])
        self.assertEqual(environment["HARNESS_CPUSET"], "20-23")


if __name__ == "__main__":
    unittest.main()
