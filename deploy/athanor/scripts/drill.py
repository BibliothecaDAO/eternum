#!/usr/bin/env python3
"""Recovery drills: restart a running shard's node or gateway in the middle of a burst and prove that nothing recorded
executes twice. Each drill signals one service with SIGTERM or SIGKILL once enough of its burst has been recorded,
starts the service again, and reports the recovery height, the tickets in flight at the signal and what became of them,
the chain failures, and every duplicate or gap among the recorded executions, which must be none."""

import argparse
import calendar
import json
import os
from pathlib import Path
import subprocess
import threading
import time
from urllib.request import Request, urlopen

import shard

# The recorded-execution event's keys: sn_keccak("RecordingEvent") and sn_keccak("ExecutionRecorded").
RECORDED_EXECUTION = [["0x69f02dc1b775d01454e609e3b1a05502065f4b1d549991c82c4052131893f2"],
                      ["0x31046a1629667e4e8157bcaec0ee46928b0644e5b078ee76a3ca5a94700a0d9"]]
DRILLS = [(service, signal) for service in ("madara", "gateway") for signal in ("SIGTERM", "SIGKILL")]
BURST = {"games": 4, "accounts_per_game": 24, "minutes": 5, "interval_seconds": 15, "setup_concurrency": 24,
         "workload": "burst"}
RECOVERY_TIMEOUT = 300


def rpc(url, method, params):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    with urlopen(Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=30) as response:
        reply = json.load(response)
    if "error" in reply:
        raise RuntimeError(f"{method}: {reply['error']}")
    return reply["result"]


def recorded_executions(url, world, from_block=0):
    """Every recorded execution from `from_block`, oldest first, as (block, [game, actor, nonce, consumed, order,
    status, ...])."""
    executions, token = [], None
    while True:
        query = {"from_block": {"block_number": from_block}, "to_block": "latest", "address": world,
                 "keys": RECORDED_EXECUTION, "chunk_size": 1000, **({"continuation_token": token} if token else {})}
        page = rpc(url, "starknet_getEvents", [query])
        executions += [(event["block_number"], [int(field, 16) for field in event["data"]]) for event in page["events"]]
        token = page.get("continuation_token")
        if not token:
            return executions


def duplicates_and_gaps(executions):
    """Every (game, order) once, every consumed (game, actor, nonce) once, and each game's orders contiguous from one."""
    failures, orders, consumed, per_game = [], set(), set(), {}
    for _, (game, actor, nonce, used, order, status, *_) in executions:
        if (game, order) in orders:
            failures.append(f"game {game} order {order} recorded twice")
        orders.add((game, order))
        if used == 1:
            if (game, actor, nonce) in consumed:
                failures.append(f"game {game} actor {actor:#x} nonce {nonce} consumed twice")
            consumed.add((game, actor, nonce))
        if status not in (1, 2):
            failures.append(f"game {game} order {order} has status {status}")
        per_game.setdefault(game, []).append(order)
    for game, recorded in per_game.items():
        missing = set(range(1, max(recorded) + 1)) - set(recorded)
        if missing:
            failures.append(f"game {game} is missing orders {sorted(missing)[:10]}")
    return failures


def in_flight_outcomes(actions, signalled_ms):
    """What became of the tickets submitted before the signal and not yet recorded when it came."""
    def at(value):
        return calendar.timegm(time.strptime(value[:19], "%Y-%m-%dT%H:%M:%S")) * 1000 + int(value[20:23])

    in_flight = [a for a in actions if at(a["submitStartedAt"]) <= signalled_ms
                 and (not a.get("submittedAt") or at(a["submittedAt"]) >= signalled_ms)]
    recorded = [a for a in in_flight if a.get("outcome") == "completed"]
    return {"inFlight": len(in_flight), "recoveredAndRecorded": len(recorded), "lost": len(in_flight) - len(recorded),
            "lostReasons": sorted({(a.get("error") or a.get("outcome") or "")[:120] for a in in_flight
                                   if a.get("outcome") != "completed"})}


