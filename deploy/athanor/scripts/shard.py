#!/usr/bin/env python3
"""Start a fresh isolated shard through the existing native deployment commands."""

import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import signal
import shutil
import socket
import subprocess
import time
from urllib.request import Request, urlopen
from urllib.parse import urlparse

import candidate_guard


ROOT = Path(__file__).resolve().parents[3]
METRICS_CONTEXT = ROOT / "deploy/athanor/metrics"
DOCKER = ["sudo", "-n", "docker"]
# Gateway connections: each player holds about two (a 100-connection server refused a 96-player slot at its 48th
# player), plus a fixed allowance for the sequencing authority, Herald and tooling. The node's own limit is the
# package's: players never reach the node directly.
CONNECTIONS_PER_PLAYER = 2
TOOLING_CONNECTIONS = 32
DEFAULT_NODE_MEMORY_MIB = 24576
SLICE = Path("/sys/fs/cgroup/athanor.slice")
# The services that hold memory for the shard's lifetime; prepare and init exit once the shard is deployed.
LONG_RUNNING = ("madara", "postgres", "herald", "gateway", "rpc", "metrics")


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


def admission_connections(config):
    return config["player_capacity"] * CONNECTIONS_PER_PLAYER + TOOLING_CONNECTIONS


def validate_configuration(config, allowed_cpus):
    if not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", config["shard"]):
        raise ValueError("shard must be a lowercase identifier")
    validate_shard_identity(config)
    if "madara_image" in config:
        raise ValueError("the node image is the package's pin in deploy/shard/compose.yml")
    for key in ("herald_image", "gateway_image", "init_image"):
        if not re.fullmatch(r"(?:[^\s]+@)?sha256:[a-f0-9]{64}", config[key]):
            raise ValueError(f"{key} must be pinned by digest")
    port = config["port_base"]
    if not isinstance(port, int) or not 28000 <= port <= 65530:
        raise ValueError("reserve isolated ports base through base+3 and base+5 above 27999")
    if not cpu_numbers(config["cpuset"]) <= allowed_cpus:
        raise ValueError("cpuset exceeds the native slice allocation")
    memory = config.get("node_memory_mib", DEFAULT_NODE_MEMORY_MIB)
    if not isinstance(memory, int) or not 1024 <= memory <= 28672:
        raise ValueError("node memory must fit the native slice budget")
    # These options belong to the shard lifecycle, never to a performance lever, except the database levers named
    # after them.
    owned = ("--base-path", "--chain-config", "--rpc", "--name", "--db", "--devnet", "--l1", "--no-charge", "--otel")
    levers = ("--db-max-kept-snapshots=",)
    for flag in config["node_flags"]:
        if not isinstance(flag, str) or not flag.startswith("--") or (flag.startswith(owned)
                                                                     and not flag.startswith(levers)):
            raise ValueError(f"node flag overrides shard ownership: {flag}")
    if not any(flag.startswith("--enable-native-execution=") for flag in config["node_flags"]):
        raise ValueError("record the native execution setting explicitly")
    if not any(flag.startswith("--native-compilation-mode=") for flag in config["node_flags"]):
        raise ValueError("record the native compilation mode explicitly")


def validate_shard_identity(config):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,30}", config.get("chain_id", "")):
        raise ValueError("chain_id must be a unique 1-31 character ASCII shard name")
    for key in ("guardian_url", "public_rpc_url", "public_admission_url"):
        url = urlparse(config[key])
        if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password:
            raise ValueError(f"{key} must be an explicit HTTP endpoint without credentials")
    if not isinstance(config["player_capacity"], int) or not 1 <= config["player_capacity"] <= 1024:
        raise ValueError("player_capacity must be the shard's player count, 1 to 1024")
    if "trusted_proxy" in config:
        ipaddress.ip_address(config["trusted_proxy"])


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


def admission_url(config):
    return f"http://127.0.0.1:{config['port_base'] + 3}"


