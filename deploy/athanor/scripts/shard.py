#!/usr/bin/env python3
"""Start a fresh isolated shard through the existing native deployment commands."""

import argparse
import hashlib
import io
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import subprocess
import sys
import tarfile
import time
from urllib.request import Request, urlopen
from urllib.parse import urlparse

import measures


ROOT = Path(__file__).resolve().parents[3]
# The box lock ships with the shard package, beside backup.py, which takes it too.
sys.path.insert(0, str(ROOT / "deploy/shard"))
from stack_lock import isolated_stack_lock


# sudo resets the environment; the operator token passes through to initialization, and a measured driver's CPUs to
# the harness service, only when they are kept.
DOCKER = ["sudo", "-n", "--preserve-env=OPERATOR_TOKEN,HARNESS_CPUSET", "docker"]
RELEASES = "https://github.com/BibliothecaDAO/eternum/releases/download"
# Campaign G's target, not yet a measured ceiling: a larger shard waits for a G measurement that supports it.
MAX_PLAYER_CAPACITY = 2000
DEFAULT_NODE_MEMORY_MIB = 24576
SLICE = Path("/sys/fs/cgroup/athanor.slice")
# The services that hold memory for the shard's lifetime; prepare and init exit once the shard is deployed.
LONG_RUNNING = ("madara", "postgres", "herald", "rpc", "metrics")


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
    if any(key in config for key in ("gateway_image","gateway_revision","public_admission_url")):
        raise ValueError("retired gateway settings are not accepted")
    if type(config.get("vrf_workers")) is not int or not 1 <= config["vrf_workers"] <= 64:
        raise ValueError("vrf_workers must be explicit 1..64")
    if not re.fullmatch(r"0x[0-9a-fA-F]{1,16}", config.get("l2_gas_bound", "")) or int(config["l2_gas_bound"], 16) == 0:
        raise ValueError("l2_gas_bound must be nonzero hex u64")
    if "rpc_max_response_size_mib" in config:
        size = config["rpc_max_response_size_mib"]
        if type(size) is not int or not 1 <= size <= 2**32 - 1:
            raise ValueError("rpc_max_response_size_mib must be a positive u32 MiB count")
    validate_shard_identity(config)
    presets = config.get("presets")
    if not presets or not all(isinstance(preset, int) and preset > 0 for preset in presets):
        raise ValueError("presets must list the preset ids the shard registers")
    if "madara_image" in config:
        raise ValueError("the node image is the package's pin in deploy/shard/compose.yml")
    for key in ("herald_image", "init_image", "metrics_image"):
        if not re.fullmatch(r"(?:[^\s]+@)?sha256:[a-f0-9]{64}", config[key]):
            raise ValueError(f"{key} must be pinned by digest")
    port = config["port_base"]
    if not isinstance(port, int) or not 28000 <= port <= 65530:
        raise ValueError("reserve isolated ports base through base+3 and base+5 above 27999")
    if not cpu_numbers(config["cpuset"]) <= allowed_cpus:
        raise ValueError("cpuset exceeds the native slice allocation")
    # The upper bound is the slice's: check_slice_memory refuses a shard whose limits exceed what the slice holds.
    memory = config.get("node_memory_mib", DEFAULT_NODE_MEMORY_MIB)
    if not isinstance(memory, int) or memory < 1024:
        raise ValueError("node memory must be at least 1024 MiB")
    # Lifecycle flags belong to the package. Repeating its fixed snapshot setting is harmless;
    # the renderer keeps one instance and refuses a different snapshot policy.
    owned = ("--base-path", "--chain-config", "--rpc", "--name", "--db", "--devnet", "--l1", "--no-charge", "--otel")
    fixed_snapshot_flag = "--db-max-kept-snapshots=0"
    for flag in config["node_flags"]:
        if not isinstance(flag, str) or not flag.startswith("--") or (flag.startswith(owned)
                                                                     and flag != fixed_snapshot_flag):
            raise ValueError(f"node flag overrides shard ownership: {flag}")
    if any(flag.startswith("--parallel-merkle-enabled") and flag != "--parallel-merkle-enabled"
           for flag in config["node_flags"]):
        raise ValueError("parallel Merkle is the shipped node setting")
    if not any(flag.startswith("--enable-native-execution=") for flag in config["node_flags"]):
        raise ValueError("record the native execution setting explicitly")
    if not any(flag.startswith("--native-compilation-mode=") for flag in config["node_flags"]):
        raise ValueError("record the native compilation mode explicitly")


