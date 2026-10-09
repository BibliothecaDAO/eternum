#!/usr/bin/env python3
"""Deploy one of our shards from its release and prove it runs that release.

    OPERATOR_TOKEN=... python3 deploy/athanor/scripts/deploy.py ENVIRONMENT DIRECTORY

ENVIRONMENT names deploy/release/ENVIRONMENT.json, the deployment's inputs: the shard-v* package tag, the shard's
identity and public endpoints, its size and the presets it registers. That committed file is the environment's only
preset set; nothing else passes PRESETS, and a file git does not track unchanged is refused. A new shard for an
environment is a new chain id and package in its file. DIRECTORY holds the package and the shard's data/ across runs.
The command takes the isolated-stack lock, fetches the tag's shard.tar.gz, renders the package's .env from the inputs,
checks that initialization will receive an operator approval, starts the package, waits for initialization, then
compares the deployed shard with the release.json CI published beside it: release id, schema, every class, the migration
and every preset commitment. Any difference fails the deployment and is named.
"""
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import shard

RELEASES = "https://github.com/BibliothecaDAO/eternum/releases/download"
ENVIRONMENTS = shard.ROOT / "deploy/release"
INPUTS = ("package", "shard_name", "chain_id", "guardian_url", "public_rpc_url", "public_herald_url",
          "player_capacity", "presets", "node_memory", "herald_memory", "vrf_workers", "l2_gas_bound")


def main(environment, directory):
    inputs = load_inputs(environment)
    with shard.isolated_stack_lock(f"deploy {environment}"):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        release = fetch_package(inputs["package"], directory)
        (directory / ".env").write_text(render_environment(inputs, (directory / "images.env").read_text()))
        check_operator_approval(directory, rendered_init_environment(directory))
        status = start(directory, inputs)
        differences = release_differences(release, *deployed_facts(directory / "data"), inputs["presets"])
        if not differences and status["status"] == "pending":
            verify_and_activate(inputs, directory / "data")
    if differences:
        print(f"{environment} does not run {inputs['package']}:", *differences, sep="\n  ", file=sys.stderr)
        return 1
    print(f"{environment} runs {inputs['package']} (commit {release['commit']})")
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
    return inputs


def committed(path):
    """Tracked by git and unchanged from HEAD."""
    def succeeds(*command):
        return subprocess.run(["git", *command], cwd=shard.ROOT, capture_output=True).returncode == 0
    return succeeds("ls-files", "--error-unmatch", str(path)) and succeeds("diff", "--quiet", "HEAD", "--", str(path))


def fetch_package(tag, directory):
    with urlopen(f"{RELEASES}/{tag}/shard.tar.gz", timeout=60) as response:
        archive = tarfile.open(fileobj=io.BytesIO(response.read()), mode="r:gz")
    for member in archive.getmembers():
        if member.isfile() and member.name.startswith("shard/") and "/" not in member.name[len("shard/"):]:
            (directory / member.name[len("shard/"):]).write_bytes(archive.extractfile(member).read())
    release = json.loads((directory / "release.json").read_text())
    if release["tag"] != tag:
        raise ValueError(f"release.json describes {release['tag']}, not {tag}")
    return release


def render_environment(inputs, images):
    values = {
        "SHARD_NAME": inputs["shard_name"], "CHAIN_ID": inputs["chain_id"], "GUARDIAN_URL": inputs["guardian_url"],
        "PUBLIC_RPC_URL": inputs["public_rpc_url"], "PUBLIC_HERALD_URL": inputs["public_herald_url"],
        "VRF_WORKERS": inputs["vrf_workers"],"L2_GAS_BOUND":inputs["l2_gas_bound"],
        "PLAYER_CAPACITY": inputs["player_capacity"], "PRESETS": ",".join(str(preset) for preset in inputs["presets"]),
        # Each environment sizes its shard: a small staging playtest, a large perf or production shard.
        "NODE_MEMORY": inputs["node_memory"], "HERALD_MEMORY": inputs["herald_memory"],
        "HOST_UID": os.getuid(), "HOST_GID": os.getgid(),
    }
    return images.rstrip("\n") + "\n" + "".join(f"{key}={value}\n" for key, value in values.items())


def compose(directory):
    return [*shard.DOCKER, "compose", "--project-directory", str(directory)]


