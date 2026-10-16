import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import measures
import stack_lock


def snapshot_export(count):
    return {"resourceMetrics": [{"scopeMetrics": [{"metrics": [{
        "name": "db_num_snapshots", "gauge": {"dataPoints": [{"asInt": str(count)}]},
    }]}]}]}


ROOT = Path(__file__).resolve().parents[3]
SPLIT = ROOT / "deploy/athanor/harness/blitz-split.ts"


def write_split_report(path, outcome):
    """The Blitz split's report as its own builder writes it: a launch of 2,000 players, or one that threw."""
    script = f"""
      import {{ writeFileSync }} from "node:fs";
      import {{ failedSplitReport, slotLaunches, splitReport }} from {json.dumps(str(SPLIT))};
      const seaters = Array.from({{ length: 16 }}, (_, index) => "0x" + (index + 1).toString(16));
      const launches = slotLaunches(2000, seaters, 1792118000000);
      const window = {{ startedAt: "2026-10-16T02:39:47.370Z", endedAt: "2026-10-16T02:41:04.396Z" }};
      const report = {json.dumps(outcome)} === "launched"
        ? splitReport({{ launches, summaries: launches.map((launch, index) => ({{ gameId: index + 1,
            settlementTransactions: launch.players.length }})), seaters: 16, poolJoinMs: 2500, registrationWaitMs: 3000,
            wholeSplitMs: 77026, ...window }})
        : failedSplitReport({{ players: 2000, ...window, error: new Error("roster_seating_did_not_progress") }});
      writeFileSync({json.dumps(str(path))}, JSON.stringify(report));
    """
    subprocess.run(["bun", "-e", script], cwd=ROOT, check=True, capture_output=True)


class MeasuresTests(unittest.TestCase):
    def test_a_launched_blitz_split_completes_the_shared_measurement_without_inventing_gas_or_actions(self):
        with tempfile.TemporaryDirectory() as temporary:
            workload = Path(temporary) / "workload"
            workload.mkdir()
            stats = {"blocks": {"count": 73, "first": 120, "last": 192}, "transactions": {"l2GasConsumed": 900}}
            with patch.object(measures, "host_state", return_value={"load": 1}), \
                 patch.object(measures, "sample_node"), \
                 patch.object(measures, "block_statistics", side_effect=lambda _n, _m, window: {**stats, "window": window}):
                evidence = measures.measure_workload(
                    ["docker"], lambda: write_split_report(workload / "split.json", "launched") or True, "node",
                    Path("m"), Path("c"), workload)
            self.assertTrue(evidence["workloadPassed"])
            self.assertEqual(evidence["blockStats"]["window"],
                             {"since": "2026-10-16T02:39:47.370Z", "until": "2026-10-16T02:41:04.396Z"})
            self.assertEqual(evidence["gasReconciliation"], {
                "nodeBlocks": {"first": 120, "last": 192}, "nodeL2Gas": 900, "status": "unavailable",
                "reason": "the workload reports no per-block gas"})
            self.assertEqual(evidence["admission"],
                             {"status": "unavailable", "reason": "the workload reports no per-action observations"})
            report = json.loads((workload / "split.json").read_text())
            self.assertEqual((report["passed"], report["players"], report["games"], report["transactions"]),
                             (True, 2000, 84, {"create": 84, "seat": 2000}))

    def test_a_failed_blitz_split_stays_failed_and_keeps_its_report(self):
        with tempfile.TemporaryDirectory() as temporary:
            workload = Path(temporary)

            def failing():
                write_split_report(workload / "split.json", "threw")
                raise subprocess.CalledProcessError(1, ["bun", "blitz-split.ts"])

            with patch.object(measures, "host_state", return_value={"load": 1}), patch.object(measures, "sample_node"), \
                 self.assertRaises(subprocess.CalledProcessError):
                measures.measure_workload(["docker"], failing, "node", Path("m"), Path("c"), workload)
            report = json.loads((workload / "split.json").read_text())
            self.assertEqual(report, {
                "passed": False, "players": 2000, "error": "Error: roster_seating_did_not_progress",
                "workload": {"startedAt": "2026-10-16T02:39:47.370Z", "endedAt": "2026-10-16T02:41:04.396Z"}})

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
        self.assertEqual(split["all"]["submitMs"][95], 100)
        self.assertEqual(split["all"]["afterRecordedMs"][95], 250)
        self.assertEqual(split["all"]["admissionToVisibleMs"][95], 350)

    def test_completed_actions_name_every_missing_figure(self):
        with tempfile.TemporaryDirectory() as temporary:
            report = Path(temporary) / "report.json"
            report.write_text(json.dumps({"workload": {"actions": [{
                "outcome": "completed", "botId": 7, "kind": "Explore",
                "submitStartedAt": "2026-09-25T10:00:00.000Z", "submitMs": 100,
            }]}}))
            with self.assertRaisesRegex(ValueError,
                    "bot=7 kind=Explore is missing figures: submittedAt, visibleAt, admissionToVisibleMs"):
                measures.admission_split(temporary)

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

    def test_the_package_measurement_drives_the_harness_service_without_cpu_limits(self):
        with patch.object(measures.subprocess, "run") as run:
            run.return_value.returncode = 0
            self.assertTrue(measures.run_package_harness(["docker", "compose"], "soak", ["--bots", "1"]))
        command = run.call_args.args[0]
        self.assertEqual(command, ["docker", "compose", "run", "--rm", "-e",
                                   "HARNESS_OUTPUT_DIRECTORY=/data/measure/soak/workload", "harness", "--bots", "1"])

    def test_a_refused_lock_leaves_no_run_directory_so_the_same_name_reruns(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "run"
            directory.mkdir()
            (directory / "release.json").write_text(json.dumps({"commit": "abc"}))
            lock = Path(temporary) / "isolated-stack.lock"
            lock.write_text("deploy dev 2026-10-14T15:00:00Z\n")
            for _ in range(2):
                with patch.object(measures, "isolated_stack_lock", lambda holder: stack_lock.isolated_stack_lock(holder, lock)), \
                        self.assertRaisesRegex(RuntimeError, "is held: deploy dev"):
                    measures.measure_package(directory, "check", [], ["docker"])
                self.assertFalse((directory / "data" / "measure").exists())


if __name__ == "__main__":
    unittest.main()
