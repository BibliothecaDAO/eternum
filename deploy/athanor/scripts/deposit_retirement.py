"""Verify deposited principal before the supported removal paths can destroy a source shard."""
import json
import subprocess
from urllib.parse import urlsplit

from service_requests import identity_service_base, service_json


def require_deposit_retirement(config, directory, *, runner=False):
    data = directory if runner else directory / "data"
    manifest_path = data / "native-world.json"
    if not manifest_path.exists():
        if runner and not (directory / "manifest.json").exists() and not (data / "initialized.json").exists():
            return
        raise ValueError("Shard manifest missing; deposit retirement cannot be verified")
    manifest = json.loads(manifest_path.read_text())
    games = manifest.get("world", {}).get("address")
    if not games:
        if (data / "initialized.json").exists():
            raise ValueError("Initialized shard has no Games identity")
        return
    chain = "0x" + config["chain_id"].encode("ascii").hex()
    if int(manifest["shard"]["chainId"], 16) != int(chain, 16):
        raise ValueError("Deposit retirement manifest names another chain")
    record = directory / "deposit-retirement.json"
    if record.exists() and not chain_volume_exists(config, runner):
        require_matching_result(json.loads(record.read_text()), chain, games)
        return
    source = urlsplit(identity_service_base(config["guardian_url"]))
    endpoint = f"{source.scheme}://{source.netloc}/api/value/operator/deposit-retirement"
    result = service_json(endpoint, {"chainId": chain}, timeout=120)
    require_matching_result(result, chain, games)
    temporary = record.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, indent=2) + "\n")
    temporary.chmod(0o600)
    temporary.replace(record)


def require_matching_result(result, chain, games):
    if (result.get("retirementReady") is not True or int(result.get("chainId", "0"), 16) != int(chain, 16)
            or int(result.get("gamesAddress", "0"), 16) != int(games, 16)):
        raise ValueError("Deposit retirement did not verify this source shard")


def chain_volume_exists(config, runner):
    project = f"athanor-{config['shard']}" if runner else config["shard_name"]
    volume = f"{project}_chain"
    result = subprocess.run(["sudo", "-n", "docker", "volume", "ls", "--quiet", "--filter", f"name={volume}"],
                            capture_output=True, text=True, check=True)
    return volume in result.stdout.split()