def validate_shard_identity(config):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,30}", config.get("chain_id", "")):
        raise ValueError("chain_id must be a unique 1-31 character ASCII shard name")
    for key in ("guardian_url", "public_rpc_url", "public_herald_url"):
        url = urlparse(config[key])
        if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password:
            raise ValueError(f"{key} must be an explicit HTTP endpoint without credentials")
    if not urlparse(config["guardian_url"]).path.endswith("/guardian"):
        raise ValueError("guardian_url must be an identity API's /guardian route")
    if not isinstance(config["player_capacity"], int) or not 1 <= config["player_capacity"] <= MAX_PLAYER_CAPACITY:
        raise ValueError(f"player_capacity must be 1 to {MAX_PLAYER_CAPACITY}, campaign G's target; raising it takes "
                         "a G measurement")
    if "trusted_proxy" in config:
        ipaddress.ip_address(config["trusted_proxy"])


def read(command):
    return subprocess.check_output(command, text=True, cwd=ROOT).strip()


def run(command, directory, name, environment=None):
    with (directory / f"{name}.log").open("w") as output:
        subprocess.run(command, cwd=ROOT, env=environment, stdout=output, stderr=subprocess.STDOUT, check=True)


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def read_private_environment(path):
    return dict(line.split("=", 1) for line in path.read_text().splitlines())


def write_private_environment(path, values):
    if any("\n" in str(value) for value in values.values()):
        raise ValueError("environment values must occupy one line")
    with open(path, "w", opener=lambda name, flags: os.open(name, flags, 0o600)) as stream:
        stream.write("".join(f"{key}={value}\n" for key, value in values.items()))


def identity_url(config):
    """The identity API whose guardian the shard names; the operator enrols its bots through it."""
    return config["guardian_url"].removesuffix("/guardian")


