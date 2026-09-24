"""What a trial measures beside the harness's own report: admission-to-visible latency split into its gateway part
and the rest, overall, in bursts and in calm; and the node's anonymous memory and kept RocksDB snapshots over time."""

import calendar
import json
import math
import os
from pathlib import Path
import subprocess
import time

BURST_NEIGHBOURS = 12
CALM_NEIGHBOURS = 4
NEIGHBOUR_WINDOW_MS = 500
SAMPLE_SECONDS = 15


def percentile(values, p):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(p / 100 * len(ordered)) - 1)] if ordered else None


def iso_ms(value):
    seconds = calendar.timegm(time.strptime(value[:19], "%Y-%m-%dT%H:%M:%S"))
    return seconds * 1000 + int(value[20:23])


def reported_actions(directory):
    for path in Path(directory).rglob("*.json"):
        report = json.loads(path.read_text())
        workload = report.get("workload") if isinstance(report, dict) else None
        if isinstance(workload, dict):
            yield from workload.get("actions", [])


def phases(group):
    return {
        "n": len(group),
        "admissionToVisibleMs": {p: percentile([a["admissionToVisibleMs"] for a in group], p) for p in (50, 95, 99)},
        "gatewayMs": {p: percentile([a["submitMs"] for a in group], p) for p in (50, 95)},
        "afterRecordedMs": {p: percentile([iso_ms(a["visibleAt"]) - iso_ms(a["submittedAt"]) for a in group], p)
                            for p in (50, 95)},
    }


def admission_split(directory):
    """Completed actions' admission-to-visible latency, overall, in bursts (many submissions around it) and in calm."""
    actions = list(reported_actions(directory))
    done = [a for a in actions if a.get("outcome") == "completed" and a.get("visibleAt") and a.get("submittedAt")]
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


def node_anon_mib(docker, container, slice_directory):
    identifier = subprocess.check_output([*docker, "inspect", container, "--format", "{{.Id}}"], text=True).strip()
    stat = (Path(slice_directory) / f"docker-{identifier}.scope/memory.stat").read_text()
    return int(next(line.split()[1] for line in stat.splitlines() if line.startswith("anon "))) // 2**20


def node_snapshots(metrics):
    """db_num_snapshots from the newest complete line of the node's OTLP export."""
    with open(metrics, "rb") as stream:
        stream.seek(0, os.SEEK_END)
        stream.seek(max(0, stream.tell() - 4 * 2**20))
        for line in reversed(stream.read().splitlines()[1:]):
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


def sample_node(docker, container, slice_directory, metrics, stop, samples):
    """Appends the node's memory and snapshot count every SAMPLE_SECONDS until stop is set."""
    while not stop.wait(SAMPLE_SECONDS):
        at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        try:
            samples.append({"at": at, "anonMiB": node_anon_mib(docker, container, slice_directory),
                            "snapshots": node_snapshots(metrics)})
        except (OSError, subprocess.CalledProcessError, StopIteration) as error:
            samples.append({"at": at, "error": type(error).__name__})