def compose_configuration(config, directory):
    environment = {
        **os.environ, "SHARD_NAME": f"athanor-{config['shard']}", "CHAIN_ID": config["chain_id"],
        "SHARD_DATA": str(directory), "SHARD_INIT_IMAGE": config["init_image"],
        "SHARD_HERALD_IMAGE": config["herald_image"], "SHARD_GATEWAY_IMAGE": config["gateway_image"],
        "GUARDIAN_URL": config["guardian_url"], "PUBLIC_RPC_URL": config["public_rpc_url"],
        "PUBLIC_ADMISSION_URL": config["public_admission_url"], "PLAYER_CAPACITY": str(config["player_capacity"]),
        "TRUSTED_PROXY": config.get("trusted_proxy", ""),
        "HOST_UID": str(os.getuid()), "HOST_GID": str(os.getgid()), "BIND_ADDRESS": "127.0.0.1",
        "RPC_PORT": str(config["port_base"] + 5), "HERALD_PORT": str(config["port_base"] + 1),
        "ADMISSION_PORT": str(config["port_base"] + 3),
        "NODE_MEMORY": f"{config.get('node_memory_mib', DEFAULT_NODE_MEMORY_MIB)}m",
    }
    compose = json.loads(subprocess.check_output([
        "docker", "compose", "-f", str(ROOT / "deploy/shard/compose.yml"), "config", "--format", "json",
    ], env=environment, text=True))
    budget = {
        "cgroup_parent": "athanor.slice", "cpuset": config["cpuset"], "pids_limit": 2048,
        "logging": {"driver": "json-file", "options": {"max-size": "20m", "max-file": "3"}},
    }
    for service in compose["services"].values():
        service.update(budget)
    for name in ("prepare", "init"):
        service = compose["services"][name]
        service.update({"mem_limit": "8g", "memswap_limit": "8g"})
        service["environment"]["CHAIN_CONFIG"] = "/template/chain-config.yaml"
        service["volumes"].append({"type": "bind", "source": str(Path(config["chain_config"]).resolve()),
                                   "target": "/template/chain-config.yaml", "read_only": True})
    node = compose["services"]["madara"]
    replaced = ("--enable-native-execution=", "--native-compilation-mode=")
    node["command"] = [flag for flag in node["command"] if not flag.startswith(replaced)] + [
        "--otel-collector-endpoint=http://metrics:4317", "--otel-export-metrics=true", *config["node_flags"],
    ]
    node["ports"] = [f"127.0.0.1:{config['port_base']}:9944"]
    compose["services"]["postgres"]["ports"] = [f"127.0.0.1:{config['port_base'] + 2}:5432"]
    compose["services"]["metrics"] = {
        **budget, "image": collector_image(), "build": {"context": str(METRICS_CONTEXT)},
        "mem_limit": "256m", "memswap_limit": "256m",
        "user": f"{os.getuid()}:{os.getgid()}", "command": ["--config=/config/collector.json"],
        "volumes": ["public-config:/config:ro", f"{directory / 'metrics'}:/data",
                    "/sys/fs/cgroup:/host-cgroup:ro"],
        "read_only": True, "cap_drop": ["ALL"], "security_opt": ["no-new-privileges:true"],
        "depends_on": {"prepare": {"condition": "service_completed_successfully"}},
    }
    return compose


def memory_bytes(value):
    units = {"k": 2**10, "m": 2**20, "g": 2**30}
    text = str(value).lower()
    return int(text[:-1]) * units[text[-1]] if text[-1] in units else int(text)


def check_slice_memory(compose, slice_directory=SLICE):
    """Refuse a shard whose limits, beside every container already in the slice, exceed the slice's memory.max:
    otherwise the slice kills processes before any container reaches its own limit."""
    budget = (slice_directory / "memory.max").read_text().strip()
    if budget == "max":
        return
    held = 0
    for scope in slice_directory.glob("docker-*.scope"):
        limit = (scope / "memory.max").read_text().strip()
        if limit == "max":
            raise ValueError(f"{scope.name} runs in the native slice without a memory limit")
        held += int(limit)
    wanted = sum(memory_bytes(compose["services"][name]["mem_limit"]) for name in LONG_RUNNING)
    if held + wanted > int(budget):
        raise ValueError(f"the shard needs {wanted >> 20} MiB beside {held >> 20} MiB already held in the native "
                         f"slice, over its {int(budget) >> 20} MiB")


def ensure_fresh_project(config):
    project = f"athanor-{config['shard']}"
    label = f"label=com.docker.compose.project={project}"
    for command in (["ps", "-aq", "--filter", label], ["volume", "ls", "-q", "--filter", label]):
        if read([*DOCKER, *command]):
            raise ValueError(f"{project} already owns state; choose a fresh shard id")
    for port in [config["port_base"] + offset for offset in (0, 1, 2, 3, 5)]:
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
        "--preset-id", "2", name="blitz-preset")
    bun("config/deployer/clean/registrar/register-preset.ts", "--environment", "madara.frontier",
        "--preset-id", "1", name="frontier-preset")
    return authority