# What Compose will hand initialization, through the same sudo as the start: a token in this shell that sudo dropped
# would otherwise surface only as a failed deployment.
def rendered_init_environment(directory):
    rendered = json.loads(subprocess.check_output([*compose(directory), "config", "--format", "json"], text=True))
    return rendered["services"]["init"].get("environment") or {}


def check_operator_approval(directory, init_environment):
    """Our shards approve their operator with the identity service's OPERATOR_TOKEN, passed through to initialization
    and never written to .env; a community shard brings data/operator-enrolment.json."""
    if not init_environment.get("OPERATOR_TOKEN") and not (directory / "data" / "operator-enrolment.json").exists():
        raise ValueError("Initialization would get no OPERATOR_TOKEN and data/ has no operator-enrolment.json")


def start(directory, config):
    # Materialize the protected file before Compose creates the RPC container's file bind.
    subprocess.run([*compose(directory), "run", "--rm", "--no-deps", "prepare"], check=True)
    subprocess.run([*compose(directory), "up", "-d", "herald", "metrics"], check=True)
    wait_for_identity(config)
    status = directory_status(config, "pending")
    subprocess.run([*compose(directory), "up", "-d"], check=True)
    subprocess.run([*compose(directory), "wait", "init"], check=True, stdout=subprocess.DEVNULL)
    code = subprocess.check_output([*compose(directory), "ps", "--all", "--format", "{{.ExitCode}}", "init"],
                                   text=True).strip()
    if code != "0":
        raise RuntimeError(f"initialization exited {code}; read {directory / 'data'}/*.log")
    return status


PENDING_ROUTE_PREREQUISITE = "The identity service must carry the pending route before a shard from this code starts"


def wait_for_identity(config):
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        try:
            with urlopen(config["public_herald_url"].rstrip("/") + "/manifest", timeout=3) as response:
                identity = json.load(response)["shard"]
            expected = "0x" + config["chain_id"].encode("ascii").hex()
            if int(identity["chainId"], 16) != int(expected, 16):
                raise RuntimeError("Herald serves a different shard identity")
            return
        except (OSError, KeyError, ValueError):
            time.sleep(1)
    raise RuntimeError("Herald did not serve the prepared shard identity")


def directory_status(config, status):
    if status not in ("pending", "active"):
        raise ValueError("Deployment can only register pending or activate a checked shard")
    token = os.environ.get("OPERATOR_TOKEN")
    if not token:
        raise ValueError("OPERATOR_TOKEN required for official directory activation")
    base = config["guardian_url"].removesuffix("/guardian")
    suffix = "/directory/shards/pending" if status == "pending" else "/directory/shards"
    request = Request(
        base + suffix, data=json.dumps({"url": config["public_herald_url"]}).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + token}, method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
    except HTTPError as error:
        if status == "pending" and error.code == 404:
            raise RuntimeError(PENDING_ROUTE_PREREQUISITE) from None
        raise
    allowed = ("pending", "active", "draining") if status == "pending" else ("active", "draining")
    if result.get("status") not in allowed:
        raise RuntimeError("Directory returned an unexpected shard status")
    return result


def run_self_check(directory, command=None):
    result = subprocess.run(
        [*(command or compose(directory.parent)), "run", "--rm", "--no-deps", "--entrypoint", "python3",
         "harness", "/app/deploy/shard/init.py", "self-check"], capture_output=True, text=True,
    )
    # The runner emits public route/status JSON only. Never echo arbitrary setup failures/credentials.
    rows = [line for line in result.stdout.splitlines() if line.startswith("{")]
    if not rows:
        raise RuntimeError("self-check failed at load_deployment_fixture")
    check = json.loads(rows[-1])
    if result.returncode != 0:
        check["passed"] = False
    return check


def verify_and_activate(config, directory, command=None):
    check = run_self_check(directory, command)
    shard.write_json(directory / "self-check.json", check)
    if not check.get("passed"):
        route = check.get("firstFailedRoute", "unknown_route")
        raise RuntimeError(f"self-check failed at {route}; directory status unchanged")
    directory_status(config, "active")
    print(json.dumps({"event": "shard_self_check_passed", "routes": len(check.get("completed", [])), "status": "active"}))


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
    if not same(native.get("verifierClassHash"),classes.get("verifier")):
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