def compose_configuration(config, directory):
    environment = {
        **os.environ, "SHARD_NAME": f"athanor-{config['shard']}", "CHAIN_ID": config["chain_id"],
        "SHARD_DATA": str(directory), "SHARD_INIT_IMAGE": config["init_image"],
        "SHARD_METRICS_IMAGE": config["metrics_image"],
        "SHARD_HERALD_IMAGE": config["herald_image"],
        "GUARDIAN_URL": config["guardian_url"], "PUBLIC_RPC_URL": config["public_rpc_url"],
        "PUBLIC_HERALD_URL": config["public_herald_url"], "PLAYER_CAPACITY": str(config["player_capacity"]),
        "VRF_WORKERS":str(config["vrf_workers"]),"L2_GAS_BOUND":config["l2_gas_bound"],
        "TRUSTED_PROXY": config.get("trusted_proxy", ""),
        "HOST_UID": str(os.getuid()), "HOST_GID": str(os.getgid()), "BIND_ADDRESS": "127.0.0.1",
        "RPC_PORT": str(config["port_base"] + 5), "HERALD_PORT": str(config["port_base"] + 1),
        "NODE_MEMORY": f"{config.get('node_memory_mib', DEFAULT_NODE_MEMORY_MIB)}m",
        "PRESETS": ",".join(str(preset) for preset in config["presets"]),
    }
    if "rpc_max_response_size_mib" in config:
        environment["RPC_MAX_RESPONSE_SIZE_MIB"] = str(config["rpc_max_response_size_mib"])
    compose = json.loads(subprocess.check_output([
        "docker", "compose", "-f", str(ROOT / "deploy/shard/compose.yml"), "--profile", "harness", "config",
        "--format", "json",
    ], env=environment, text=True))
    budget = {
        "cgroup_parent": "athanor.slice", "cpuset": config["cpuset"], "pids_limit": 2048,
        "logging": {"driver": "json-file", "options": {"max-size": "20m", "max-file": "3"}},
    }
    # The harness is the driver, not the shard: it keeps the CPUs HARNESS_CPUSET gives it.
    for name, service in compose["services"].items():
        if name != "harness":
            service.update(budget)
    # Rendering resolved the operator secret from this shell into every service that passes it through (initialization
    # and the harness); compose.json keeps only its name, and starting a service passes it from the same shell again.
    for service in compose["services"].values():
        if "OPERATOR_TOKEN" in service.get("environment", {}):
            service["environment"]["OPERATOR_TOKEN"] = None
    for name in ("prepare", "init"):
        service = compose["services"][name]
        service.update({"mem_limit": "8g", "memswap_limit": "8g"})
        service["environment"]["CHAIN_CONFIG"] = "/template/chain-config.yaml"
        service["volumes"].append({"type": "bind", "source": str((ROOT / config["chain_config"]).resolve()),
                                   "target": "/template/chain-config.yaml", "read_only": True})
    node = compose["services"]["madara"]
    replaced = {flag.split("=", 1)[0] for flag in config["node_flags"]}
    node["command"] = [flag for flag in node["command"] if flag.split("=", 1)[0] not in replaced] + config["node_flags"]
    node["ports"] = [f"127.0.0.1:{config['port_base']}:9944"]
    compose["services"]["postgres"]["ports"] = [f"127.0.0.1:{config['port_base'] + 2}:5432"]
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
    bun("deploy/athanor/scripts/deploy-gameplay-contracts.ts", name="identity-deploy")
    identity = json.loads((directory / "gameplay-contracts.json").read_text())
    # Bootstrap's one enrolled operator owns all roles until an explicit service-role transaction changes them.
    command = ["--seed", seed, "--manifest", environment["NATIVE_WORLD_MANIFEST"],
               "--identity", environment["GAMEPLAY_CONTRACTS_PATH"],
               "--launcher",identity["operatorAccountAddress"],"--ledger-operator",identity["operatorAccountAddress"],
               "--world-address-file",str(directory/"world-address")]
    bun("config/deployer/clean/cli/deploy-world.ts", *command, name="world-deploy")
    bun("config/deployer/clean/cli/deploy-world.ts", *command, "--inspect", name="world-inspect")
    environment["DEPLOYER_ACCOUNT_ADDRESS"] = identity["operatorAccountAddress"]


def host_credentials(directory):
    path = directory / "host-keys.json"
    if path.stat().st_mode & 0o777 != 0o600 or path.stat().st_uid != os.getuid():
        raise ValueError("host-keys.json must be owner-only mode 0600")
    keys = json.loads(path.read_text())
    return {"DEPLOYER_ACCOUNT_ADDRESS": keys["deployerAddress"],
            "DEPLOYER_PRIVATE_KEY": keys["deployerPrivateKey"]}


def deployment_environment(config, directory):
    credentials = host_credentials(directory)
    base = config["port_base"]
    return {
        **os.environ, **credentials, "RPC_URL": f"http://127.0.0.1:{base}/rpc/v0_10_2",
        "IDENTITY_URL": identity_url(config),
        "HERALD_URL": f"http://127.0.0.1:{base + 1}",
        "HERALD_PUBLIC_RPC_URL": config["public_rpc_url"],
        "PUBLIC_HERALD_URL":config["public_herald_url"],
        "VRF_WORKERS":str(config["vrf_workers"]),
        "L2_GAS_BOUND":config["l2_gas_bound"],
        "VRF_KEY_FILE":str(directory/"vrf-key.json"),
        "COMPOSE_PROJECT_NAME": f"athanor-{config['shard']}",
        "SHARD_HOST_ACCOUNTS": str(directory / "host-accounts.json"),
        "NATIVE_WORLD_MANIFEST": str(directory / "native-world.json"),
        "GAMEPLAY_CONTRACTS_PATH": str(directory / "gameplay-contracts.json"),
        "OPERATOR_ENROLMENT_PATH": str(directory / "operator-enrolment.json"),
    }