def deployment_environment(config, directory):
    keys = json.loads((directory / "host-keys.json").read_text())
    credentials = {"DEPLOYER_ACCOUNT_ADDRESS": keys["deployerAddress"],
                   "DEPLOYER_PRIVATE_KEY": keys["deployerPrivateKey"]}
    base = config["port_base"]
    return {
        **os.environ, **credentials, "RPC_URL": f"http://127.0.0.1:{base}/rpc/v0_10_2",
        "ADMISSION_URL": admission_url(config),
        "HERALD_URL": f"http://127.0.0.1:{base + 1}",
        "HERALD_PUBLIC_RPC_URL": config["public_rpc_url"],
        "HERALD_PUBLIC_ADMISSION_URL": config["public_admission_url"],
        "COMPOSE_PROJECT_NAME": f"athanor-{config['shard']}",
        "CHAIN_CONFIG_PATH": str(directory / "chain-config.yaml"),
        "RANDOMNESS_PRIVATE_KEY": keys["sequencingPrivateKey"],
        "SHARD_HOST_ACCOUNTS": str(directory / "host-accounts.json"),
        "NATIVE_AUTHORITY_FILE": str(directory / "authority.json"),
        "NATIVE_WORLD_MANIFEST": str(directory / "native-world.json"),
        "GAMEPLAY_CONTRACTS_PATH": str(directory / "gameplay-contracts.json"),
        "MADARA_METRICS_FILE": str(directory / "metrics" / "metrics.jsonl"),
        # The node image and container as this shard runs them: a measured harness run records both as evidence.
        "MADARA_IMAGE": config["madara_image"],
        "MADARA_CONTAINER": config.get("madara_container", f"athanor-{config['shard']}-madara-1"),
    }


def collector_image():
    source = b"".join((METRICS_CONTEXT / name).read_bytes() for name in ("Dockerfile", "collect_cpu.py"))
    return f"athanor-metrics:{hashlib.sha256(source).hexdigest()}"


def collector_configuration():
    # Replace node-only telemetry with admission timing and container cost in the same run directory.
    gateway = {"job_name": "gateway", "scrape_interval": "5s", "static_configs": [{"targets": ["gateway:9950"]}]}
    return {
        "receivers": {
            "otlp": {"protocols": {"grpc": {"endpoint": "0.0.0.0:4317"}}},
            "prometheus": {"config": {"scrape_configs": [gateway]}},
        },
        "exporters": {
            "file": {"path": "/data/metrics.jsonl", "rotation": {"max_megabytes": 100, "max_backups": 2}},
        },
        "service": {"pipelines": {
            "metrics": {"receivers": ["otlp", "prometheus"], "exporters": ["file"]},
        }},
    }


def prepare_runtime_files(directory, environment):
    (directory / "metrics").mkdir(mode=0o700, exist_ok=True)
    write_json(directory / "collector.json", collector_configuration())
    password = secrets.token_hex(24)
    write_private_environment(directory / "postgres.env", {
        "POSTGRES_USER": "herald", "POSTGRES_DB": "herald", "POSTGRES_PASSWORD": password,
    })
    write_private_environment(directory / "herald.env", {
        "PORT": "3003", "HERALD_RPC_URL": "http://madara:9944/rpc/v0_10_2",
        "HERALD_PUBLIC_RPC_URL": environment["HERALD_PUBLIC_RPC_URL"],
        "HERALD_PUBLIC_ADMISSION_URL": environment["HERALD_PUBLIC_ADMISSION_URL"],
        "NATIVE_WORLD_MANIFEST": "/config/native-world.json",
        "DATABASE_URL": f"postgres://herald:{password}@postgres:5432/herald",
    })


# The gateway starts once the world exists: it signs as the sequencing account for that world, and
# reserves the operator's administrative work beside the players' capacity.
def write_gateway_environment(config, directory, environment, authority, world):
    write_private_environment(directory / "gateway.env", {
        "RANDOMNESS_ACCOUNT": authority, "RANDOMNESS_DEPLOYMENT": world,
        "RANDOMNESS_PRIVATE_KEY": environment["RANDOMNESS_PRIVATE_KEY"],
        "RANDOMNESS_EPOCH_SECRET": "/data/game-epoch-secret.json", "RUST_LOG": "info",
        "GATEWAY_LISTEN": "0.0.0.0:9950", "GATEWAY_MAX_CONNECTIONS": admission_connections(config),
        "GATEWAY_PLAYER_CAPACITY": config["player_capacity"],
        "GATEWAY_AUTHORITY": json.loads((directory / "gameplay-contracts.json").read_text())["operatorAccountAddress"],
        "NODE_RPC_URL": "http://madara:9944/rpc/v0_10_2", "NODE_WS_URL": "ws://madara:9944/rpc/v0_10_2",
    })


