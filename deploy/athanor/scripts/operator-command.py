#!/usr/bin/env python3
"""Run a shard command with the environment credential read from its protected file."""
import os
from pathlib import Path
import re
import sys
import shard

CREDENTIALS = Path("/etc/athanor")
COMMANDS = {"deploy": "deploy.py", "runner": "shard.py", "activate": "activate.py", "stop": "stop.py", "measure": "measures.py"}


def run(environment, command, arguments):
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,30}", environment) or command not in COMMANDS:
        raise ValueError("Use an environment name and a listed shard command")
    token = shard.read_protected_text(CREDENTIALS / environment / "operator-token").strip()
    if not token or any(character.isspace() for character in token):
        raise ValueError("Protected operator token must be nonempty and occupy one line")
    executable = str(Path(__file__).with_name(COMMANDS[command]))
    args = [environment, *arguments] if command == "deploy" else arguments
    os.execve(sys.executable, [sys.executable, executable, *args], {**os.environ, "OPERATOR_TOKEN": token})


if __name__ == "__main__":
    if len(sys.argv) < 4:
        raise SystemExit("Usage: python3 deploy/athanor/scripts/operator-command.py ENVIRONMENT deploy|runner|activate|stop|measure ARGUMENTS")
    run(sys.argv[1], sys.argv[2], sys.argv[3:])
