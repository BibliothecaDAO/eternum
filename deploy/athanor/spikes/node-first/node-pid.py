#!/usr/bin/env python3
"""Select Madara itself for CPU and memory observations, excluding its init wrapper."""
import subprocess
import sys
from pathlib import Path


def madara_pid(container):
    root = int(subprocess.check_output(
        ["sudo", "-n", "docker", "inspect", "--format", "{{.State.Pid}}", container], text=True
    ))
    pending, matches = [root], []
    while pending:
        pid = pending.pop()
        try:
            if Path(f"/proc/{pid}/comm").read_text().strip() == "madara":
                matches.append(pid)
            pending.extend(int(child) for child in
                           Path(f"/proc/{pid}/task/{pid}/children").read_text().split())
        except FileNotFoundError:
            continue
    if len(matches) != 1:
        raise RuntimeError("Expected exactly one live Madara process")
    return matches[0]


if __name__ == "__main__":
    print(madara_pid(sys.argv[1]))
