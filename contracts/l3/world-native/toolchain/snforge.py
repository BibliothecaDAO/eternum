#!/usr/bin/env python3
"""Build and resolve the pinned native test runner; never select it from PATH."""

import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile

WORLD = Path(__file__).resolve().parent.parent
SOURCE = "ab78eeeb51a991ffd4b65e7be30b8791009066d5"
TAG = "v0.64.0"
RUST = "1.94.1"
PATCHES = ("library-call-rollback.patch", "test-memory.patch")
BUILD_ENV = {
    "OPENSSL_NO_VENDOR": "1",
    "CARGO_PROFILE_RELEASE_LTO": "false",
    "CARGO_PROFILE_RELEASE_CODEGEN_UNITS": "16",
    "RUSTFLAGS": "",
    "CARGO_ENCODED_RUSTFLAGS": "",
    "RUSTC_WRAPPER": "",
    "RUSTC_WORKSPACE_WRAPPER": "",
}
BUILD_ARGS = ["build", "--locked", "--release", "--bin", "snforge", "-j", "2"]


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def identity():
    tools = (WORLD / ".tool-versions").read_text()
    versions = dict(line.split() for line in tools.splitlines() if line.strip())
    if versions.get("starknet-foundry") != TAG[1:]:
        raise ValueError("Update the runner source/tag together with the Foundry toolchain pin")
    return {
        "source": SOURCE,
        "tag": TAG,
        "patches": {name: digest(WORLD / "toolchain" / name) for name in PATCHES},
        "rust": RUST,
        "tools": tools,
        "platform": [sys.platform, platform.machine()],
        "build_env": BUILD_ENV,
        "build_args": BUILD_ARGS,
    }


def install_directory(spec):
    key = hashlib.sha256(json.dumps(spec, sort_keys=True).encode()).hexdigest()
    data = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share"))
    return data.resolve() / "eternum-native-tools/snforge" / key


@contextmanager
def install_lock(directory):
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / ".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def validate_version(binary):
    version = subprocess.check_output([str(binary), "--version"], text=True, stderr=subprocess.PIPE).strip()
    if version != f"snforge {TAG[1:]}":
        raise ValueError(f"Unexpected runner version: {version}")


def installed(directory, spec):
    try:
        manifest = json.loads((directory / "manifest.json").read_text())
        if manifest["identity"] != spec:
            return None
        binary = directory / "snforge"
        if manifest["sha256"] != digest(binary):
            return None
        validate_version(binary)
        return binary
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError):
        return None


def resolve():
    spec = identity()
    directory = install_directory(spec)
    with install_lock(directory):
        binary = installed(directory, spec)
    if binary is None:
        raise RuntimeError(
            f"Missing or stale native runner at {directory}. "
            f"Run: bash {WORLD / 'build-snforge.sh'}"
        )
    return binary


def publish(candidate, directory, spec):
    """Copy and validate before replacing; an incomplete publication fails resolution."""
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".install-", dir=directory) as staging:
        staging = Path(staging)
        binary = staging / "snforge"
        shutil.copyfile(candidate, binary)
        binary.chmod(0o755)
        validate_version(binary)
        manifest = staging / "manifest.json"
        manifest.write_text(json.dumps({"identity": spec, "sha256": digest(binary)}, indent=2) + "\n")
        for path in (binary, manifest):
            with path.open("rb") as output:
                os.fsync(output.fileno())
        with install_lock(directory):
            os.replace(binary, directory / "snforge")
            os.replace(manifest, directory / "manifest.json")
            descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(descriptor)
            finally:
                os.close(descriptor)
    return directory / "snforge"


def run(command, **kwargs):
    subprocess.run(command, check=True, stdout=sys.stderr, **kwargs)


def build():
    spec = identity()
    directory = install_directory(spec)
    with install_lock(directory):
        binary = installed(directory, spec)
    if binary is not None:
        return binary

    # System OpenSSL avoids the vendored Perl build; check its development package before compiling.
    run(["pkg-config", "--exists", "openssl"])
    run(["rustup", "toolchain", "install", RUST, "--profile", "minimal"])
    cache = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")).resolve() / "eternum-native-tools"
    cache.mkdir(parents=True, exist_ok=True)
    target = Path(os.environ.get("CARGO_TARGET_DIR", cache / "target")).resolve()
    with tempfile.TemporaryDirectory(prefix="snforge-", dir=cache) as scratch:
        source = Path(scratch) / "source"
        run(["git", "clone", "--depth", "1", "--branch", TAG,
             "https://github.com/foundry-rs/starknet-foundry.git", str(source)])
        revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
        if revision != SOURCE:
            raise RuntimeError(f"Foundry tag resolved to {revision}, expected {SOURCE}")
        for patch in PATCHES:
            run(["git", "-C", str(source), "apply", str(WORLD / "toolchain" / patch)])
        run(["cargo", f"+{RUST}", *BUILD_ARGS, "--manifest-path", str(source / "Cargo.toml")],
            env={**os.environ, **BUILD_ENV, "CARGO_TARGET_DIR": str(target)})
        if identity() != spec:
            raise RuntimeError("Runner inputs changed during the build; rerun build-snforge.sh")
        return publish(target / "release/snforge", directory, spec)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("build", "resolve"))
    args = parser.parse_args()
    try:
        print(build() if args.action == "build" else resolve())
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