def collector_configuration():
    return {"receivers":{"otlp":{"protocols":{"grpc":{"endpoint":"0.0.0.0:4317"}}}},
            "exporters":{"file":{"path":"/data/metrics.jsonl","rotation":{"max_megabytes":100,"max_backups":2}}},
            "service":{"pipelines":{"metrics":{"receivers":["otlp"],"exporters":["file"]}}}}


# Rendered on every start from the shard's settings; the database password is the one secret made here, once.
def prepare_runtime_files(directory, environment):
    (directory / "metrics").mkdir(mode=0o700, exist_ok=True)
    write_json(directory / "collector.json", collector_configuration())
    database = directory / "postgres.env"
    if not database.exists():
        write_private_environment(database, {
            "POSTGRES_USER": "herald", "POSTGRES_DB": "herald", "POSTGRES_PASSWORD": secrets.token_hex(24),
        })
    password = read_private_environment(database)["POSTGRES_PASSWORD"]
    write_private_environment(directory / "herald.env", {
        "PORT": "3003", "HERALD_RPC_URL": "http://madara:9944/rpc/v0_10_2",
        "HERALD_PUBLIC_RPC_URL": environment["HERALD_PUBLIC_RPC_URL"],
        "NATIVE_WORLD_MANIFEST": "/config/native-world.json",
        "DATABASE_URL": f"postgres://herald:{password}@postgres:5432/herald",
    })


def save_harness_environment(directory, environment):
    keys = (
        "DEPLOYER_ACCOUNT_ADDRESS", "RPC_URL", "HERALD_URL", "IDENTITY_URL",
        "SHARD_HOST_ACCOUNTS",
        "NATIVE_WORLD_MANIFEST", "GAMEPLAY_CONTRACTS_PATH", "COMPOSE_PROJECT_NAME",
    )
    write_private_environment(directory / "harness.env", {key: environment[key] for key in keys})


