#!/usr/bin/env python3
"""Build and deploy this checkout, then prove the shard's classes, schema and presets before activation.

    python3 deploy/athanor/scripts/operator-command.py deploy ENVIRONMENT DIRECTORY

The committed deploy/release/ENVIRONMENT.json holds the shard identity and sizing. DIRECTORY retains its data.
"""
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import shutil
from urllib.parse import urlsplit

import shard
from revision import deployment_revision
from directory import directory_status, wait_for_identity
from service_requests import identity_service_base, service_json

ENVIRONMENTS = shard.ROOT / "deploy/release"
INPUTS = ("shard_name", "chain_id", "public_rpc_url", "public_herald_url",
          "player_capacity", "presets", "node_memory", "herald_memory", "vrf_workers", "l2_gas_bound")


def ignore_stage(_stage):
    pass


def main(environment, directory, report_stage=ignore_stage):
    report_stage("prepare")
    target = deployment_target(environment, directory)
    inputs = load_inputs(environment)
    deployment_revision(target["environment"])
    with shard.isolated_stack_lock(f"deploy {environment}"):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        report_stage("build images")
        release = shard.build_images()
        restart_unfinished(directory, inputs, release, report_stage)
        write_build(directory, release)
        report_stage("prepare")
        (directory / ".env").write_text(render_environment(inputs, (directory / "images.env").read_text()))
        check_operator_approval()
        status = start(directory, inputs, report_stage)
        report_stage("verify facts")
        differences = release_differences(release, *deployed_facts(directory / "data"), inputs["presets"])
        if not differences and status["status"] == "pending":
            activate(inputs, directory / "data", report_stage)
    if differences:
        print(f"{environment} does not run commit {release['commit']}:", *differences, sep="\n  ", file=sys.stderr)
        return 1
    print(f"{environment} runs commit {release['commit']}")
    return 0


def load_inputs(environment):
    path = ENVIRONMENTS / f"{environment}.json"
    if not committed(path):
        raise ValueError(f"{path.relative_to(shard.ROOT)} is not committed: an environment's inputs are reviewed in the "
                         "repository before they deploy")
    inputs = json.loads(path.read_text())
    missing = [key for key in INPUTS if key not in inputs]
    if missing:
        raise ValueError(f"{environment}.json lacks {', '.join(missing)}")
    targets = json.loads((shard.ROOT / "deploy/first/environments.json").read_text())
    target = next((value for value in targets.values() if value["release"] == environment), None)
    if target is None:
        raise ValueError("Unknown deployment environment")
    inputs["guardian_url"] = target["origin"] + "/api/guardian"
    identity_service_base(inputs["guardian_url"])
    return inputs


def committed(path):
    """Tracked by git and unchanged from HEAD."""
    def succeeds(*command):
        return subprocess.run(["git", *command], cwd=shard.ROOT, capture_output=True).returncode == 0
    return succeeds("ls-files", "--error-unmatch", str(path)) and succeeds("diff", "--quiet", "HEAD", "--", str(path))


class DeploymentRefused(RuntimeError):
    pass


def deployment_target(environment, directory):
    targets = json.loads((shard.ROOT / "deploy/first/environments.json").read_text())
    target = next(value for value in targets.values() if value["release"] == environment)
    if directory.resolve() != Path(target["runDirectory"]).resolve():
        raise DeploymentRefused(f"Run directory must be {target['runDirectory']}; data was not overwritten")
    return target


def directory_row_is_valid(row):
    if not isinstance(row, dict):
        return False
    if row.get("status") not in ("pending", "active", "draining", "retired"):
        return False
    if not isinstance(row.get("url"), str):
        return False
    try:
        url = urlsplit(row["url"])
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            return False
    except ValueError:
        return False
    return isinstance(row.get("chainId"), str) and re.fullmatch(r"0x[0-9a-fA-F]+", row["chainId"])


