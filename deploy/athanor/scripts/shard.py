"""Shard helpers shared by the deploy, teardown and season commands and the shard package's init."""

import fcntl
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[3]
# The box lock ships with the shard package, beside backup.py, which takes it too.
sys.path.insert(0, str(ROOT / "deploy/shard"))
from stack_lock import isolated_stack_lock
from operator_token import read_protected_text
from service_requests import identity_service_base, service_json


# Containers read the fixed protected file mount; no environment crosses sudo.
DOCKER = ["sudo", "-n", "docker"]
# Campaign G's target, not yet a measured ceiling: a larger shard waits for a G measurement that supports it.
MAX_PLAYER_CAPACITY = 2000
PRIVATE_NODE_RPC_URL = "http://madara:9944/rpc/v0_10_2"


def validate_runtime_configuration(config):
    block_time = config.get("block_time", "2s")
    if not isinstance(block_time, str) or not re.fullmatch(r"[1-9][0-9]*s", block_time):
        raise ValueError("block_time must be a positive whole number of seconds")
    bound = config.get("l2_gas_bound")
    if not isinstance(bound, str) or not re.fullmatch(r"0x[0-9a-fA-F]{1,16}", bound) or int(bound, 16) == 0:
        raise ValueError("l2_gas_bound must be nonzero hex u64")


def run_identity(directory):
    """The shard a run directory holds: its name and its chain."""
    values = dict(line.split("=", 1) for line in (directory / ".env").read_text().splitlines() if "=" in line)
    return {"project": values["SHARD_NAME"], "chain_id": values["CHAIN_ID"]}


def validate_shard_identity(config):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,30}", config.get("chain_id", "")):
        raise ValueError("chain_id must be a unique 1-31 character ASCII shard name")
    for key in ("guardian_url", "public_rpc_url", "public_herald_url"):
        url = urlparse(config[key])
        if url.scheme not in ("http", "https") or not url.netloc or url.username or url.password:
            raise ValueError(f"{key} must be an explicit HTTP endpoint without credentials")
    identity_service_base(config["guardian_url"])
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
    return identity_service_base(config["guardian_url"])


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
    run(["bun", "deploy/athanor/scripts/deploy-gameplay-contracts.ts"], directory, "identity-deploy", environment)
    register_world_release(config, directory, environment)
    identity = json.loads((directory / "gameplay-contracts.json").read_text())
    environment["DEPLOYER_ACCOUNT_ADDRESS"] = identity["operatorAccountAddress"]


def register_world_release(config, directory, environment, logs="world"):
    """Deploys Games on a new shard, or registers this image's release on a running one, then proves the world matches
    the release. The deployer refuses anything but the next release with the same schema and Games class."""
    identity = json.loads((directory / "gameplay-contracts.json").read_text())
    command = ["bun", "config/deployer/clean/cli/deploy-world.ts", "--seed", f"athanor-{config['shard']}",
               "--manifest", environment["NATIVE_WORLD_MANIFEST"], "--identity", environment["GAMEPLAY_CONTRACTS_PATH"],
               "--launcher", identity["launcherAccountAddress"],
               "--ledger-operator", identity["ledgerOperatorAccountAddress"],
               "--world-address-file", str(directory / "world-address")]
    run(command, directory, f"{logs}-deploy", environment)
    run([*command, "--inspect"], directory, f"{logs}-inspect", environment)


def host_credentials(directory):
    keys = json.loads(read_protected_text(directory / "host-keys.json"))
    return {"DEPLOYER_ACCOUNT_ADDRESS": keys["deployerAddress"],
            "DEPLOYER_PRIVATE_KEY": keys["deployerPrivateKey"]}


def deployment_environment(config, directory):
    credentials = host_credentials(directory)
    return {
        **os.environ, **credentials, "RPC_URL": PRIVATE_NODE_RPC_URL,
        "IDENTITY_URL": identity_url(config),
        "HERALD_URL": "http://herald:3003",
        "HERALD_PUBLIC_RPC_URL": config["public_rpc_url"],
        "PUBLIC_HERALD_URL": config["public_herald_url"],
        "L2_GAS_BOUND": config["l2_gas_bound"],
        "VRF_KEY_FILE": str(directory / "vrf-key.json"),
        "COMPOSE_PROJECT_NAME": f"athanor-{config['shard']}",
        "SHARD_HOST_ACCOUNTS": str(directory / "host-accounts.json"),
        "NATIVE_WORLD_MANIFEST": str(directory / "native-world.json"),
        "GAMEPLAY_CONTRACTS_PATH": str(directory / "gameplay-contracts.json"),
    }


