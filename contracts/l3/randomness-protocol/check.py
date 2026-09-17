#!/usr/bin/env python3
"""Check recorded execution against the protocol, native gameplay and original derivation."""

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
        if root.is_file():
            sources[name] = digest(root)
            continue
        if not root.is_dir():
            raise SystemExit(f"Missing source path: {root}")
        for path in sorted(root.rglob("*")):
            if not path.is_file() or any(part in {"target", ".snfoundry_cache", "__pycache__"} for part in path.relative_to(root).parts):
                continue
            sources[f"{name}/{path.relative_to(root)}"] = digest(path)
    return sources


def require_clean_sources(repository, paths):
    result = subprocess.run(["git", "status", "--porcelain", "--", *[str(path) for path in paths]],
                            cwd=repository, capture_output=True, text=True, check=True)
    if result.stdout:
        raise SystemExit(f"Commit source changes before collecting evidence:\n{result.stdout}")


def source_roots(protocol, rust, madara):
    native = protocol.parent / "world-native"
    repository = protocol.parents[2]
    roots = {"rust": rust, "cairo": protocol}
    for relative in ["Cargo.lock", "Cargo.toml", "rust-toolchain.toml"]:
        roots[f"madara/{relative}"] = madara / relative
    for relative in ["src", "tests", "vendor", "scripts", "schema", "Scarb.toml", "Scarb.lock", ".tool-versions"]:
        roots[f"native/{relative}"] = native / relative
    for relative in ["src/utils/random.cairo", "tests/randomness_protocol.cairo", "Scarb.toml", "Scarb.lock"]:
        roots[f"game/{relative}"] = protocol.parent / "game" / relative
    for relative in ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "apps/herald/src/model-registry.ts",
                     "apps/herald/src/store-layout.ts", "apps/herald/src/types.ts", "packages/core/package.json",
                     "packages/core/tsup.config.ts", "packages/core/src/sync/model-manifest.ts"]:
        roots[f"schema-runtime/{relative}"] = repository / relative
    return roots


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: check.py MADARA_REPOSITORY OUTPUT_DIRECTORY")
    protocol = Path(__file__).resolve().parent
    madara = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    rust = madara / "madara/crates/client/sequencer-randomness"
    native = protocol.parent / "world-native"
    roots = source_roots(protocol, rust, madara)
    rust_roots = [root for name, root in roots.items() if name == "rust" or name.startswith("madara/")]
    cairo_roots = [root for root in roots.values() if root not in rust_roots]
    require_clean_sources(madara, rust_roots)
    require_clean_sources(protocol, cairo_roots)
    sources = collect_sources(roots)
    fixture = protocol / "tests/fixtures/v2.txt"
    for name in ["v2.txt", "context-v1.txt"]:
        if (protocol / "tests/fixtures" / name).read_bytes() != (rust / "tests/fixtures" / name).read_bytes():
            raise SystemExit(f"Rust and Cairo fixtures differ: {name}")
    gates = [
        run_gate("rust-fmt", ["cargo", "fmt", "--all", "--", "--check"], madara, output),
        run_gate("rust-vectors", ["cargo", "test", "-p", "mc-sequencer-randomness", "--locked"], madara, output),
        run_gate("rust-clippy", ["cargo", "clippy", "-p", "mc-sequencer-randomness", "--all-targets",
                                "--all-features", "--locked", "--", "-D", "warnings"], madara, output),
        run_gate("cairo-vectors", ["snforge", "test"], protocol, output),
        run_gate("protocol-build", ["scarb", "build"], protocol, output),
        run_gate("native-conformance", ["snforge", "test"], native, output),
        run_gate("native-build", ["scarb", "build"], native, output),
        run_gate("schema-dependencies", ["pnpm", "--filter", "@bibliothecadao/eternum...", "run", "build"],
                 protocol.parents[2], output),
        run_gate("native-schema", ["bun", "scripts/generate-schema.mjs", "--check"], native, output),
        run_gate("native-abi", [sys.executable, str(protocol / "check-entrypoint.py"),
                               str(native / "target/dev/world_native_SeasonDomain.contract_class.json"),
                               str(output / "native-abi.json")], protocol, output),
        run_gate("current-game", ["snforge", "test", "recorded_roots_preserve_current_game_derivation"],
                 protocol.parent / "game", output),
    ]
    if sources != collect_sources(roots):
        raise SystemExit("Sources changed while collecting evidence")
    report = {"schema": 2, "scope": "local protocol and native gameplay conformance; no deployed recovery or latency claim",
              "sourceTreeDirty": False,
              "sourceTreeSha256": hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest(),
              "fixture_sha256": digest(fixture), "sources": sources,
              "gates": gates}
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"report": str(output / "report.json"), "passed": all(g["exit_code"] == 0 for g in gates)}))
    raise SystemExit(0 if all(g["exit_code"] == 0 for g in gates) else 1)


if __name__ == "__main__":
    main()