def deployment_manifest(config, compose, directory, manifest, rpc_rtt, herald_rtt):
    return {
        **config, "project": compose["name"], "revision": read(["git", "rev-parse", "HEAD"]),
        "chainId": manifest["shard"]["chainId"],
        "slice_limits": {name: Path(f"/sys/fs/cgroup/athanor.slice/{name}").read_text().strip()
                         for name in ("cpu.max", "cpuset.cpus.effective", "memory.max", "memory.high",
                                      "memory.swap.max")},
        "chain_config_sha256": hashlib.sha256((directory / "chain-config.yaml").read_bytes()).hexdigest(),
        "node_command": compose["services"]["madara"]["command"], "rpc_url": f"http://127.0.0.1:{config['port_base']}/rpc/v0_10_2",
        "herald_url": f"http://127.0.0.1:{config['port_base'] + 1}",
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
    host = json.loads((directory / "host-accounts.json").read_text())
    bound = config["l2_gas_bound"]
    if not re.fullmatch(r"0x[0-9a-fA-F]{1,16}", bound) or int(bound, 16) == 0:
        raise ValueError("l2_gas_bound must be nonzero hex u64")
    workers = config["vrf_workers"]
    if type(workers) is not int or not 1 <= workers <= 64:
        raise ValueError("vrf_workers must be explicit 1..64")
    write_json(directory / "native-world.json", {"shard": {
        "chainId": chain_id, **identity, "l2GasBound": bound, "vrfPublicKey": host["vrfPublicKey"],
    }})
    template = (ROOT / config["chain_config"]).read_text()
    # Identity belongs to the initialized shard, not to a benchmark template.
    template = re.sub(r"^(chain_id|sequencer_address):.*\n?", "", template, flags=re.MULTILINE)
    (directory / "chain-config.yaml").write_text(
        template + f'\nchain_id: "{config["chain_id"]}"\nsequencer_address: "{deployer_address}"\n'
    )


def release_images(tag):
    """The image digests a shard-v* release pins in its package."""
    with urlopen(f"{RELEASES}/{tag}/shard.tar.gz", timeout=60) as response:
        archive = tarfile.open(fileobj=io.BytesIO(response.read()), mode="r:gz")
    lines = archive.extractfile("shard/images.env").read().decode().splitlines()
    images = dict(line.split("=", 1) for line in lines if line)
    return {"init_image": images["SHARD_INIT_IMAGE"], "herald_image": images["SHARD_HERALD_IMAGE"],
            "metrics_image": images["SHARD_METRICS_IMAGE"]}


def resolve_images(config):
    """The published package supplies immutable images; explicit image digests may select a reviewed local build."""
    resolved = {**(release_images(config["package"]) if "package" in config else {}), **config}
    return resolved


def start_shard(config, directory):
    config = {"node_memory_mib": DEFAULT_NODE_MEMORY_MIB, **resolve_images(config)}
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
    run([*command, "run", "--rm", "--no-deps", "prepare"], directory, "shard-prepare")
    run([*command, "up", "-d"], directory, "shard-start")
    run([*command, "wait", "init"], directory, "shard-init-wait")
    code = subprocess.check_output([*command, "ps", "--all", "--format", "{{.ExitCode}}", "init"], text=True).strip()
    if code != "0":
        raise RuntimeError("initialization failed; read private deployment logs")
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


# Each workload key is a harness option (underscores for dashes, true for a bare flag), so a matrix can run every shape
# the harness runs: Blitz games, a launch slot, a Frontier burst, a chosen preset. The harness refuses the rest.
def workload_command(workload):
    if not workload:
        raise ValueError("workload must name the harness run")
    options = []
    for key, value in workload.items():
        flag = f"--{key.replace('_', '-')}"
        options += [flag] if value is True else [flag, str(value)]
    return ["bun", "deploy/athanor/harness/run.ts", *options]


def run_workload(command, directory, environment):
    """Runs the workload to its end; an interrupted run stops the workload's whole process group."""
    with (directory / "harness.log").open("w") as output:
        process = subprocess.Popen(command, cwd=ROOT, env=environment, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait()
            if code:
                raise subprocess.CalledProcessError(code, command)
            return True
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()


def run_matrix(matrix, directory):
    directory.mkdir(mode=0o700, parents=True, exist_ok=False)
    write_json(directory / "matrix.json", matrix)
    for entry in matrix["configurations"]:
        config = {**matrix.get("defaults", {}), **entry}
        command = workload_command({**matrix["workload"], **config.pop("workload", {})})
        target = directory / config["shard"]
        if target.exists():
            raise ValueError(f"duplicate run directory: {target}")
        result = {"passed": False}
        try:
            start_shard(config, target)
            private = read_private_environment(target / "harness.env")
            environment = {**os.environ, **private, "HARNESS_OUTPUT_DIRECTORY": str(target / "workload")}
            result.update(measures.measure_workload(
                DOCKER, lambda: run_workload(command, target, environment), f"athanor-{config['shard']}-madara-1",
                target / "metrics" / "metrics.jsonl", target / "chain-config.yaml", target / "workload"))
            result["passed"] = True
        except Exception as error:
            result["error"] = str(error)
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
    with isolated_stack_lock(f"runner {args.directory.name}"):
        print(json.dumps(action(json.loads(args.configuration.read_text()), args.directory.resolve())))
