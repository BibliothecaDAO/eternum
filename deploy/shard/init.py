#!/usr/bin/env python3
"""Initialize the host-owned shard; the compose file owns every running service."""
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "deploy/athanor/scripts"))
import shard

DATA = Path("/data")


def configuration():
    chain_id = os.environ["CHAIN_ID"]
    config = {
        **({"trusted_proxy": os.environ["TRUSTED_PROXY"]} if os.environ.get("TRUSTED_PROXY") else {}),
        "madara_image": os.environ["MADARA_IMAGE"], "madara_container": os.environ["MADARA_CONTAINER"],
        "shard": chain_id.lower().replace("_", "-"), "chain_id": chain_id, "port_base": 0,
        "guardian_url": os.environ["GUARDIAN_URL"], "public_rpc_url": os.environ["PUBLIC_RPC_URL"],
        "public_admission_url": os.environ["PUBLIC_ADMISSION_URL"], "player_capacity": int(os.environ["PLAYER_CAPACITY"]),
        "chain_config": os.environ.get("CHAIN_CONFIG", str(ROOT / "deploy/athanor/chain-config.yaml")),
    }
    shard.validate_shard_identity(config)
    return config


def environment(config):
    return {**shard.deployment_environment(config, DATA), "RPC_URL": "http://madara:9944/rpc/v0_10_2",
            "ADMISSION_URL": "http://gateway:9950", "HERALD_URL": "http://herald:3003"}


def prepare(config):
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


def deploy(config):
    env = environment(config)
    shard.wait_for_endpoint(env["RPC_URL"], rpc=True)
    complete = DATA / "initialized.json"
    if complete.exists():
        shard.run(["bun", "deploy/athanor/scripts/inspect-shard-roles.ts", str(DATA), env["RPC_URL"]], DATA, "shard-roles", env)
        publish("gameplay-contracts.json", "/public")
        return
    shard.run(["bun", "deploy/athanor/scripts/host-accounts.ts", "deploy", str(DATA)], DATA, "host-account-deploy", env)
    authority = shard.deploy_world(config, DATA, env)
    for preset, mode in [(3, "eternum"), (4, "blitz")]:
        shard.run(["bun", "config/deployer/clean/registrar/register-preset.ts", "--environment", f"madara.{mode}",
                   "--preset-id", str(preset)], DATA, f"preset-{preset}", env)
    shard.run(["bun", "deploy/athanor/scripts/inspect-shard-roles.ts", str(DATA), env["RPC_URL"]], DATA, "shard-roles", env)
    manifest = json.loads((DATA / "native-world.json").read_text())
    shard.write_gateway_environment(config, DATA, env, authority, manifest["world"]["address"])
    publish("gateway.env", "/gateway-config")
    publish("native-world.json", "/public")
    publish("gameplay-contracts.json", "/public")
    shard.save_harness_environment(DATA, env)
    shard.write_json(complete, {"chainId": manifest["shard"]["chainId"], "world": manifest["world"]["address"], "presets": [1, 2, 3, 4]})
    print(complete.read_text())


if __name__ == "__main__":
    os.umask(0o077)
    action = sys.argv[1]
    config = configuration()
    try:
        if action == "prepare":
            prepare(config)
        elif action == "deploy":
            deploy(config)
        else:
            raise ValueError("Expected prepare or deploy")
    finally:
        uid, gid = int(os.environ.get("HOST_UID", "0")), int(os.environ.get("HOST_GID", "0"))
        for path in [DATA, *DATA.rglob("*")]:
            os.chown(path, uid, gid)
