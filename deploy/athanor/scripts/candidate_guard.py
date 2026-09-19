#!/usr/bin/env python3
"""Pause isolated candidate work when the live stack leaves its declared budget."""

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import time
from urllib.request import Request, urlopen


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


def read_digests(since):
    result = subprocess.run(
        ["journalctl", "-u", "herald", "--since", f"@{since:.6f}", "-o", "cat", "--no-pager"],
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


def budget_failures(budget, health, digests, disk_free, root_free):
    failures = []
    if health["lag_blocks"] > budget["max_lag_blocks"]:
        failures.append("live Herald lag")
    if health["health_ms"] > budget["max_health_ms"]:
        failures.append("live health response latency")
    for event in digests:
        if event["count"] > 0 and event["p95Ms"] > budget["digest_p95_ms"][event["kind"]]:
            failures.append(f"live {event['kind']} p95")
    if disk_free < budget["min_candidate_free_bytes"]:
        failures.append("candidate disk reserve")
    if root_free < budget["min_host_free_bytes"]:
        failures.append("host disk reserve")
    return failures


def pause_candidate(reasons):
    # The guard runs outside this slice; live services never belong to it.
    subprocess.run(["systemctl", "freeze", "athanor.slice"], check=True, timeout=10)
    print(json.dumps({"event": "candidate_paused", "reasons": reasons}), flush=True)


def monitor(budget):
    since = time.time()
    while True:
        next_since = time.time()
        try:
            health = check_health()
            digests = read_digests(since)
            failures = budget_failures(
                budget, health, digests,
                shutil.disk_usage("/opt/athanor").free, shutil.disk_usage("/").free,
            )
        except Exception as error:
            pause_candidate([f"live monitoring unavailable: {type(error).__name__}"])
            return 1
        print(json.dumps({"event": "candidate_live_health", **health, "digests": digests}), flush=True)
        if failures:
            pause_candidate(failures)
            return 1
        since = next_since
        time.sleep(5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("budget", type=Path)
    args = parser.parse_args()
    budget = json.loads(args.budget.read_text())
    if not Path("/opt/athanor").is_mount():
        raise SystemExit("candidate disk is not mounted")
    return monitor(budget)


if __name__ == "__main__":
    raise SystemExit(main())
