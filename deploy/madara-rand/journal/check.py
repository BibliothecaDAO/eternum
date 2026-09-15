#!/usr/bin/env python3
"""Run the isolated replicated-journal rehearsal and retain reproducible evidence."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect_topology():
    names = ["madara-rand-journal-primary-1", "madara-rand-journal-standby-1"]
    containers = json.loads(subprocess.check_output(["docker", "inspect", *names], text=True))
    topology = []
    for container in containers:
        if container["Config"]["Labels"].get("com.docker.compose.project") != "madara-rand":
            raise SystemExit("Refusing a journal outside the isolated rehearsal project")
        volumes = [mount["Name"] for mount in container["Mounts"] if mount["Type"] == "volume"]
        topology.append({"container": container["Name"].lstrip("/"), "image": container["Image"], "volumes": volumes})
    if len(topology[0]["volumes"]) != 1 or len(topology[1]["volumes"]) != 1 or topology[0]["volumes"] == topology[1]["volumes"]:
        raise SystemExit("The rehearsal requires two distinct journal volumes")
    return topology


def run(name, command, directory, output):
    log = output / f"{name}.log"
    with log.open("w") as stream:
        result = subprocess.run(command, cwd=directory, stdout=stream, stderr=subprocess.STDOUT, check=False)
    return {"name": name, "command": command, "exit_code": result.returncode, "log": log.name, "log_sha256": digest(log)}


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: check.py MADARA_REPOSITORY OUTPUT_DIRECTORY")
    madara = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    topology = inspect_topology()
    checks = [
        run("rust-format", ["cargo", "fmt", "--all", "--", "--check"], madara, output),
        run("rust-clippy", ["cargo", "clippy", "-p", "mc-sequencer-randomness", "--all-targets", "--all-features", "--locked", "--", "-D", "warnings"], madara, output),
        run("ticket-tests", ["cargo", "test", "-p", "mc-sequencer-randomness", "--locked"], madara, output),
        run("replicated-journal", ["cargo", "test", "-p", "mc-sequencer-randomness", "--test", "journal", "--locked", "--", "--ignored", "--nocapture"], madara, output),
    ]
    crate = madara / "madara/crates/client/sequencer-randomness"
    sources = {str(path.relative_to(crate)): digest(path) for path in sorted(crate.rglob("*")) if path.is_file()}
    sources["workspace/Cargo.lock"] = digest(madara / "Cargo.lock")
    deployment = Path(__file__).resolve().parent.parent
    for path in sorted(deployment.rglob("*")):
        if path.is_file() and path.suffix in {".py", ".sh", ".yml", ".md"}:
            sources[f"deployment/{path.relative_to(deployment)}"] = digest(path)
    report = {"schema": 1, "scope": "local rehearsal, not the host-independence gate", "journal_version": 1,
              "envelope_version": 1, "topology": topology, "sources": sources, "checks": checks,
              "host_loss_gate": "The host-loss drill is the one gate left open until the owner provides the second host",
              "submission_boundary": "batcher and native integration still require their own gates"}
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    passed = all(check["exit_code"] == 0 for check in checks)
    print(json.dumps({"report": str(output / "report.json"), "passed": passed}))
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
