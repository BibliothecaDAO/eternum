#!/usr/bin/env python3
"""Start a fresh isolated shard through the existing native deployment commands."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import time
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[3]
POSTGRES_IMAGE = "postgres@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73"
DOCKER = ["sudo", "-n", "docker"]


def cpu_numbers(value):
    numbers = set()
    for item in value.split(","):
        ends = item.split("-")
        if len(ends) > 2 or not all(end.isdigit() for end in ends):
            raise ValueError("invalid cpuset")
        first, last = int(ends[0]), int(ends[-1])
        if first > last:
            raise ValueError("invalid cpuset range")
        numbers.update(range(first, last + 1))
    return numbers


def validate_configuration(config, allowed_cpus):
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", config["shard"]):
        raise ValueError("shard must be a lowercase identifier")
    for key in ("madara_image", "herald_image"):
        if not re.fullmatch(r"(?:[^\s]+@)?sha256:[a-f0-9]{64}", config[key]):
            raise ValueError(f"{key} must be pinned by digest")
    port = config["port_base"]
    if not isinstance(port, int) or not 28000 <= port <= 65532:
        raise ValueError("reserve three isolated ports above 27999")
    if not cpu_numbers(config["cpuset"]) <= allowed_cpus:
        raise ValueError("cpuset exceeds the native slice allocation")
    if not isinstance(config["node_memory_mib"], int) or not 1024 <= config["node_memory_mib"] <= 28672:
        raise ValueError("node memory must fit the native slice budget")
    # These options belong to the shard lifecycle, never to a performance lever.
    owned = ("--base-path", "--chain-config", "--rpc", "--name", "--db", "--devnet", "--l1", "--no-charge")
    for flag in config["node_flags"]:
        if not isinstance(flag, str) or not flag.startswith("--") or flag.startswith(owned):
            raise ValueError(f"node flag overrides shard ownership: {flag}")
    if not any(flag.startswith("--enable-native-execution=") for flag in config["node_flags"]):
        raise ValueError("record the native execution setting explicitly")
    if not any(flag.startswith("--native-compilation-mode=") for flag in config["node_flags"]):
        raise ValueError("record the native compilation mode explicitly")


def read(command):
    return subprocess.check_output(command, text=True, cwd=ROOT).strip()


def run(command, directory, name, environment=None):
    with (directory / f"{name}.log").open("w") as output:
        subprocess.run(command, cwd=ROOT, env=environment, stdout=output, stderr=subprocess.STDOUT, check=True)


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def write_private_environment(path, values):
    if any("\n" in str(value) for value in values.values()):
        raise ValueError("environment values must occupy one line")
    with open(path, "w", opener=lambda name, flags: os.open(name, flags, 0o600)) as stream:
        stream.write("".join(f"{key}={value}\n" for key, value in values.items()))


def compose_configuration(config, directory):
    project = f"athanor-{config['shard']}"
    base = config["port_base"]
    budget = {
        "cgroup_parent": "athanor.slice", "cpuset": config["cpuset"], "pids_limit": 2048,
        "logging": {"driver": "json-file", "options": {"max-size": "20m", "max-file": "3"}},
    }
    node_command = [
        f"--name={project}", "--devnet", "--base-path=/data", "--db-fsync", "--db-wal",
        "--chain-config-path=/config/chain-config.yaml", "--rpc-external", "--rpc-cors=all",
        "--rpc-port=9944", "--no-charge-fee", "--l1-sync-disabled", *config["node_flags"],
    ]
    return {
        "name": project,
        "services": {
            "madara": {
                **budget, "image": config["madara_image"], "entrypoint": ["tini", "--", "/bin/madara"],
                "command": node_command, "env_file": [str(directory / "node.env")],
                "mem_limit": f"{config['node_memory_mib']}m", "memswap_limit": f"{config['node_memory_mib']}m",
                "ports": [f"127.0.0.1:{base}:9944"],
                "volumes": ["chain:/data", f"{directory / 'chain-config.yaml'}:/config/chain-config.yaml:ro"],
            },
            "postgres": {
                **budget, "image": POSTGRES_IMAGE, "mem_limit": "512m", "memswap_limit": "512m",
                "env_file": [str(directory / "postgres.env")], "ports": [f"127.0.0.1:{base + 2}:5432"],
                "volumes": ["postgres:/var/lib/postgresql/data"],
                "healthcheck": {"test": ["CMD", "pg_isready", "-U", "herald", "-d", "herald"],
                                "interval": "2s", "timeout": "3s", "retries": 30},
            },
            "herald": {
                **budget, "image": config["herald_image"], "mem_limit": "2g", "memswap_limit": "2g",
                "env_file": [str(directory / "herald.env")], "ports": [f"127.0.0.1:{base + 1}:3003"],
                "volumes": [f"{directory / 'native-world.json'}:/config/native-world.json:ro"],
                "depends_on": {"postgres": {"condition": "service_healthy"}},
            },
        },
        "volumes": {"chain": {}, "postgres": {}},
    }


def ensure_fresh_project(config):
    project = f"athanor-{config['shard']}"
    label = f"label=com.docker.compose.project={project}"
    for command in (["ps", "-aq", "--filter", label], ["volume", "ls", "-q", "--filter", label]):
        if read([*DOCKER, *command]):
            raise ValueError(f"{project} already owns state; choose a fresh shard id")
    for port in range(config["port_base"], config["port_base"] + 3):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", port))


def wait_for_endpoint(url, rpc=False):
    deadline = time.monotonic() + 120
    last_error = None
    while time.monotonic() < deadline:
        try:
            payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "starknet_blockNumber", "params": []})
            request = Request(url, data=payload.encode() if rpc else None,
                              headers={"Content-Type": "application/json"})
            started = time.monotonic()
            with urlopen(request, timeout=3) as response:
                value = json.load(response)
            if (rpc and "result" in value) or (not rpc and value.get("success")):
                return (time.monotonic() - started) * 1000
            last_error = value
        except (OSError, ValueError) as error:
            last_error = str(error)
        time.sleep(1)
    raise RuntimeError(f"endpoint did not become healthy: {url}: {last_error}")


def deploy_world(config, directory, environment):
    def bun(script, *args, name):
        run(["bun", script, *args], directory, name, environment)

    seed = f"athanor-{config['shard']}"
    prepare = "deploy/athanor/harness/native/prepare-authority.ts"
    bun("deploy/athanor/scripts/deploy-gameplay-contracts.ts", name="identity-deploy")
    identity = json.loads((directory / "gameplay-contracts.json").read_text())
    bun(prepare, seed, name="authority-deploy")
    authority = json.loads((directory / "authority.json").read_text())["address"]
    command = [
        "--seed", seed, "--manifest", environment["NATIVE_WORLD_MANIFEST"],
        "--identity", environment["GAMEPLAY_CONTRACTS_PATH"], "--submitter", authority,
        "--world-address-file", str(directory / "world-address"),
    ]
    bun("config/deployer/clean/cli/deploy-world.ts", *command, name="world-deploy")
    bun(prepare, seed, environment["NATIVE_WORLD_MANIFEST"], name="authority-bind")
    bun("config/deployer/clean/cli/deploy-world.ts", *command, "--inspect", name="world-inspect")
    environment["DEPLOYER_ACCOUNT_ADDRESS"] = identity["operatorAccountAddress"]
    bun("config/deployer/clean/registrar/register-preset.ts", "--environment", "madara.blitz",
        "--preset-id", "2", "--balance-profile", "official-60", name="blitz-preset")
    return authority


def deployment_environment(config, directory):
    credentials = {key: os.environ[key] for key in ("DEPLOYER_ACCOUNT_ADDRESS", "DEPLOYER_PRIVATE_KEY")}
    base = config["port_base"]
    return {
        **os.environ, **credentials, "RPC_URL": f"http://127.0.0.1:{base}/rpc/v0_10_2",
        "ADMISSION_URL": f"http://127.0.0.1:{base}/rpc/v0_10_2",
        "HERALD_URL": f"http://127.0.0.1:{base + 1}",
        "COMPOSE_PROJECT_NAME": f"athanor-{config['shard']}",
        "CHAIN_CONFIG_PATH": str(directory / "chain-config.yaml"),
        "BINDING_AUTHORITY_ADDRESS": credentials["DEPLOYER_ACCOUNT_ADDRESS"],
        "BINDING_AUTHORITY_PRIVATE_KEY": credentials["DEPLOYER_PRIVATE_KEY"],
        "RANDOMNESS_PRIVATE_KEY": "0x" + secrets.token_hex(31),
        "NATIVE_AUTHORITY_FILE": str(directory / "authority.json"),
        "NATIVE_WORLD_MANIFEST": str(directory / "native-world.json"),
        "GAMEPLAY_CONTRACTS_PATH": str(directory / "gameplay-contracts.json"),
    }


def prepare_runtime_files(directory, environment):
    # The node waits for the game deployment while ordinary declaration remains available.
    node_environment = {
        "RANDOMNESS_ACCOUNT": "0x0", "RANDOMNESS_DEPLOYMENT": "0x0",
        "RANDOMNESS_PRIVATE_KEY": environment["RANDOMNESS_PRIVATE_KEY"],
        "RANDOMNESS_EPOCH_SECRET": "/data/game-epoch-secret.json", "RUST_LOG": "info",
    }
    password = secrets.token_hex(24)
    write_private_environment(directory / "node.env", node_environment)
    write_private_environment(directory / "postgres.env", {
        "POSTGRES_USER": "herald", "POSTGRES_DB": "herald", "POSTGRES_PASSWORD": password,
    })
    write_private_environment(directory / "herald.env", {
        "PORT": "3003", "HERALD_CHAIN": "madara", "HERALD_RPC_URL": "http://madara:9944/rpc/v0_10_2",
        "NATIVE_WORLD_MANIFEST": "/config/native-world.json",
        "DATABASE_URL": f"postgres://herald:{password}@postgres:5432/herald",
    })
    return node_environment


def save_harness_environment(directory, environment):
    keys = (
        "DEPLOYER_ACCOUNT_ADDRESS", "DEPLOYER_PRIVATE_KEY", "RPC_URL", "ADMISSION_URL", "HERALD_URL",
        "BINDING_AUTHORITY_ADDRESS", "BINDING_AUTHORITY_PRIVATE_KEY", "RANDOMNESS_PRIVATE_KEY",
        "NATIVE_AUTHORITY_FILE", "NATIVE_WORLD_MANIFEST", "GAMEPLAY_CONTRACTS_PATH",
        "COMPOSE_PROJECT_NAME", "CHAIN_CONFIG_PATH",
    )
    write_private_environment(directory / "harness.env", {key: environment[key] for key in keys})


def deployment_manifest(config, compose, directory, manifest, rpc_rtt, herald_rtt):
    return {
        **config, "project": compose["name"], "revision": read(["git", "rev-parse", "HEAD"]),
        "chain_config_sha256": hashlib.sha256((directory / "chain-config.yaml").read_bytes()).hexdigest(),
        "node_command": compose["services"]["madara"]["command"], "rpc_url": f"http://127.0.0.1:{config['port_base']}/rpc/v0_10_2",
        "herald_url": f"http://127.0.0.1:{config['port_base'] + 1}", "rtt_ms": {"rpc": rpc_rtt, "herald": herald_rtt},
        "world": manifest["world"]["address"], "native_schema": manifest["native"]["activeSchema"],
    }


def start_shard(config, directory):
    allowed = cpu_numbers(Path("/sys/fs/cgroup/athanor.slice/cpuset.cpus.effective").read_text().strip())
    validate_configuration(config, allowed)
    ensure_fresh_project(config)
    if os.environ.get("LEDGER_ADDRESS") or os.environ.get("LEDGER_RPC_URL"):
        raise ValueError("shard preparation does not deploy or configure the deferred ledger")
    directory = directory.resolve()
    environment = deployment_environment(config, directory)
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    shutil.copyfile(config["chain_config"], directory / "chain-config.yaml")
    write_json(directory / "configuration.json", config)
    node_environment = prepare_runtime_files(directory, environment)
    compose = compose_configuration(config, directory)
    write_json(directory / "compose.json", compose)
    command = [*DOCKER, "compose", "-f", str(directory / "compose.json")]
    run([*command, "up", "-d", "madara", "postgres"], directory, "bootstrap-start")
    wait_for_endpoint(environment["RPC_URL"], rpc=True)
    authority = deploy_world(config, directory, environment)
    manifest = json.loads((directory / "native-world.json").read_text())
    node_environment.update(RANDOMNESS_ACCOUNT=authority, RANDOMNESS_DEPLOYMENT=manifest["world"]["address"])
    write_private_environment(directory / "node.env", node_environment)
    run([*command, "up", "-d", "--force-recreate", "madara", "herald"], directory, "shard-start")
    rpc_rtt = wait_for_endpoint(environment["RPC_URL"], rpc=True)
    herald_rtt = wait_for_endpoint(environment["HERALD_URL"] + "/health")
    save_harness_environment(directory, environment)
    result = deployment_manifest(config, compose, directory, manifest, rpc_rtt, herald_rtt)
    write_json(directory / "manifest.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("configuration", type=Path)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    print(json.dumps(start_shard(json.loads(args.configuration.read_text()), args.directory)))
