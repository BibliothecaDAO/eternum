#!/usr/bin/env python3
"""Pause isolated candidate work when the live stack leaves its declared budget."""

import json
from decimal import Decimal
from pathlib import Path
import shutil
import subprocess
import time
from urllib.request import Request, urlopen


LIVE_BUDGET_PATH = Path(__file__).resolve().parents[1] / "live-budget.json"


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


def budget_failures(budget, health, digests, disk_free, root_free, streaks):
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
    # Herald digests every kind together; confirmed diffs with no pre-confirmed samples mean that budget measures nothing.
    counts = {event["kind"]: event["count"] for event in digests}
    if counts.get("confirmed", 0) > 0:
        observations.append(("live preconfirmed digest empty", counts.get("preconfirmed", 0) == 0))
    failures = []
    for reason, exceeded in observations:
        streaks[reason] = streaks.get(reason, 0) + 1 if exceeded else 0
        if streaks[reason] >= 2 and reason not in failures:
            failures.append(reason)
    return failures


def pause_candidate(reasons):
    # The guard runs outside this slice; live services never belong to it.
    subprocess.run(["systemctl", "freeze", "athanor.slice"], check=True, timeout=10)
    print(json.dumps({"event": "candidate_paused", "at": time.time(), "reasons": reasons}), flush=True)


def monitor(budget):
    since = time.time()
    streaks = {}
    unavailable_windows = 0
    while True:
        next_since = time.time()
        try:
            health = check_health()
            digests = read_digests(since, next_since)
            failures = budget_failures(
                budget, health, digests,
                shutil.disk_usage("/opt/athanor").free, shutil.disk_usage("/").free, streaks,
            )
        except Exception as error:
            unavailable_windows += 1
            print(json.dumps({"event": "candidate_live_monitoring_unavailable", "at": time.time(),
                              "error": type(error).__name__}), flush=True)
            if unavailable_windows >= 2:
                pause_candidate([f"live monitoring unavailable: {type(error).__name__}"])
                return 1
            time.sleep(5)
            continue
        unavailable_windows = 0
        print(json.dumps({"event": "candidate_live_health", "at": next_since,
                          **health, "digests": digests}), flush=True)
        if failures:
            pause_candidate(failures)
            return 1
        since = next_since
        time.sleep(5)


def main():
    budget = json.loads(LIVE_BUDGET_PATH.read_text())
    if not Path("/opt/athanor").is_mount():
        raise SystemExit("candidate disk is not mounted")
    return monitor(budget)


if __name__ == "__main__":
    raise SystemExit(main())