def collector_configuration():
    return {"receivers": {"otlp": {"protocols": {"grpc": {"endpoint": "0.0.0.0:4317"}}}},
            "exporters": {"file": {"path": "/data/metrics.jsonl", "rotation": {"max_megabytes": 100, "max_backups": 2}}},
            "service": {"pipelines": {"metrics": {"receivers": ["otlp"], "exporters": ["file"]}}}}


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


def read_guardian_identity(url):
    identity_service_base(url)
    guardian = service_json(url, timeout=15)
    identity = {"guardianPublicKey": guardian["publicKey"], "accountClassHash": guardian["accountClassHash"]}
    for key in ("guardianPublicKey", "accountClassHash"):
        value = identity[key]
        if not isinstance(value, str) or not re.fullmatch(r"0x[0-9a-fA-F]{1,64}", value) or not (
            0 < int(value, 16) < 2**251 + 17 * 2**192 + 1
        ):
            raise ValueError(f"guardian response requires a nonzero felt {key}")
    return identity


def initialize_shard_identity(config, directory, deployer_address):
    validate_runtime_configuration(config)
    identity = read_guardian_identity(config["guardian_url"])
    chain_id = "0x" + config["chain_id"].encode("ascii").hex()
    host = json.loads((directory / "host-accounts.json").read_text())
    bound = config["l2_gas_bound"]
    write_json(directory / "native-world.json", {"shard": {
        "chainId": chain_id, **identity, "l2GasBound": bound, "vrfPublicKey": host["vrfPublicKey"],
    }})
    template = (ROOT / config["chain_config"]).read_text()
    # The initialized shard owns identity and cadence; the template is shared by environments.
    template = re.sub(r"^(chain_id|sequencer_address|block_time):.*\n?", "", template, flags=re.MULTILINE)
    (directory / "chain-config.yaml").write_text(
        template + f'\nblock_time: "{config.get("block_time", "2s")}"\n'
        + f'chain_id: "{config["chain_id"]}"\nsequencer_address: "{deployer_address}"\n'
    )


def build_images():
    """Build only committed files; serialize Cairo with the box's compiler lock. Docker RUNs pin cores 8-11."""
    revision = read(["git", "rev-parse", "HEAD"])
    lock = Path.home() / "cairo-suite/.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    with lock.open("a") as held, tempfile.TemporaryDirectory(prefix="shard-build-") as temporary:
        fcntl.flock(held, fcntl.LOCK_EX)
        images = {}
        for name in ("init", "herald", "metrics"):
            archive = Path(temporary) / "source.tar"
            source = "HEAD:deploy/athanor/metrics" if name == "metrics" else "HEAD"
            with archive.open("wb") as output:
                subprocess.run(["git", "archive", source], cwd=ROOT, stdout=output, check=True)
            image_id = Path(temporary) / f"{name}.image"
            dockerfile = "Dockerfile" if name == "metrics" else "deploy/shard/Dockerfile"
            target = [] if name == "metrics" else ["--target", name]
            with archive.open("rb") as context:
                subprocess.run([*DOCKER, "buildx", "build", "--load", "--platform", "linux/amd64",
                                "--file", dockerfile, *target, "--build-arg", f"SHARD_REVISION={revision}",
                                "--label", f"org.opencontainers.image.revision={revision}",
                                "--iidfile", str(image_id), "-"], stdin=context, cwd=ROOT, check=True, stdout=sys.stdout, stderr=sys.stderr)
            images[name] = image_id.read_text().strip()
        facts = json.loads(subprocess.check_output([
            *DOCKER, "run", "--rm", "--network", "none", "--entrypoint", "cat", images["init"],
            "/release/release-facts.json",
        ], text=True))
    node = next(line.split()[-1] for line in (ROOT / "deploy/shard/compose.yml").read_text().splitlines()
                if line.startswith("x-madara-image:"))
    return {**facts, "commit": revision, "images": images, "node": node}