def row_matches_identity(row, chain, url):
    return same(row["chainId"], chain) or row["url"] == url


def is_own_pending_row(row, chain, url):
    return row["status"] == "pending" and same(row["chainId"], chain) and row["url"] == url


def is_listed_row(row):
    return row is not None and row["status"] != "pending"


def recorded_chain(directory):
    try:
        manifest = json.loads((directory / "data/native-world.json").read_text())
        chain = manifest["shard"]["chainId"]
        if not isinstance(chain, str) or not re.fullmatch(r"0x[0-9a-fA-F]+", chain):
            raise ValueError()
        return chain
    except (OSError, ValueError, KeyError, TypeError):
        raise DeploymentRefused("Run directory has no readable chain identity; data was not overwritten") from None


def restart_unfinished(directory, inputs, release, report_stage):
    chain = "0x" + inputs["chain_id"].encode("ascii").hex()
    url = inputs["public_herald_url"]
    has_files = directory.exists() and any(directory.iterdir())
    if has_files:
        recorded = recorded_chain(directory)
        if not same(recorded, chain):
            raise DeploymentRefused(f"Run directory records chain {recorded}, configured chain is {chain}; data was not overwritten")
    base = identity_service_base(inputs["guardian_url"])
    listing = service_json(base + "/directory/shards", authenticated=True)
    if not isinstance(listing, dict) or not isinstance(listing.get("shards"), list):
        raise DeploymentRefused("Directory status read is malformed; data was not overwritten")
    if not all(directory_row_is_valid(row) for row in listing["shards"]):
        raise DeploymentRefused("Directory status row is malformed; data was not overwritten")
    rows = [row for row in listing["shards"] if row_matches_identity(row, chain, url)]
    if len(rows) > 1:
        raise DeploymentRefused("Several directory rows match this chain or Herald URL; data was not overwritten")
    row = rows[0] if rows else None
    if row is not None:
        if not same(row["chainId"], chain):
            raise DeploymentRefused(f"Herald URL {url} lists another chain {row['chainId']}; data was not overwritten")
        if row["url"] != url:
            raise DeploymentRefused(f"Chain {chain} is listed at another Herald URL {row['url']}; data was not overwritten")
    if not has_files:
        if is_listed_row(row):
            raise DeploymentRefused("Listed shard has no local initialization; data was not overwritten")
        return
    differences = unfinished_differences(directory / "data", inputs, release)
    if not differences:
        return
    if row is None:
        raise DeploymentRefused("Unlisted shard cannot continue: " + "; ".join(differences) +
                                "; remove the run directory yourself before retrying")
    if not is_own_pending_row(row, chain, url):
        raise DeploymentRefused("Listed shard cannot be reinitialized: " + "; ".join(differences))
    report_stage("restart pending shard")
    subprocess.run([*compose(directory), "down", "--volumes"], check=True, capture_output=True)
    shutil.rmtree(directory)
    directory.mkdir(mode=0o700, parents=True)


def unfinished_differences(data, inputs, release):
    required = ("native-world.json", "initialized.json", "init-configuration.json", "host-keys.json",
                "host-accounts.json", "vrf-key.json", "gameplay-contracts.json", "chain-config.yaml", "harness.env")
    if not all((data / name).exists() for name in required):
        return ["initialization is incomplete"]
    manifest, initialized = deployed_facts(data)
    if "native" not in manifest:
        return ["initialization is incomplete"]
    config = json.loads((data / "init-configuration.json").read_text())
    expected = {"shard": inputs["chain_id"].lower().replace("_", "-"), "chain_id": inputs["chain_id"],
                "guardian_url": inputs["guardian_url"], "l2_gas_bound": inputs["l2_gas_bound"]}
    differences = [] if config == expected else ["shard identity or play bound differs"]
    if not same(manifest["shard"].get("chainId"), "0x" + inputs["chain_id"].encode("ascii").hex()):
        differences.append("chain identity differs")
    guardian = shard.read_guardian_identity(inputs["guardian_url"])
    if not same(manifest.get("shard", {}).get("guardianPublicKey"), guardian["guardianPublicKey"]):
        differences.append("guardian identity differs")
    return differences + release_differences(release, manifest, initialized,
                                             [preset for preset in inputs["presets"] if str(preset) in initialized.get("presets", {})])


