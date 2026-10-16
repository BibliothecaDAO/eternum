#!/usr/bin/env python3
"""What a run measures from the host, beside the harness's own report: the host's state before and after, the node's
anonymous memory and kept RocksDB snapshots over time, its closed blocks and gas over the workload window, and
admission-to-visible latency split into submission and the remainder, overall, in bursts and in calm. A runner trial
and a running package shard are measured the same way.

    python3 deploy/athanor/scripts/measures.py DIRECTORY NAME -- HARNESS_OPTIONS

measures one of our package shards, the directory deploy.py deployed: it takes the isolated-stack lock, runs the
package's harness service with HARNESS_OPTIONS, and writes data/measure/NAME/result.json beside
the harness's reports in data/measure/NAME/workload.
"""

import argparse
import calendar
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

SCRIPTS = Path(__file__).resolve().parent
# The box lock ships with the shard package, beside backup.py, which takes it too.
sys.path.insert(0, str(SCRIPTS.parents[1] / "shard"))
from stack_lock import isolated_stack_lock

BLOCK_STATS = SCRIPTS / "block-stats.sh"
HOST_STATE = SCRIPTS / "host-state.sh"

BURST_NEIGHBOURS = 12
CALM_NEIGHBOURS = 4
NEIGHBOUR_WINDOW_MS = 500
SAMPLE_SECONDS = 15


# The one report contract every workload writes into its directory: a JSON object whose `workload` holds the span it
# ran, `startedAt` and `endedAt` (ISO 8601). It may also carry `workload.actions` (per-action observations) and
# `gas.l2GasByBlock`. A report that omits one did not measure it: the collector reports it unavailable, never zero.
UNAVAILABLE = "unavailable"


def percentile(values, p):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(p / 100 * len(ordered)) - 1)] if ordered else None


def iso_ms(value):
    seconds = calendar.timegm(time.strptime(value[:19], "%Y-%m-%dT%H:%M:%S"))
    return seconds * 1000 + int(value[20:23])


def reported_actions(directory):
    """Every action the reports observed, or None when no report observes actions."""
    observed = [report["workload"]["actions"] for report in workload_reports(directory)
                if isinstance(report.get("workload"), dict) and "actions" in report["workload"]]
    return [action for actions in observed for action in actions] if observed else None


def phases(group):
    return {
        "n": len(group),
        "admissionToVisibleMs": {p: percentile([a["admissionToVisibleMs"] for a in group], p) for p in (50, 95, 99)},
        "submitMs": {p: percentile([a["submitMs"] for a in group], p) for p in (50, 95)},
        "afterRecordedMs": {p: percentile([iso_ms(a["visibleAt"]) - iso_ms(a["submittedAt"]) for a in group], p)
                            for p in (50, 95)},
    }


def admission_split(directory):
    """Completed actions' admission-to-visible latency, overall, in bursts (many submissions around it) and in calm."""
    actions = reported_actions(directory)
    if actions is None:
        return {"status": UNAVAILABLE, "reason": "the workload reports no per-action observations"}
    done = [a for a in actions if a.get("outcome") == "completed"]
    for action in done:
        required = ("submitStartedAt", "submittedAt", "visibleAt", "submitMs", "admissionToVisibleMs")
        missing = [field for field in required if field not in action or action[field] is None]
        if missing:
            raise ValueError(f"Completed action bot={action.get('botId')} kind={action.get('kind')} "
                             f"is missing figures: {', '.join(missing)}")
    starts = [iso_ms(a["submitStartedAt"]) for a in done]

    def neighbours(action):
        start = iso_ms(action["submitStartedAt"])
        return sum(1 for other in starts if abs(other - start) <= NEIGHBOUR_WINDOW_MS) - 1

    return {
        "all": phases(done),
        "burst": phases([a for a in done if neighbours(a) >= BURST_NEIGHBOURS]),
        "calm": phases([a for a in done if neighbours(a) <= CALM_NEIGHBOURS]),
        "notCompleted": sum(1 for a in actions if a.get("outcome") != "completed"),
    }


def node_anon_mib(docker, container, proc=Path("/proc"), cgroups=Path("/sys/fs/cgroup")):
    """The node's anonymous memory, read from the cgroup its process is in, wherever Docker placed it."""
    pid = subprocess.check_output([*docker, "inspect", container, "--format", "{{.State.Pid}}"], text=True).strip()
    group = next(line.split("::", 1)[1] for line in (proc / pid / "cgroup").read_text().splitlines()
                 if line.startswith("0::"))
    stat = (cgroups / group.lstrip("/") / "memory.stat").read_text()
    return int(next(line.split()[1] for line in stat.splitlines() if line.startswith("anon "))) // 2**20


def node_snapshots(metrics):
    """db_num_snapshots from the newest complete line of the node's OTLP export."""
    with open(metrics, "rb") as stream:
        stream.seek(0, os.SEEK_END)
        offset = max(0, stream.tell() - 4 * 2**20)
        stream.seek(offset)
        lines = stream.read().splitlines()
        for line in reversed(lines[1:] if offset else lines):
            try:
                export = json.loads(line)
            except ValueError:
                continue
            for resource in export.get("resourceMetrics", []):
                for scope in resource["scopeMetrics"]:
                    for metric in scope["metrics"]:
                        if metric["name"] == "db_num_snapshots":
                            point = (metric.get("gauge") or metric.get("sum"))["dataPoints"][0]
                            return int(float(point.get("asInt", point.get("asDouble", 0))))
    return None


