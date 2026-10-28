#!/usr/bin/env python3
"""Run a shard command with the environment credential read from its protected file."""
import os
from pathlib import Path
import sys
import shard
import season
import teardown
from operator_token import operator_environment

COMMANDS = {
    "deploy": "deploy.py", "runner": "shard.py",
    "stop": "stop.py", "measure": "measures.py", "teardown": "teardown.py", "season": "season.py",
}


def run(command, arguments):
    if command not in COMMANDS:
        raise ValueError("Use a listed shard command")
    if command == "teardown":
        teardown.parse_arguments(arguments)
    if command == "season":
        season.parse_arguments(arguments)
    executable = str(Path(__file__).with_name(COMMANDS[command]))
    os.execve(sys.executable, [sys.executable, executable, *arguments], {**os.environ, **operator_environment()})


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit("Usage: python3 deploy/athanor/scripts/operator-command.py deploy|runner|stop|measure|teardown|season ARGUMENTS")
    run(sys.argv[1], sys.argv[2:])