def write_build(directory, release):
    for name in ("compose.yml", "backup.py", "stack_lock.py", "operator_token.py"):
        shutil.copyfile(shard.ROOT / "deploy/shard" / name, directory / name)
    (directory / "images.env").write_text("".join(
        f"SHARD_{name.upper()}_IMAGE={digest}\n" for name, digest in release["images"].items()))
    shard.write_json(directory / "release.json", release)


def render_environment(inputs, images):
    values = {
        "SHARD_NAME": inputs["shard_name"], "CHAIN_ID": inputs["chain_id"], "GUARDIAN_URL": inputs["guardian_url"],
        "PUBLIC_RPC_URL": inputs["public_rpc_url"], "PUBLIC_HERALD_URL": inputs["public_herald_url"],
        "VRF_WORKERS": inputs["vrf_workers"], "L2_GAS_BOUND": inputs["l2_gas_bound"],
        "PLAYER_CAPACITY": inputs["player_capacity"], "PRESETS": ",".join(str(preset) for preset in inputs["presets"]),
        # Each environment sizes its shard: a small staging playtest, a large perf or production shard.
        "NODE_MEMORY": inputs["node_memory"], "HERALD_MEMORY": inputs["herald_memory"],
        "HOST_UID": os.getuid(), "HOST_GID": os.getgid(),
    }
    return images.rstrip("\n") + "\n" + "".join(f"{key}={value}\n" for key, value in values.items())


def compose(directory):
    return [*shard.DOCKER, "compose", "--project-directory", str(directory)]


def check_operator_approval():
    if not os.environ.get("OPERATOR_TOKEN"):
        raise ValueError("Official deployment needs the protected operator credential wrapper")



def start(directory, config, report_stage=ignore_stage):
    # Materialize the protected file before Compose creates the RPC container's file bind.
    report_stage("prepare")
    subprocess.run([*compose(directory), "run", "--rm", "--no-deps", "prepare"], check=True, capture_output=True)
    report_stage("start Herald")
    subprocess.run([*compose(directory), "up", "-d", "herald", "metrics"], check=True, capture_output=True)
    report_stage("wait for Herald identity")
    wait_for_identity(config)
    report_stage("register pending")
    status = directory_status(config, "pending")
    report_stage("start services")
    subprocess.run([*compose(directory), "up", "-d"], check=True, capture_output=True)
    report_stage("initialise")
    subprocess.run([*compose(directory), "wait", "init"], check=True, capture_output=True)
    code = subprocess.check_output([*compose(directory), "ps", "--all", "--format", "{{.ExitCode}}", "init"],
                                   text=True, stderr=subprocess.PIPE).strip()
    if code != "0":
        raise RuntimeError(f"initialization exited {code}; read {directory / 'data'}/*.log")
    return status



def activate(config, directory, report_stage=ignore_stage):
    report_stage("activate")
    confirm_worker_ledger_operator(config, directory)
    confirm_worker_launcher(config, directory)
    directory_status(config, "active")
    print(json.dumps({"event": "shard_activated", "status": "active"}))


def launcher_service(config, suffix, payload):
    base = identity_service_base(config["guardian_url"])
    try:
        return service_json(base + "/factory/operator/launcher/" + suffix, payload, timeout=120)
    except (OSError, ValueError):
        raise RuntimeError("Launch Worker enrollment route unavailable; directory remains pending") from None


