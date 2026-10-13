#!/usr/bin/env python3
"""Build and deploy this checkout, then prove the shard's classes, schema and presets before activation.

    python3 deploy/athanor/scripts/operator-command.py deploy ENVIRONMENT DIRECTORY

The committed deploy/release/ENVIRONMENT.json holds the shard identity and sizing. DIRECTORY retains its data.
"""
from contextlib import redirect_stdout, redirect_stderr
import time
import traceback
from urllib.error import HTTPError
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
from directory import directory_status, wait_for_identity, HeraldIdentityRefused
from service_requests import identity_service_base, service_json

ENVIRONMENTS = shard.ROOT / "deploy/release"
INPUTS = ("shard_name", "public_rpc_url", "public_herald_url",
          "player_capacity", "presets", "vrf_workers", "l2_gas_bound")


def ignore_stage(_stage):
    pass


def main(environment, directory, report_stage=ignore_stage):
    report_stage("prepare")
    target = deployment_target(environment, directory)
    inputs = load_inputs(environment)
    deployment_revision(target["environment"])
    with shard.isolated_stack_lock(f"deploy {environment}"):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        inputs["chain_id"] = chain_identity(directory, target["environment"])
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
        if not differences:
            remove_unused_checkouts()
    if differences:
        print(f"{environment} does not run commit {release['commit']}:", *differences, sep="\n  ", file=sys.stderr)
        return 1
    print(f"{environment} runs commit {release['commit']}")
    return 0


def remove_unused_checkouts():
    for checkout in (Path.home() / "cairo-suite").glob("first-release-*"):
        if (re.fullmatch(r"first-release-[0-9a-f]{7,40}", checkout.name)
                and checkout.is_dir() and not checkout.is_symlink() and checkout.resolve() != shard.ROOT.resolve()):
            shutil.rmtree(checkout)


def chain_identity(directory, environment):
    environment_file = directory / ".env"
    if environment_file.exists():
        values = dict(line.split("=", 1) for line in environment_file.read_text().splitlines() if "=" in line)
        return values["CHAIN_ID"]
    return f"{environment.upper()}_{time.time_ns():x}"


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
    target = next((value for value in targets.values() if value["environment"] == environment), None)
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
    target = next(value for value in targets.values() if value["environment"] == environment)
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


def is_deployment_log(path):
    return path.name.startswith("deploy-") and path.suffix == ".log"


def restart_unfinished(directory, inputs, release, report_stage):
    chain = "0x" + inputs["chain_id"].encode("ascii").hex()
    url = inputs["public_herald_url"]
    has_files = directory.exists() and any(not is_deployment_log(path) for path in directory.iterdir())
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
    rows = [row for row in listing["shards"] if row["status"] != "retired" and row_matches_identity(row, chain, url)]
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
    subprocess.run([*compose(directory), "down", "--volumes"], check=True, stdout=sys.stdout, stderr=sys.stderr)
    for path in directory.iterdir():
        if is_deployment_log(path):
            continue
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()


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
    subprocess.run([*compose(directory), "run", "--rm", "--no-deps", "prepare"], check=True, stdout=sys.stdout, stderr=sys.stderr)
    report_stage("start Herald")
    subprocess.run([*compose(directory), "up", "-d", "herald", "metrics"], check=True, stdout=sys.stdout, stderr=sys.stderr)
    report_stage("wait for Herald identity")
    wait_for_identity(config)
    report_stage("register pending")
    status = directory_status(config, "pending")
    report_stage("start services")
    subprocess.run([*compose(directory), "up", "-d"], check=True, stdout=sys.stdout, stderr=sys.stderr)
    report_stage("initialise")
    subprocess.run([*compose(directory), "wait", "init"], check=True, stdout=sys.stdout, stderr=sys.stderr)
    code = subprocess.check_output([*compose(directory), "ps", "--all", "--format", "{{.ExitCode}}", "init"],
                                   text=True, stderr=subprocess.PIPE).strip()
    if code != "0":
        raise RuntimeError(f"initialization exited {code}; read {directory / 'data'}/*.log")
    return status



def activate(config, directory, report_stage=ignore_stage):
    report_stage("activate")
    directory_status(config, "active")
    print(json.dumps({"event": "shard_activated", "status": "active"}))


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


STAGES = (
    "build images", "restart pending shard", "prepare", "start Herald", "wait for Herald identity",
    "register pending", "start services", "initialise", "verify facts", "activate",
)


def write_failure(error):
    detail = traceback.format_exc()
    if isinstance(error, subprocess.CalledProcessError):
        for output in (error.stdout, error.stderr):
            if output:
                detail += output.decode("utf8", errors="replace") if isinstance(output, bytes) else output
    for key in ("OPERATOR_TOKEN", "DEPLOYER_PRIVATE_KEY"):
        if os.environ.get(key):
            detail = detail.replace(os.environ[key], "[redacted]")
    print(detail, file=sys.stderr)


def failure_report(error, stage):
    detail = str(error) if isinstance(error, DeploymentRefused) else None
    status = error.code if isinstance(error, HTTPError) else None
    if isinstance(error, HeraldIdentityRefused):
        status = error.status
    code = getattr(error, "service_code", None) or type(error).__name__
    message = f"Shard deployment stopped at {stage}; HTTP {status if status is not None else 'n/a'}; code {code}."
    if detail:
        message += " " + detail
    return {"kind": "shard-deployment-refused", "message": message, "status": status, "error": code}


def run(environment, directory):
    stage = "prepare"
    restarted = False
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    log_path = directory / f"deploy-{time.time_ns()}.log"
    descriptor = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)

    def report_stage(name):
        nonlocal stage, restarted
        if name not in STAGES:
            raise ValueError("Unknown deployment stage")
        stage = name
        restarted = restarted or name == "restart pending shard"
        print(json.dumps({"stage": stage}), flush=True)

    outcome = {"kind": "shard-deployment-complete", "log": str(log_path)}
    code = 0
    with os.fdopen(descriptor, "w", buffering=1) as log, redirect_stdout(log), redirect_stderr(log):
        try:
            if main(environment, directory, report_stage):
                raise RuntimeError("Shard deployment check failed")
        except Exception as error:
            write_failure(error)
            outcome.update(failure_report(error, stage))
            code = 1
    outcome.update(stage=stage, restarted=restarted)
    print(json.dumps(outcome))
    return code


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    raise SystemExit(run(sys.argv[1], Path(sys.argv[2]).resolve()))