def reported_actions(directory):
    for path in directory.rglob("*.json"):
        report = json.loads(path.read_text())
        workload = report.get("workload") if isinstance(report, dict) else None
        if isinstance(workload, dict):
            yield from workload.get("actions", [])


def wait_until(condition, what):
    deadline = time.time() + RECOVERY_TIMEOUT
    while time.time() < deadline:
        found = condition()
        if found:
            return found
        time.sleep(0.5)
    raise RuntimeError(f"{what} within {RECOVERY_TIMEOUT} s")


def container_state(container):
    return subprocess.run([*shard.DOCKER, "inspect", "--format", "{{.State.Running}} {{.State.StartedAt}}", container],
                          capture_output=True, text=True, check=True).stdout.split()


def restart(container, signal):
    """Signals the service, waits for it to exit (or for its restart policy to have restarted it), and starts it
    again; returns when the signal was sent."""
    _, started = container_state(container)
    signalled = time.time()
    subprocess.run([*shard.DOCKER, "kill", "--signal", signal, container], check=True, capture_output=True)
    wait_until(lambda: (lambda running, since: running == "false" or since != started)(*container_state(container)),
               f"{container} did not exit")
    subprocess.run([*shard.DOCKER, "start", container], check=True, capture_output=True)
    return signalled


def run_burst(directory, environment, outcome):
    try:
        shard.run_workload(shard.workload_command(BURST), directory, environment)
        outcome["harnessPassed"] = True
    except subprocess.CalledProcessError as error:
        outcome.update(harnessPassed=False, harnessError=str(error))


def drill(run_directory, service, signal, recorded_before_signal):
    manifest = json.loads((run_directory / "manifest.json").read_text())
    url, world = manifest["rpc_url"], manifest["world"]
    private = dict(line.split("=", 1) for line in (run_directory / "harness.env").read_text().splitlines())
    directory = run_directory / f"drill-{service}-{signal.lower()}"
    directory.mkdir(mode=0o700)
    environment = {**os.environ, **private, "HARNESS_OUTPUT_DIRECTORY": str(directory / "workload")}
    start_block = rpc(url, "starknet_blockNumber", [])
    outcome = {"service": service, "signal": signal}
    burst = threading.Thread(target=run_burst, args=(directory, environment, outcome))
    burst.start()
    wait_until(lambda: len(recorded_executions(url, world, start_block)) >= recorded_before_signal,
               "the burst was not under way")
    head_at_signal = rpc(url, "starknet_blockNumber", [])
    signalled = restart(f"{manifest['project']}-{service}-1", signal)
    recovery_block, _ = wait_until(lambda: next(iter(recorded_executions(url, world, head_at_signal + 1)), None),
                                   "nothing was recorded after the restart")
    recovered = time.time()
    burst.join()
    actions = list(reported_actions(directory / "workload"))
    return {**outcome, "headAtSignal": head_at_signal, "recoveryHeight": recovery_block,
            "recoverySeconds": round(recovered - signalled, 1),
            **in_flight_outcomes(actions, signalled * 1000),
            "chainFailures": sum(1 for a in actions if a.get("failureClass") == "chain_or_driver"),
            "duplicatesOrGaps": duplicates_and_gaps(recorded_executions(url, world))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_directory", type=Path, help="a shard started by shard.py")
    parser.add_argument("--recorded-before-signal", type=int, default=100,
                        help="recorded executions of the burst that mark it as under way")
    args = parser.parse_args()
    results = [drill(args.run_directory.resolve(), service, signal, args.recorded_before_signal)
               for service, signal in DRILLS]
    shard.write_json(args.run_directory / "drills.json", results)
    print(json.dumps(results, indent=2))
    return 1 if any(result["duplicatesOrGaps"] or result["chainFailures"] for result in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