def service_role_check(directory, account, role="launcher"):
    subprocess.run([*compose(directory.parent), "run", "--rm", "--no-deps", "-T",
                    "--entrypoint", "python3", "harness", "/app/deploy/shard/init.py",
                    "service-role-check", "/data", role, account],
                   check=True, capture_output=True, text=True)


def confirm_worker_ledger_operator(config, directory):
    manifest, _ = deployed_facts(directory)
    payload = {"chainId": manifest["shard"]["chainId"], "heraldUrl": config["public_herald_url"]}
    base = identity_service_base(config["guardian_url"])
    try:
        enrolled = service_json(base + "/value/operator/shard/enrol", payload, timeout=120)
    except (OSError, ValueError):
        raise RuntimeError("Relay enrollment route unavailable; directory remains pending") from None
    account = public_felt(enrolled.get("ledgerOperatorAccount"))
    if public_felt(enrolled.get("chainId")) != public_felt(payload["chainId"]):
        raise RuntimeError("Relay enrolled another chain; directory remains pending")
    service_role_check(directory, account, role="ledger_operator")


def public_felt(value):
    if not isinstance(value, str) or not value.startswith("0x"):
        raise RuntimeError("Worker returned an invalid public identity")
    try:
        number = int(value, 16)
    except ValueError:
        raise RuntimeError("Worker returned an invalid public identity") from None
    if not 0 < number < 2**251 + 17 * 2**192 + 1:
        raise RuntimeError("Worker returned an invalid public identity")
    return hex(number)


def confirm_worker_launcher(config, directory):
    manifest, _ = deployed_facts(directory)
    payload = {"chainId": manifest["shard"]["chainId"], "heraldUrl": config["public_herald_url"]}
    enrolled = launcher_service(config, "enrol", payload)
    account = public_felt(enrolled.get("launcherAccount"))
    if public_felt(enrolled.get("chainId")) != public_felt(payload["chainId"]):
        raise RuntimeError("Launch Worker enrolled another chain; directory remains pending")
    service_role_check(directory, account)

def deployed_facts(data):
    return json.loads((data / "native-world.json").read_text()), json.loads((data / "initialized.json").read_text())


def same(left, right):
    return left is not None and right is not None and int(str(left), 16) == int(str(right), 16)


def release_differences(release, manifest, initialized, presets):
    """Every way the deployed shard differs from the release it was deployed from."""
    native, classes = manifest["native"], release["classes"]
    differences = []
    if native["releaseId"] != release["releaseId"]:
        differences.append(f"release id {native['releaseId']}, release has {release['releaseId']}")
    if native["activeSchema"] != release["schema"]:
        differences.append(f"schema {native['activeSchema']}, release has {release['schema']}")
    if not same(native["gamesClassHash"], classes["games"]):
        differences.append(f"Games class {native['gamesClassHash']}, release has {classes['games']}")
    if not same(native.get("verifierClassHash"), classes.get("verifier")):
        differences.append(f"verifier class {native.get('verifierClassHash')}, release has {classes.get('verifier')}")
    for name in sorted(set(native["logic"]) | set(classes["logic"])):
        if not same(native["logic"].get(name), classes["logic"].get(name)):
            differences.append(f"{name} class {native['logic'].get(name)}, release has {classes['logic'].get(name)}")
    if not same(native.get("migrationClassHash"), release["migrationClassHash"]):
        differences.append(f"migration class {native.get('migrationClassHash')}, release has "
                           f"{release['migrationClassHash']}")
    if not same(manifest["shard"].get("accountClassHash"), classes["account"]):
        differences.append(f"account class {manifest['shard'].get('accountClassHash')}, release has {classes['account']}")
    for preset in presets:
        chain, expected = initialized.get("presets", {}).get(str(preset)), release["presets"].get(str(preset))
        if not same(chain, expected):
            differences.append(f"preset {preset} commitment {chain}, release has {expected}")
    return differences


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    raise SystemExit(main(sys.argv[1], Path(sys.argv[2]).resolve()))
