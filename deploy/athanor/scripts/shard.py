#!/usr/bin/env python3
"""Start a fresh isolated shard through the existing native deployment commands."""

import argparse
import hashlib
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
POSTGRES_IMAGE = "postgres@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73"
METRICS_IMAGE = "otel/opentelemetry-collector-contrib@sha256:fd328de2552466ad78385e1b1289c3f2402b1c45f265b252aab1955b42845ac1"
DOCKER = ["sudo", "-n", "docker"]
# Admission connections: each player holds about two (a 100-connection node refused a 96-player slot at its
# 48th player), plus a fixed allowance for the sequencing authority, Herald and tooling.
CONNECTIONS_PER_PLAYER = 2
TOOLING_CONNECTIONS = 32


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
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,30}", config.get("chain_id", "")):
        raise ValueError("chain_id must be a unique 1-31 character ASCII shard name")
    for key in ("guardian_url", "public_rpc_url", "public_admission_url"):
        url = urlparse(config[key])
        if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password:
            raise ValueError(f"{key} must be an explicit HTTP endpoint without credentials")
    for key in ("madara_image", "herald_image", *(["gateway_image"] if "gateway_image" in config else [])):
        if not re.fullmatch(r"(?:[^\s]+@)?sha256:[a-f0-9]{64}", config[key]):
            raise ValueError(f"{key} must be pinned by digest")
    if not isinstance(config["player_capacity"], int) or not 1 <= config["player_capacity"] <= 1024:
        raise ValueError("player_capacity must be the shard's player count, 1 to 1024")
    port = config["port_base"]
    if not isinstance(port, int) or not 28000 <= port <= 65532:
        raise ValueError("reserve three isolated ports above 27999")
    if not cpu_numbers(config["cpuset"]) <= allowed_cpus:
        raise ValueError("cpuset exceeds the native slice allocation")
    if not isinstance(config["node_memory_mib"], int) or not 1024 <= config["node_memory_mib"] <= 28672:
        raise ValueError("node memory must fit the native slice budget")
    # These options belong to the shard lifecycle, never to a performance lever.
    owned = ("--base-path", "--chain-config", "--rpc", "--name", "--db", "--devnet", "--l1", "--no-charge", "--otel")
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


# Temporary until C3 decides between the fork's embedded admission and the gateway beside stock
# Madara: with `gateway_image`, admission runs in its own container on the fourth reserved port.
def admission_url(config):
    port = config["port_base"] + (3 if "gateway_image" in config else 0)
    return f"http://127.0.0.1:{port}" + ("" if "gateway_image" in config else "/rpc/v0_10_2")


def gateway_service(config, directory, budget):
    return {
        **budget, "image": config["gateway_image"], "mem_limit": "1g", "memswap_limit": "1g",
        "env_file": [str(directory / "gateway.env")], "ports": [f"127.0.0.1:{config['port_base'] + 3}:9950"],
        "volumes": ["gateway:/data"], "restart": "on-failure",
    }


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
        "--rpc-port=9944", f"--rpc-max-connections={admission_connections(config)}", "--no-charge-fee",
        "--l1-sync-disabled",
        "--otel-collector-endpoint=http://metrics:4317", "--otel-export-metrics=true", *config["node_flags"],
    ]
    return {
        "name": project,
        "services": {
            "metrics": {
                **budget, "image": METRICS_IMAGE, "mem_limit": "256m", "memswap_limit": "256m",
                "user": f"{os.getuid()}:{os.getgid()}", "command": ["--config=/config/collector.json"],
                "volumes": [f"{directory / 'collector.json'}:/config/collector.json:ro",
                            f"{directory / 'metrics'}:/data"],
            },
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
            # Herald exits when it loses the node and replays from its checkpoint on restart.
            "herald": {
                **budget, "image": config["herald_image"], "mem_limit": "6g", "memswap_limit": "6g",
                "restart": "on-failure",
                "env_file": [str(directory / "herald.env")], "ports": [f"127.0.0.1:{base + 1}:3003"],
                "volumes": [f"{directory / 'native-world.json'}:/config/native-world.json:ro"],
                "depends_on": {"postgres": {"condition": "service_healthy"}},
            },
            **({"gateway": gateway_service(config, directory, budget)} if "gateway_image" in config else {}),
        },
        "volumes": {"chain": {}, "postgres": {}, **({"gateway": {}} if "gateway_image" in config else {})},
    }


def ensure_fresh_project(config):
    project = f"athanor-{config['shard']}"
    label = f"label=com.docker.compose.project={project}"
    for command in (["ps", "-aq", "--filter", label], ["volume", "ls", "-q", "--filter", label]):
        if read([*DOCKER, *command]):
            raise ValueError(f"{project} already owns state; choose a fresh shard id")
    for port in range(config["port_base"], config["port_base"] + (4 if "gateway_image" in config else 3)):
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
    credentials = {key: os.environ[key] for key in ("DEPLOYER_ACCOUNT_ADDRESS", "DEPLOYER_PRIVATE_KEY")}
    base = config["port_base"]
    return {
        **os.environ, **credentials, "RPC_URL": f"http://127.0.0.1:{base}/rpc/v0_10_2",
        "ADMISSION_URL": admission_url(config),
        "HERALD_URL": f"http://127.0.0.1:{base + 1}",
        "HERALD_PUBLIC_RPC_URL": config["public_rpc_url"],
        "HERALD_PUBLIC_ADMISSION_URL": config["public_admission_url"],
        "COMPOSE_PROJECT_NAME": f"athanor-{config['shard']}",
        "CHAIN_CONFIG_PATH": str(directory / "chain-config.yaml"),
        "BINDING_AUTHORITY_ADDRESS": credentials["DEPLOYER_ACCOUNT_ADDRESS"],
        "RANDOMNESS_PRIVATE_KEY": "0x" + secrets.token_hex(31),
        "NATIVE_AUTHORITY_FILE": str(directory / "authority.json"),
        "NATIVE_WORLD_MANIFEST": str(directory / "native-world.json"),
        "GAMEPLAY_CONTRACTS_PATH": str(directory / "gameplay-contracts.json"),
        "MADARA_METRICS_FILE": str(directory / "metrics" / "metrics.jsonl"),
    }


