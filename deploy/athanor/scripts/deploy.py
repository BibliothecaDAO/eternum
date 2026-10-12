#!/usr/bin/env python3
"""Build and deploy this checkout, then prove the shard's classes, schema and presets before activation.

    python3 deploy/athanor/scripts/operator-command.py deploy ENVIRONMENT DIRECTORY

The committed deploy/release/ENVIRONMENT.json holds the shard identity and sizing. DIRECTORY retains its data.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import shutil

import shard
from directory import directory_status, wait_for_identity
from service_requests import identity_service_base, service_json

ENVIRONMENTS = shard.ROOT / "deploy/release"
INPUTS = ("shard_name", "chain_id", "public_rpc_url", "public_herald_url",
          "player_capacity", "presets", "node_memory", "herald_memory", "vrf_workers", "l2_gas_bound")


def ignore_stage(_stage):
    pass


def main(environment, directory, report_stage=ignore_stage):
    report_stage("prepare")
    inputs = load_inputs(environment)
    with shard.isolated_stack_lock(f"deploy {environment}"):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        report_stage("build images")
        release = shard.build_images()
        write_build(directory, release)
        report_stage("prepare")
        (directory / ".env").write_text(render_environment(inputs, (directory / "images.env").read_text()))
        check_operator_approval()
        status = start(directory, inputs, report_stage)
        report_stage("self-check")
        differences = release_differences(release, *deployed_facts(directory / "data"), inputs["presets"])
        if not differences and status["status"] == "pending":
            verify_and_activate(inputs, directory / "data", report_stage)
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



def run_self_check(directory):
    result = subprocess.run(
        [*compose(directory.parent), "run", "--rm", "--no-deps", "--entrypoint", "python3",
         "harness", "/app/deploy/shard/init.py", "self-check"], capture_output=True, text=True,
    )
    # The runner emits public route/status JSON only. Never echo arbitrary setup failures/credentials.
    rows = [line for line in result.stdout.splitlines() if line.startswith("{")]
    if not rows:
        result.check_returncode()
        raise RuntimeError("self-check failed at load_deployment_fixture")
    check = json.loads(rows[-1])
    if result.returncode != 0:
        check["passed"] = False
    return check


def verify_and_activate(config, directory, report_stage=ignore_stage):
    report_stage("self-check")
    if directory_status(config, "pending")["status"] != "pending":
        print(json.dumps({"event": "shard_self_check_skipped", "reason": "shard_already_listed"}))
        return
    identity = gameplay_check_identity(directory)
    check_path = directory / "self-check.json"
    saved = json.loads(check_path.read_text()) if check_path.exists() else {}
    if saved.get("passed") and saved.get("checkedIdentity") == identity:
        check = saved
    else:
        if roles_handed_off(directory):
            raise RuntimeError("chain facts changed after the role handoff; retire this chain")
        check = run_self_check(directory)
        check["checkedIdentity"] = identity
        shard.write_json(check_path, check)
    if not check.get("passed"):
        route = check.get("firstFailedRoute", "unknown_route")
        raise RuntimeError(f"self-check failed at {route}; directory status unchanged")
    report_stage("activate")
    confirm_worker_ledger_operator(config, directory)
    confirm_worker_launcher(config, directory)
    directory_status(config, "active")
    print(json.dumps({"event": "shard_self_check_passed", "routes": len(check.get("completed", [])), "status": "active"}))


def gameplay_check_identity(directory):
    manifest, initialized = deployed_facts(directory)
    # The check proves chain identity and initialized contracts, independent of their runtime packaging.
    encoded = json.dumps([manifest, initialized], sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def launcher_service(config, suffix, payload):
    base = identity_service_base(config["guardian_url"])
    try:
        return service_json(base + "/factory/operator/launcher/" + suffix, payload, timeout=120)
    except (OSError, ValueError):
        raise RuntimeError("Launch Worker enrollment route unavailable; directory remains pending") from None


def roles_handed_off(directory):
    return service_role_check(directory, "state")["handedOff"]


def service_role_check(directory, action, account=None, role="launcher"):
    args = [action, "/data"]
    if account is not None:
        args.extend([role, account])
    result = subprocess.run([*compose(directory.parent), "run", "--rm", "--no-deps", "-T",
                             "--entrypoint", "python3", "harness", "/app/deploy/shard/init.py", "service-role-check", *args],
                            capture_output=True, text=True)
    if result.returncode != 0:
        result.check_returncode()
    if action == "state":
        try:
            rows = [line for line in result.stdout.splitlines() if line.startswith("{")]
            state = json.loads(rows[-1])
        except (ValueError, IndexError, AttributeError):
            raise RuntimeError("Role state read failed; directory remains pending") from None
        if not isinstance(state, dict) or state.get("passed") is not True or type(state.get("handedOff")) is not bool:
            raise RuntimeError("Role state read failed; directory remains pending")
        return state


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
    service_role_check(directory, "handoff", account, role="ledger_operator")


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
    service_role_check(directory, "handoff", account)

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
