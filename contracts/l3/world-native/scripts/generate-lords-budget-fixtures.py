#!/usr/bin/env python3
"""Record bounded season checkpoints with the compiled conservation test; never reimplement its rules."""

import re
import subprocess
from pathlib import Path

WORLD = Path(__file__).resolve().parent.parent
SOURCE = WORLD / "src/tests/lords_budget.cairo"
DIRECTORY = WORLD / "src/tests/fixtures/lords-budget"
INPUT = WORLD / "target/budget-checkpoint-input.txt"
PRODUCER = "world_native::tests::lords_budget::record_budget_checkpoint"


def constant(name):
    match = re.search(rf"^const {name}: u(?:32|64) = ([0-9]+);$", SOURCE.read_text(), re.M)
    if not match:
        raise ValueError(f"Missing simulation constant {name}")
    return int(match[1])


def record_chunk(quiet, clear, first, past, previous):
    fields = [2000, quiet, int(clear), first, past]
    fields += [1] if previous is None else [0, *previous]
    INPUT.write_text("".join(f"{value}\n" for value in fields))
    result = subprocess.run(
        ["snforge", "test", PRODUCER, "--exact", "--ignored", "--max-threads", "1"],
        cwd=WORLD, text=True, capture_output=True, check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    records = re.findall(r"BUDGET_CHECKPOINT\s+\[([^\]]+)\]", result.stdout)
    if len(records) != 1:
        raise ValueError("Producer must emit exactly one checkpoint")
    values = [int(token.strip(), 0) for token in records[0].split(",") if token.strip()]
    if len(values) != 21 or values[:5] != fields[:5]:
        raise ValueError("Checkpoint shape or scenario does not match its input")
    if previous is not None and values[5:13] != previous:
        raise ValueError("Checkpoint lost the preceding budget or running totals")
    print(f"Recorded density=2000 quiet={quiet} clear={clear} days={first}..{past - 1}", flush=True)
    return values


def main():
    days, chunk_days, chunks = (constant(name) for name in ("SEASON_DAYS", "CHUNK_DAYS", "CHUNKS"))
    if days != chunk_days * chunks:
        raise ValueError("Chunks must cover the whole season exactly")
    INPUT.parent.mkdir(parents=True, exist_ok=True)
    records = []
    try:
        for quiet, clear in [(0, True), (30, True), (0, False)]:
            previous = None
            for chunk in range(chunks):
                first = chunk * chunk_days
                record = record_chunk(quiet, clear, first, first + chunk_days, previous)
                records.append(record)
                previous = record[13:21]
    finally:
        INPUT.unlink(missing_ok=True)
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    values = [len(records), *(value for record in records for value in record)]
    output = DIRECTORY / "seasons.txt"
    temporary = output.with_suffix(".tmp")
    temporary.write_text("".join(f"{value}\n" for value in values))
    temporary.replace(output)
    print(f"Recorded {len(records)} chained checkpoints; all 315 days and 570000 dense attempts retained")


if __name__ == "__main__":
    main()
