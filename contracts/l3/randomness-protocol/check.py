#!/usr/bin/env python3
"""Run the same recorded-entropy fixtures in Rust, Cairo and the current game."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys


def run_gate(name, command, directory, output):
    log = output / f"{name}.log"
    with log.open("w") as stream:
        result = subprocess.run(command, cwd=directory, stdout=stream, stderr=subprocess.STDOUT, check=False)
    return {"name": name, "command": command, "exit_code": result.returncode,
            "log": log.name, "log_sha256": digest(log)}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def collect_sources(roots):
    sources = {}
    for name, root in roots.items():
        for path in sorted(root.rglob("*")):
            if not path.is_file() or any(part in {"target", ".snfoundry_cache"} for part in path.relative_to(root).parts):
                continue
            sources[f"{name}/{path.relative_to(root)}"] = digest(path)
    return sources


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: check.py MADARA_REPOSITORY OUTPUT_DIRECTORY")
    protocol = Path(__file__).resolve().parent
    madara = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    rust = madara / "madara/crates/client/sequencer-randomness"
    fixture = protocol / "tests/fixtures/v1.txt"
    if fixture.read_bytes() != (rust / "tests/fixtures/v1.txt").read_bytes():
        raise SystemExit("Rust and Cairo fixtures differ")
    gates = [
        run_gate("rust-vectors", ["cargo", "test", "-p", "mc-sequencer-randomness", "--locked"], madara, output),
        run_gate("rust-clippy", ["cargo", "clippy", "-p", "mc-sequencer-randomness", "--all-targets",
                                "--all-features", "--locked", "--", "-D", "warnings"], madara, output),
        run_gate("cairo-vectors", ["snforge", "test"], protocol, output),
        run_gate("current-game", ["snforge", "test", "recorded_roots_preserve_current_game_derivation"],
                 protocol.parent / "game", output),
    ]
    sources = collect_sources({"rust": rust, "cairo": protocol})
    for relative in ["src/utils/random.cairo", "tests/randomness_protocol.cairo", "Scarb.toml", "Scarb.lock"]:
        sources[f"game/{relative}"] = digest(protocol.parent / "game" / relative)
    sources["madara/Cargo.lock"] = digest(madara / "Cargo.lock")
    report = {"schema": 1, "scope": "protocol encoding and existing derivation only",
              "fixture_sha256": digest(fixture), "sources": sources,
              "gates": gates}
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"report": str(output / "report.json"), "passed": all(g["exit_code"] == 0 for g in gates)}))
    raise SystemExit(0 if all(g["exit_code"] == 0 for g in gates) else 1)


if __name__ == "__main__":
    main()
