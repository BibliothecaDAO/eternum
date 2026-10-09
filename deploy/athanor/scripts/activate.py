#!/usr/bin/env python3
"""Self-check and activate one runner data directory, explicitly; matrices never activate."""
import json
from pathlib import Path
import sys
import deploy
import shard


def activate(directory):
    config = json.loads((directory / "configuration.json").read_text())
    command = [*shard.DOCKER, "compose", "-f", str(directory / "compose.json")]
    with shard.isolated_stack_lock(f"activate {directory.name}"):
        deploy.verify_and_activate(config, directory, command)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 deploy/athanor/scripts/activate.py RUNNER_DATA_DIRECTORY")
    activate(Path(sys.argv[1]).resolve())