def sample_node(docker, container, metrics, stop, samples):
    """Appends the node's memory and snapshot count every SAMPLE_SECONDS until stop is set."""
    while not stop.wait(SAMPLE_SECONDS):
        at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        try:
            samples.append({"at": at, "anonMiB": node_anon_mib(docker, container),
                            "snapshots": node_snapshots(metrics)})
        except (OSError, subprocess.CalledProcessError, StopIteration) as error:
            samples.append({"at": at, "error": type(error).__name__})


def workload_reports(directory):
    for path in sorted(Path(directory).rglob("*.json")):
        report = json.loads(path.read_text())
        if isinstance(report, dict):
            yield report


def workload_window(directory):
    """From the first report's start to the last one's end: the span the harness ran its workload over."""
    spans = [report["workload"] for report in workload_reports(directory)
             if isinstance(report.get("workload"), dict) and "startedAt" in report["workload"]]
    if not spans:
        raise ValueError(f"{directory} holds no workload window: the harness reported no workload")
    return {"since": min(span["startedAt"] for span in spans), "until": max(span["endedAt"] for span in spans)}


def block_statistics(container, metrics, window):
    """The node's closed blocks over the window, from its logs and its metrics export. They are the run's close-cost
    evidence, so a window without a closed block (log rotation, a restart inside it) fails the run."""
    output = subprocess.check_output(
        [str(BLOCK_STATS), "--since", window["since"], "--until", window["until"], "--json"], text=True,
        env={**os.environ, "MADARA_CONTAINER": container, "MADARA_METRICS_FILE": str(metrics)})
    stats = json.loads(output)
    if stats["blocks"]["count"] == 0:
        raise RuntimeError(f"Block stats: no closed blocks in the node's log window "
                           f"{window['since']}..{window['until']}")
    return {**stats, "window": window}


def gas_reconciliation(directory, stats):
    """The harness's L2 gas in the node's closed blocks against the node's own total for them."""
    blocks = {"first": stats["blocks"]["first"], "last": stats["blocks"]["last"]}
    node = stats["transactions"]["l2GasConsumed"]
    reported = [report["gas"]["l2GasByBlock"] for report in workload_reports(directory)
                if isinstance(report.get("gas"), dict) and "l2GasByBlock" in report["gas"]]
    if not reported:
        return {"nodeBlocks": blocks, "nodeL2Gas": node, "status": UNAVAILABLE,
                "reason": "the workload reports no per-block gas"}
    harness = sum(gas for by_block in reported for block, gas in by_block.items()
                  if blocks["first"] <= int(block) <= blocks["last"])
    return {"nodeBlocks": blocks, "nodeL2Gas": node, "harnessL2GasInNodeBlocks": harness,
            "deltaL2Gas": node - harness, "reconciled": node == harness}


def host_state(container, chain_config):
    return json.loads(subprocess.check_output(
        ["bash", str(HOST_STATE)], text=True,
        env={**os.environ, "MADARA_CONTAINER": container, "CHAIN_CONFIG_PATH": str(chain_config)}))


def measure_workload(docker, run_workload, node, metrics, chain_config, workload):
    """Runs the workload while sampling the node, then adds what only the host sees over the window it reported."""
    evidence = {"hostStateStart": host_state(node, chain_config)}
    stop, samples = threading.Event(), []
    sampler = threading.Thread(target=sample_node, args=(docker, node, metrics, stop, samples), daemon=True)
    sampler.start()
    try:
        evidence["workloadPassed"] = run_workload()
    finally:
        stop.set()
        sampler.join()
        evidence["nodeSamples"] = samples
        evidence["hostStateEnd"] = host_state(node, chain_config)
    evidence["blockStats"] = block_statistics(node, metrics, workload_window(workload))
    evidence["gasReconciliation"] = gas_reconciliation(workload, evidence["blockStats"])
    evidence["admission"] = admission_split(workload)
    return evidence


def run_package_harness(compose, name, options):
    """The package's harness service, writing into data/measure/NAME/workload; whether its run passed."""
    command = [*compose, "run", "--rm", "-e", f"HARNESS_OUTPUT_DIRECTORY=/data/measure/{name}/workload", "harness",
               *options]
    return subprocess.run(command).returncode == 0


def measure_package(directory, name, options, docker):
    """Measures a workload against a running package shard and writes its one result."""
    data = directory / "data"
    output = data / "measure" / name
    compose = [*docker, "compose", "--project-directory", str(directory)]
    result = {"name": name, "commit": json.loads((directory / "release.json").read_text())["commit"],
              "harnessOptions": options, "passed": False}
    # A refused lock leaves nothing behind; an existing run's evidence is never overwritten.
    with isolated_stack_lock(f"measure {name}"):
        output.mkdir(parents=True)
        node = subprocess.check_output([*compose, "ps", "-q", "madara"], text=True).strip()
        try:
            result.update(measure_workload(
                docker, lambda: run_package_harness(compose, name, options), node,
                data / "metrics" / "metrics.jsonl", data / "chain-config.yaml", output / "workload"))
            result["passed"] = result["workloadPassed"]
        except Exception as error:
            result["error"] = str(error)
    (output / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(f"{'PASS' if result['passed'] else 'FAIL'}: {output / 'result.json'}")
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directory", type=Path)
    parser.add_argument("name")
    arguments = sys.argv[1:]
    separator = arguments.index("--") if "--" in arguments else len(arguments)
    args = parser.parse_args(arguments[:separator])
    options = arguments[separator + 1:]
    from shard import DOCKER
    raise SystemExit(measure_package(args.directory.resolve(), args.name, options, DOCKER))
