#!/usr/bin/env python3
"""Initialize the host-owned shard; the compose file owns every running service."""
import ipaddress
import json
import os
from pathlib import Path
import shutil
import socket
import struct
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "deploy/athanor/scripts"))
import shard

DATA = Path("/data")
# The release this image deploys, baked at build by deploy/release/facts.ts.
RELEASE_FACTS = Path("/release/release-facts.json")


def configuration():
    chain_id = os.environ["CHAIN_ID"]
    config = {
        "madara_image": os.environ["MADARA_IMAGE"], "madara_container": os.environ["MADARA_CONTAINER"],
        "shard": chain_id.lower().replace("_", "-"), "chain_id": chain_id, "port_base": 0,
        "guardian_url": os.environ["GUARDIAN_URL"], "public_rpc_url": os.environ["PUBLIC_RPC_URL"],
        "public_admission_url": os.environ["PUBLIC_ADMISSION_URL"], "player_capacity": int(os.environ["PLAYER_CAPACITY"]),
        "chain_config": os.environ.get("CHAIN_CONFIG", str(ROOT / "deploy/athanor/chain-config.yaml")),
    }
    shard.validate_shard_identity(config)
    return config


def requested_presets(environ, facts):
    """The presets this shard registers, from PRESETS; an id outside the release's catalogue is refused before
    anything deploys."""
    ids = [int(value) for value in environ.get("PRESETS", "").split(",") if value.strip()]
    if not ids:
        raise ValueError("PRESETS must name the preset ids this shard registers, e.g. PRESETS=2,5")
    unknown = [preset for preset in ids if str(preset) not in facts["presets"]]
    if unknown:
        raise ValueError(f"Presets {unknown} are not in this release's catalogue {sorted(facts['presets'], key=int)}")
    return ids


def default_gateway(route_table):
    """The IPv4 default route's gateway in /proc/net/route text: on the shard's Compose network, the host side
    that every connection to a published port arrives from."""
    for line in route_table.splitlines()[1:]:
        fields = line.split()
        if len(fields) > 2 and fields[1] == "00000000":
            return socket.inet_ntoa(struct.pack("<L", int(fields[2], 16)))
    raise ValueError("no default route to derive the trusted proxy from")


def trusted_proxy(environ, route_table):
    """An explicit TRUSTED_PROXY wins. Behind loopback bindings only the host's tunnel reaches the services, through
    the network gateway, so that is the proxy; exposed bindings trust no one."""
    if environ.get("TRUSTED_PROXY"):
        return str(ipaddress.ip_address(environ["TRUSTED_PROXY"]))
    if ipaddress.ip_address(environ.get("BIND_ADDRESS", "127.0.0.1")).is_loopback:
        return default_gateway(route_table)
    return None


# Written on every start rather than recorded with the shard's identity: recreating the network can move its
# gateway.
def publish_trusted_proxy():
    proxy = trusted_proxy(os.environ, Path("/proc/net/route").read_text())
    target = Path("/public/proxy.env")
    target.write_text(f"GATEWAY_TRUSTED_PROXY={proxy}\nRPC_TRUSTED_PROXY={proxy}\n" if proxy else "")
    target.chmod(0o644)


def environment(config):
    return {**shard.deployment_environment(config, DATA), "RPC_URL": "http://madara:9944/rpc/v0_10_2",
            "ADMISSION_URL": "http://gateway:9950", "HERALD_URL": "http://herald:3003"}


def prepare(config):
    publish_trusted_proxy()
    DATA.mkdir(exist_ok=True)
    DATA.chmod(0o700)
    record = DATA / "init-configuration.json"
    if record.exists():
        if json.loads(record.read_text()) != config:
            raise ValueError("Existing shard configuration differs; never reinitialize its identity")
        return
    if (DATA / "host-keys.json").exists():
        raise ValueError("Incomplete initialization: inspect the data directory before retrying")
    shard.run(["bun", "deploy/athanor/scripts/host-accounts.ts", "initialize", str(DATA)], DATA, "host-accounts-initialize")
    env = environment(config)
    shard.initialize_shard_identity(config, DATA, env["DEPLOYER_ACCOUNT_ADDRESS"])
    shard.prepare_runtime_files(DATA, env)
    values = dict(line.split("=", 1) for line in (DATA / "postgres.env").read_text().splitlines())
    password = Path("/postgres-config/postgres-password")
    password.write_text(values["POSTGRES_PASSWORD"])
    password.chmod(0o644)
    publish("chain-config.yaml", "/public")
    publish("collector.json", "/public")
    publish("herald.env", "/herald-config")
    shard.write_json(record, config)


def publish(name, destination):
    target = Path(destination) / name
    shutil.copyfile(DATA / name, target)
    target.chmod(0o644)


def deploy(config, presets):
    env = environment(config)
    shard.wait_for_endpoint(env["RPC_URL"], rpc=True)
    complete = DATA / "initialized.json"
    if complete.exists():
        shard.run(["bun", "deploy/athanor/scripts/inspect-shard-roles.ts", str(DATA), env["RPC_URL"]], DATA, "shard-roles", env)
        publish("gameplay-contracts.json", "/public")
        record = json.loads(complete.read_text())
    else:
        record = deploy_world_once(config, env)
    record["presets"] = register_presets(env, presets)
    shard.write_json(complete, record)
    print(complete.read_text())


def deploy_world_once(config, env):
    shard.run(["bun", "deploy/athanor/scripts/host-accounts.ts", "deploy", str(DATA)], DATA, "host-account-deploy", env)
    authority = shard.deploy_world(config, DATA, env)
    shard.run(["bun", "deploy/athanor/scripts/inspect-shard-roles.ts", str(DATA), env["RPC_URL"]], DATA, "shard-roles", env)
    manifest = json.loads((DATA / "native-world.json").read_text())
    shard.write_gateway_environment(config, DATA, env, authority, manifest["world"]["address"])
    publish("gateway.env", "/gateway-config")
    publish("native-world.json", "/public")
    publish("gameplay-contracts.json", "/public")
    shard.save_harness_environment(DATA, env)
    return {"chainId": manifest["shard"]["chainId"], "world": manifest["world"]["address"]}


# Registration is idempotent, so every start registers the listed presets: one added later registers without
# touching the shard's identity. The record holds the commitment each preset has on chain.
def register_presets(env, presets):
    env = {**env, "DEPLOYER_ACCOUNT_ADDRESS": json.loads((DATA / "gameplay-contracts.json").read_text())["operatorAccountAddress"]}
    commitments = {}
    for preset in presets:
        record = DATA / f"preset-{preset}.json"
        shard.run(["bun", "config/deployer/clean/registrar/register-preset.ts", "--preset-id", str(preset),
                   "--record", str(record)], DATA, f"preset-{preset}", env)
        commitments[str(preset)] = json.loads(record.read_text())["commitment"]
    return commitments


if __name__ == "__main__":
    os.umask(0o077)
    action = sys.argv[1]
    config = configuration()
    presets = requested_presets(os.environ, json.loads(RELEASE_FACTS.read_text()))
    try:
        if action == "prepare":
            prepare(config)
        elif action == "deploy":
            deploy(config, presets)
        else:
            raise ValueError("Expected prepare or deploy")
    finally:
        uid, gid = int(os.environ["HOST_UID"]), int(os.environ["HOST_GID"])
        for path in [DATA, *DATA.rglob("*")]:
            os.chown(path, uid, gid)
