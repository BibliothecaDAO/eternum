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
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "deploy/athanor/scripts"))
import shard

DATA = Path("/data")
# Each service's config volume. It holds only copies of files in DATA, republished on every start, so a backup of
# DATA restores onto fresh volumes on a new host.
PUBLIC, HERALD_CONFIG = Path("/public"), Path("/herald-config")
GATEWAY_CONFIG, POSTGRES_CONFIG = Path("/gateway-config"), Path("/postgres-config")
# The settings that fix the shard's identity. The rest (node image, capacity, public URLs) are operational and are
# rendered again on every start.
IDENTITY = ("shard", "chain_id", "guardian_url")
# The release this image deploys, baked at build by deploy/release/facts.ts.
RELEASE_FACTS = Path("/release/release-facts.json")


def configuration():
    chain_id = os.environ["CHAIN_ID"]
    config = {
        "shard": chain_id.lower().replace("_", "-"), "chain_id": chain_id, "port_base": 0,
        "guardian_url": os.environ["GUARDIAN_URL"], "public_rpc_url": os.environ["PUBLIC_RPC_URL"],
        "public_admission_url": os.environ["PUBLIC_ADMISSION_URL"], "player_capacity": int(os.environ["PLAYER_CAPACITY"]),
        "chain_config": os.environ.get("CHAIN_CONFIG", str(ROOT / "deploy/athanor/chain-config.yaml")),
    }
    shard.validate_shard_identity(config)
    return config


def requested_presets(environ, facts):
    """The presets this shard registers, from PRESETS, with the commitment the release gives each; an id outside the
    release's catalogue is refused before anything deploys."""
    ids = [int(value) for value in environ.get("PRESETS", "").split(",") if value.strip()]
    if not ids:
        raise ValueError("PRESETS must name the preset ids this shard registers, e.g. PRESETS=2,5")
    unknown = [preset for preset in ids if str(preset) not in facts["presets"]]
    if unknown:
        raise ValueError(f"Presets {unknown} are not in this release's catalogue {sorted(facts['presets'], key=int)}")
    return {preset: facts["presets"][str(preset)] for preset in ids}


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
    target = PUBLIC / "proxy.env"
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
        refuse_changed_identity(json.loads(record.read_text()), config)
    else:
        initialize_identity(config)
    publish_prepared_config(config)
    shard.write_json(record, identity(config))


def identity(config):
    return {key: config[key] for key in IDENTITY}


def refuse_changed_identity(recorded, config):
    if identity(recorded) != identity(config):
        raise ValueError("Existing shard configuration differs; never reinitialize its identity")


def initialize_identity(config):
    if (DATA / "host-keys.json").exists():
        raise ValueError("Incomplete initialization: inspect the data directory before retrying")
    shard.run(["bun", "deploy/athanor/scripts/host-accounts.ts", "initialize", str(DATA)], DATA, "host-accounts-initialize")
    shard.initialize_shard_identity(config, DATA, environment(config)["DEPLOYER_ACCOUNT_ADDRESS"])


def publish_prepared_config(config):
    shard.prepare_runtime_files(DATA, environment(config))
    password = POSTGRES_CONFIG / "postgres-password"
    password.write_text(shard.read_private_environment(DATA / "postgres.env")["POSTGRES_PASSWORD"])
    password.chmod(0o644)
    publish("chain-config.yaml", PUBLIC)
    publish("collector.json", PUBLIC)
    publish("herald.env", HERALD_CONFIG)


def publish_deployed_config(config):
    shard.write_gateway_environment(config, DATA)
    publish("gateway.env", GATEWAY_CONFIG)
    publish("native-world.json", PUBLIC)
    publish("gameplay-contracts.json", PUBLIC)


def publish(name, destination):
    target = destination / name
    shutil.copyfile(DATA / name, target)
    target.chmod(0o644)


def deploy(config, presets):
    env = environment(config)
    shard.wait_for_endpoint(env["RPC_URL"], rpc=True)
    complete = DATA / "initialized.json"
    if complete.exists():
        shard.run(["bun", "deploy/athanor/scripts/inspect-shard-roles.ts", str(DATA), env["RPC_URL"]], DATA, "shard-roles", env)
        record = json.loads(complete.read_text())
    else:
        record = deploy_world_once(config, env)
    publish_deployed_config(config)
    record["presets"] = register_presets(env, presets)
    shard.write_json(complete, record)
    print(complete.read_text())


def deploy_world_once(config, env):
    shard.run(["bun", "deploy/athanor/scripts/host-accounts.ts", "deploy", str(DATA)], DATA, "host-account-deploy", env)
    shard.deploy_world(config, DATA, env)
    shard.run(["bun", "deploy/athanor/scripts/inspect-shard-roles.ts", str(DATA), env["RPC_URL"]], DATA, "shard-roles", env)
    shard.save_harness_environment(DATA, env)
    manifest = json.loads((DATA / "native-world.json").read_text())
    return {"chainId": manifest["shard"]["chainId"], "world": manifest["world"]["address"]}


# Registration is idempotent, so every start registers the listed presets: one added later registers without
# touching the shard's identity. The record holds the commitment each preset has on chain, which must be the release's.
def register_presets(env, presets):
    env = {**env, "DEPLOYER_ACCOUNT_ADDRESS": json.loads((DATA / "gameplay-contracts.json").read_text())["operatorAccountAddress"]}
    commitments = {}
    for preset, released in presets.items():
        record = DATA / f"preset-{preset}.json"
        shard.run(["bun", "config/deployer/clean/registrar/register-preset.ts", "--preset-id", str(preset),
                   "--record", str(record)], DATA, f"preset-{preset}", env)
        commitments[str(preset)] = chain_commitment(preset, json.loads(record.read_text())["commitment"], released)
    return commitments


def chain_commitment(preset, on_chain, released):
    if int(on_chain, 16) != int(released, 16):
        raise ValueError(f"Preset {preset} commits to {on_chain} on chain; this release's facts say {released}")
    return on_chain


def harness_invocation(args, environ, data=DATA, started=None):
    """The harness command against this shard: its private settings from harness.env, its reports under
    data/harness/<start time> unless the caller names a directory."""
    environment = {**environ, **shard.read_private_environment(data / "harness.env")}
    stamp = time.strftime("%Y%m%dT%H%M%SZ", started or time.gmtime())
    environment.setdefault("HARNESS_OUTPUT_DIRECTORY", str(data / "harness" / stamp))
    return ["bun", "deploy/athanor/harness/run.ts", *args], environment


if __name__ == "__main__":
    os.umask(0o077)
    action = sys.argv[1]
    if action == "harness":
        # The harness runs as the host user, so what it writes is already the user's: it execs before any chown.
        argv, environment = harness_invocation(sys.argv[2:], os.environ)
        os.execvpe(argv[0], argv, environment)
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
