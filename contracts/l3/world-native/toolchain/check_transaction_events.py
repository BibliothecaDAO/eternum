#!/usr/bin/env python3
"""Prove per-transaction event limits through the verified native runner."""

import argparse
import os
from pathlib import Path
import subprocess

import snforge


def run_case(runner, output, name, ignored=False):
    command = [str(runner), "test", "--package", "world_tests_lifecycle", "--max-threads", "1", name]
    if ignored:
        command.append("--ignored")
    result = subprocess.run(
        command,
        cwd=snforge.WORLD / "tests",
        env={**os.environ, "RAYON_NUM_THREADS": "1"},
        capture_output=True,
        text=True,
    )
    output.write_text(result.stdout + result.stderr)
    return result.returncode, result.stdout + result.stderr


def check(output):
    runner = snforge.resolve()
    output.mkdir(parents=True, exist_ok=True)
    code, log = run_case(runner, output / "separate-calls.log", "event_transactions_keep_every_event")
    if code != 0 or "Tests: 1 passed, 0 failed" not in log:
        raise RuntimeError(f"Separate transactions did not preserve all 1,200 events: {output}")
    code, log = run_case(runner, output / "over-limit.log", "event_transactions_reject_", ignored=True)
    limit_error = "Exceeded the maximum number of events, number events: 1001, max number events: 1000"
    if code == 0 or "Tests: 0 passed, 2 failed" not in log or log.count(limit_error) != 2:
        raise RuntimeError(f"Single and nested calls must both retain the 1,000-event limit: {output}")
    print(f"Separate calls preserve 1,200 events; both oversized transactions are rejected. Evidence: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=snforge.WORLD / "target/transaction-events")
    check(parser.parse_args().out.resolve())