def save_harness_environment(directory, environment):
    keys = (
        "DEPLOYER_ACCOUNT_ADDRESS", "DEPLOYER_PRIVATE_KEY", "RPC_URL", "ADMISSION_URL", "HERALD_URL",
        "RANDOMNESS_PRIVATE_KEY",
        "SHARD_HOST_ACCOUNTS",
        "NATIVE_AUTHORITY_FILE", "NATIVE_WORLD_MANIFEST", "GAMEPLAY_CONTRACTS_PATH",
        "MADARA_METRICS_FILE", "MADARA_IMAGE", "MADARA_CONTAINER",
        "COMPOSE_PROJECT_NAME", "CHAIN_CONFIG_PATH",
    )
    write_private_environment(directory / "harness.env", {key: environment[key] for key in keys})


def deployment_manifest(config, compose, directory, manifest, rpc_rtt, herald_rtt):
    return {
        **config, "project": compose["name"], "revision": read(["git", "rev-parse", "HEAD"]),
        "chainId": manifest["shard"]["chainId"], "metrics_image": compose["services"]["metrics"]["image"],
        "slice_limits": {name: Path(f"/sys/fs/cgroup/athanor.slice/{name}").read_text().strip()
                         for name in ("cpu.max", "cpuset.cpus.effective", "memory.max", "memory.high",
                                      "memory.swap.max")},
        "chain_config_sha256": hashlib.sha256((directory / "chain-config.yaml").read_bytes()).hexdigest(),
        "node_command": compose["services"]["madara"]["command"], "rpc_url": f"http://127.0.0.1:{config['port_base']}/rpc/v0_10_2",
        "herald_url": f"http://127.0.0.1:{config['port_base'] + 1}", "admission_url": admission_url(config),
        "rtt_ms": {"rpc": rpc_rtt, "herald": herald_rtt},
        "world": manifest["world"]["address"], "native_schema": manifest["native"]["activeSchema"],
    }


def read_guardian_identity(url):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "realms-shard-init"})
    with urlopen(request, timeout=15) as response:
        guardian = json.load(response)
    identity = {"guardianPublicKey": guardian["publicKey"], "accountClassHash": guardian["accountClassHash"]}
    for key in ("guardianPublicKey", "accountClassHash"):
        value = identity[key]
        if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{1,64}", value) or not (
            0 < int(value, 16) < 2**251 + 17 * 2**192 + 1
        ):
            raise ValueError(f"guardian response requires a nonzero felt {key}")
    return identity


def initialize_shard_identity(config, directory, deployer_address):
    identity = read_guardian_identity(config["guardian_url"])
    chain_id = "0x" + config["chain_id"].encode("ascii").hex()
    write_json(directory / "native-world.json", {"shard": {"chainId": chain_id, **identity}})
    template = Path(config["chain_config"]).read_text()
    # Identity belongs to the initialized shard, not to a benchmark template.
    template = re.sub(r"^(chain_id|sequencer_address):.*\n?", "", template, flags=re.MULTILINE)
    (directory / "chain-config.yaml").write_text(
        template + f'\nchain_id: "{config["chain_id"]}"\nsequencer_address: "{deployer_address}"\n'
    )


def start_shard(config, directory):
    config = {"node_memory_mib": DEFAULT_NODE_MEMORY_MIB, **config}
    allowed = cpu_numbers(Path("/sys/fs/cgroup/athanor.slice/cpuset.cpus.effective").read_text().strip())
    validate_configuration(config, allowed)
    ensure_fresh_project(config)
    if os.environ.get("LEDGER_ADDRESS") or os.environ.get("LEDGER_RPC_URL"):
        raise ValueError("shard preparation does not deploy or configure the deferred ledger")
    directory = directory.resolve()
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    compose = compose_configuration(config, directory)
    check_slice_memory(compose)
    # The run records the node image it ran: the package pin.
    config = {**config, "madara_image": compose["services"]["madara"]["image"]}
    write_json(directory / "configuration.json", config)
    write_json(directory / "compose.json", compose)
    command = [*DOCKER, "compose", "-f", str(directory / "compose.json")]
    run([*command, "up", "-d"], directory, "shard-start")
    environment = deployment_environment(config, directory)
    identity = json.loads((directory / "gameplay-contracts.json").read_text())
    environment["DEPLOYER_ACCOUNT_ADDRESS"] = identity["operatorAccountAddress"]
    manifest = json.loads((directory / "native-world.json").read_text())
    rpc_rtt = wait_for_endpoint(environment["RPC_URL"], rpc=True)
    herald_rtt = wait_for_endpoint(environment["HERALD_URL"] + "/health")
    wait_for_endpoint(f"http://127.0.0.1:{config['port_base'] + 5}/rpc/v0_10_2", rpc=True)
    run(["bun", "deploy/athanor/scripts/inspect-shard-roles.ts", "--public-rpc",
         f"http://127.0.0.1:{config['port_base'] + 5}/rpc/v0_10_2"], directory, "public-rpc-check")
    save_harness_environment(directory, environment)
    run(["bun", "deploy/athanor/scripts/account-rpc-smoke.ts", str(directory),
         f"http://127.0.0.1:{config['port_base'] + 5}/rpc/v0_10_2"], directory, "account-rpc-smoke")
    result = deployment_manifest(config, compose, directory, manifest, rpc_rtt, herald_rtt)
    write_json(directory / "manifest.json", result)
    return result


