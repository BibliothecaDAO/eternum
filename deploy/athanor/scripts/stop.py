#!/usr/bin/env python3
"""Stop a runner shard and retire its directory registration."""
from pathlib import Path
import sys
import shard


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 deploy/athanor/scripts/stop.py RUNNER_DATA_DIRECTORY")
    directory = Path(sys.argv[1]).resolve()
    with shard.isolated_stack_lock(f"stop {directory.name}"):
        shard.stop_shard(directory)
