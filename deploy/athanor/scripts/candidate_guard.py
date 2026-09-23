#!/usr/bin/env python3
"""Record live health beside candidate load. Each sample lists the declared live budgets it exceeded and what the
isolated slice was doing, so the slice's pin and the budgets are tuned on evidence. Nothing is paused."""

import json
from decimal import Decimal
from pathlib import Path
import shutil
import subprocess
import time
from urllib.request import Request, urlopen


LIVE_BUDGET_PATH = Path(__file__).resolve().parents[1] / "live-budget.json"
SLICE = Path("/sys/fs/cgroup/athanor.slice")
LOCK = Path("/opt/athanor/isolated-stack.lock")


def read_json(url, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    request = Request(url, data=data, headers={"Content-Type": "application/json"})
    with urlopen(request, timeout=2) as response:
        return json.load(response)


def check_health():
    started = time.monotonic()
    herald = read_json("http://127.0.0.1:3003/health")
    identity = read_json("http://127.0.0.1:3000/health")
    launcher = read_json("http://127.0.0.1:3006/health")
    head = read_json("http://127.0.0.1:5050/rpc/v0_10_2", {
        "jsonrpc": "2.0", "id": 1, "method": "starknet_blockNumber", "params": [],
    })
    if not herald["success"] or not identity["success"] or launcher["status"] != "ok":
        raise RuntimeError("live health endpoint is unhealthy")
    return {"lag_blocks": head["result"] - herald["confirmed_block"],
            "health_ms": (time.monotonic() - started) * 1000}


def read_digests(since, until):
    # Journal bounds are inclusive; each digest belongs to only one polling window.
    exclusive_since = Decimal(f"{since:.6f}") + Decimal("0.000001")
    result = subprocess.run(
        ["journalctl", "-u", "herald", "--since", f"@{exclusive_since}",
         "--until", f"@{until:.6f}", "-o", "cat", "--no-pager"],
        capture_output=True, text=True, check=True, timeout=5,
    )
    digests = []
    for line in result.stdout.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("event") == "herald_diff_latency_digest":
            digests.append(event)
    return digests


def over_budget(budget, health, digests, disk_free, root_free):
    """The declared live budgets one sample exceeded."""
    observations = [
        ("live Herald lag", health["lag_blocks"] > budget["max_lag_blocks"]),
        ("live health response latency", health["health_ms"] > budget["max_health_ms"]),
        ("candidate disk reserve", disk_free < budget["min_candidate_free_bytes"]),
        ("host disk reserve", root_free < budget["min_host_free_bytes"]),
    ]
    observations.extend(
        (f"live {event['kind']} p95", event["p95Ms"] > budget["digest_p95_ms"][event["kind"]])
        for event in digests if event["count"] > 0
    )
    return list(dict.fromkeys(reason for reason, exceeded in observations if exceeded))


def unmeasured_budgets(digests):
    """Budgets a live window could not measure. Herald digests every kind together, so confirmed diffs without
    pre-confirmed samples mean the live Herald does not sample them (it may predate that). The live guard reports it and
    never fails on it; a run's own measurement is what must refuse an empty pre-confirmed window."""
    counts = {event["kind"]: event["count"] for event in digests}
    if counts.get("confirmed", 0) > 0 and counts.get("preconfirmed", 0) == 0:
        return ["live preconfirmed p95"]
    return []


def slice_activity(previous_usage, seconds):
    """Who holds the isolated stack and how many cores the slice used since the previous sample."""
    try:
        lock = LOCK.read_text().splitlines()[0]
    except (OSError, IndexError):
        lock = None
    stat = dict(line.split() for line in (SLICE / "cpu.stat").read_text().splitlines())
    usage = int(stat["usage_usec"])
    cores = None if previous_usage is None or seconds <= 0 else round((usage - previous_usage) / (seconds * 1e6), 2)
    return {"lock": lock, "cpu_cores": cores}, usage


def sample_live(budget, since, until):
    health = check_health()
    digests = read_digests(since, until)
    exceeded = over_budget(budget, health, digests,
                           shutil.disk_usage("/opt/athanor").free, shutil.disk_usage("/").free)
    return {"event": "live_health", **health, "digests": digests, "over_budget": exceeded,
            "unmeasured": unmeasured_budgets(digests)}


def record(budget):
    since = time.time()
    usage = None
    while True:
        until = time.time()
        activity, usage = slice_activity(usage, until - since)
        try:
            sample = sample_live(budget, since, until)
        except Exception as error:
            sample = {"event": "live_health_unavailable", "error": type(error).__name__}
        print(json.dumps({**sample, "at": until, "slice": activity}), flush=True)
        since = until
        time.sleep(5)


def main():
    budget = json.loads(LIVE_BUDGET_PATH.read_text())
    if not Path("/opt/athanor").is_mount():
        raise SystemExit("candidate disk is not mounted")
    record(budget)


if __name__ == "__main__":
    raise SystemExit(main())