def workload_command(workload):
    required = ("games", "accounts_per_game", "minutes", "interval_seconds", "setup_concurrency", "workload")
    if set(workload) != set(required):
        raise ValueError(f"workload requires exactly {', '.join(required)}")
    return ["bun", "deploy/athanor/harness/run.ts", *[
        value for key in required for value in (f"--{key.replace('_', '-')}", str(workload[key]))
    ]]


def check_live_budget(budget, since, until, streaks):
    health = candidate_guard.check_health()
    digests = candidate_guard.read_digests(since, until)
    failures = candidate_guard.budget_failures(
        budget, health, digests, shutil.disk_usage("/opt/athanor").free, shutil.disk_usage("/").free, streaks,
    )
    if failures:
        raise RuntimeError("live budget exceeded: " + "; ".join(failures))
    return {**health, "digests": digests}


def run_guarded_workload(command, directory, environment, budget):
    since = time.time()
    streaks = {}
    with (directory / "harness.log").open("w") as output, (directory / "live-health.jsonl").open("w") as health:
        process = subprocess.Popen(command, cwd=ROOT, env=environment, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        try:
            while True:
                now = time.time()
                health.write(json.dumps({"at": now, **check_live_budget(budget, since, now, streaks)}) + "\n")
                health.flush()
                since = now
                try:
                    code = process.wait(timeout=5)
                    if code:
                        raise subprocess.CalledProcessError(code, command)
                    return
                except subprocess.TimeoutExpired:
                    pass
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


def capture_hosts(directory, environment, live, phase):
    script = ["bash", "deploy/athanor/scripts/host-state.sh"]
    for label, target in (("candidate", {}), ("live", {
        "MADARA_CONTAINER": live["container"], "CHAIN_CONFIG_PATH": live["chain_config"],
    })):
        run(script, directory, f"host-{label}-{phase}", {**environment, **target})


def run_matrix(matrix, directory):
    command = workload_command(matrix["workload"])
    budget = json.loads(candidate_guard.LIVE_BUDGET_PATH.read_text())
    # The existing guard protects deployment too, before the timed workload monitor starts.
    subprocess.run(["systemctl", "is-active", "--quiet", "athanor-live-guard.service"], check=True)
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    write_json(directory / "matrix.json", matrix)
    for config in matrix["configurations"]:
        target = directory / config["shard"]
        if target.exists():
            raise ValueError(f"duplicate run directory: {target}")
        now = time.time()
        check_live_budget(budget, now - 5, now, {})
        environment = None
        result = {"passed": False}
        try:
            start_shard(config, target)
            private = dict(line.split("=", 1) for line in (target / "harness.env").read_text().splitlines())
            environment = {**os.environ, **private, "HARNESS_OUTPUT_DIRECTORY": str(target / "workload")}
            capture_hosts(target, environment, matrix["live"], "start")
            run_guarded_workload(command, target, environment, budget)
            result["passed"] = True
        except Exception as error:
            result["error"] = str(error)
            raise
        finally:
            try:
                if environment:
                    capture_hosts(target, environment, matrix["live"], "end")
            except Exception as error:
                result.update(passed=False, error=str(error))
                raise
            finally:
                if (target / "compose.json").exists():
                    write_json(target / "matrix-result.json", result)
                    run([*DOCKER, "compose", "-f", str(target / "compose.json"), "stop"], target, "shard-stop")
    return {"passed": True, "directory": str(directory)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("configuration", type=Path)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--matrix", action="store_true", help="run an ordered configuration matrix and workload")
    args = parser.parse_args()
    action = run_matrix if args.matrix else start_shard
    print(json.dumps(action(json.loads(args.configuration.read_text()), args.directory.resolve())))