def prepare_runtime_files(directory, environment):
    (directory / "metrics").mkdir(mode=0o700)
    write_json(directory / "collector.json", {
        "receivers": {"otlp": {"protocols": {"grpc": {"endpoint": "0.0.0.0:4317"}}}},
        "exporters": {"file": {"path": "/data/metrics.jsonl", "rotation": {"max_megabytes": 100, "max_backups": 2}}},
        "service": {"pipelines": {"metrics": {"receivers": ["otlp"], "exporters": ["file"]}}},
    })
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
        "PORT": "3003", "HERALD_RPC_URL": "http://madara:9944/rpc/v0_10_2",
        "HERALD_PUBLIC_RPC_URL": environment["HERALD_PUBLIC_RPC_URL"],
        "HERALD_PUBLIC_ADMISSION_URL": environment["HERALD_PUBLIC_ADMISSION_URL"],
        "NATIVE_WORLD_MANIFEST": "/config/native-world.json",
        "DATABASE_URL": f"postgres://herald:{password}@postgres:5432/herald",
    })
    return node_environment


def save_harness_environment(directory, environment):
    keys = (
        "DEPLOYER_ACCOUNT_ADDRESS", "DEPLOYER_PRIVATE_KEY", "RPC_URL", "ADMISSION_URL", "HERALD_URL",
        "BINDING_AUTHORITY_ADDRESS", "RANDOMNESS_PRIVATE_KEY",
        "NATIVE_AUTHORITY_FILE", "NATIVE_WORLD_MANIFEST", "GAMEPLAY_CONTRACTS_PATH",
        "MADARA_METRICS_FILE",
        "COMPOSE_PROJECT_NAME", "CHAIN_CONFIG_PATH",
    )
    write_private_environment(directory / "harness.env", {key: environment[key] for key in keys})


def deployment_manifest(config, compose, directory, manifest, rpc_rtt, herald_rtt):
    return {
        **config, "project": compose["name"], "revision": read(["git", "rev-parse", "HEAD"]),
        "chainId": manifest["shard"]["chainId"], "metrics_image": METRICS_IMAGE,
        "slice_limits": {name: Path(f"/sys/fs/cgroup/athanor.slice/{name}").read_text().strip()
                         for name in ("cpu.max", "memory.max", "memory.high", "memory.swap.max")},
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


def initialize_shard_identity(config, directory):
    identity = read_guardian_identity(config["guardian_url"])
    chain_id = "0x" + config["chain_id"].encode("ascii").hex()
    write_json(directory / "native-world.json", {"shard": {"chainId": chain_id, **identity}})
    template = Path(config["chain_config"]).read_text()
    # Identity belongs to the initialized shard, not to a benchmark template.
    template = re.sub(r"^chain_id:.*\n?", "", template, flags=re.MULTILINE)
    (directory / "chain-config.yaml").write_text(template + f'\nchain_id: "{config["chain_id"]}"\n')


def start_shard(config, directory):
    allowed = cpu_numbers(Path("/sys/fs/cgroup/athanor.slice/cpuset.cpus.effective").read_text().strip())
    validate_configuration(config, allowed)
    ensure_fresh_project(config)
    if os.environ.get("LEDGER_ADDRESS") or os.environ.get("LEDGER_RPC_URL"):
        raise ValueError("shard preparation does not deploy or configure the deferred ledger")
    directory = directory.resolve()
    environment = deployment_environment(config, directory)
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    initialize_shard_identity(config, directory)
    write_json(directory / "configuration.json", config)
    node_environment = prepare_runtime_files(directory, environment)
    compose = compose_configuration(config, directory)
    write_json(directory / "compose.json", compose)
    command = [*DOCKER, "compose", "-f", str(directory / "compose.json")]
    run([*command, "up", "-d", "metrics", "madara", "postgres"], directory, "bootstrap-start")
    wait_for_endpoint(environment["RPC_URL"], rpc=True)
    authority = deploy_world(config, directory, environment)
    manifest = json.loads((directory / "native-world.json").read_text())
    node_environment.update(RANDOMNESS_ACCOUNT=authority, RANDOMNESS_DEPLOYMENT=manifest["world"]["address"])
    write_private_environment(directory / "node.env", node_environment)
    services = ["madara", "herald"]
    if "gateway_image" in config:
        write_private_environment(directory / "gateway.env", {
            **{key: node_environment[key] for key in ("RANDOMNESS_ACCOUNT", "RANDOMNESS_DEPLOYMENT",
                                                      "RANDOMNESS_PRIVATE_KEY", "RUST_LOG")},
            "RANDOMNESS_EPOCH_SECRET": "/data/game-epoch-secret.json", "GATEWAY_LISTEN": "0.0.0.0:9950",
            "GATEWAY_MAX_CONNECTIONS": admission_connections(config),
            "NODE_RPC_URL": "http://madara:9944/rpc/v0_10_2", "NODE_WS_URL": "ws://madara:9944/rpc/v0_10_2",
        })
        services.append("gateway")
    run([*command, "up", "-d", "--force-recreate", *services], directory, "shard-start")
    rpc_rtt = wait_for_endpoint(environment["RPC_URL"], rpc=True)
    herald_rtt = wait_for_endpoint(environment["HERALD_URL"] + "/health")
    save_harness_environment(directory, environment)
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
