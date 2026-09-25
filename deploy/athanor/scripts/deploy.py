#!/usr/bin/env python3
"""Deploy one of our shards from its release and prove it runs that release.

    OPERATOR_TOKEN=... python3 deploy/athanor/scripts/deploy.py ENVIRONMENT DIRECTORY

ENVIRONMENT names deploy/release/ENVIRONMENT.json, the deployment's inputs: the shard-v* package tag, the shard's
identity and public endpoints, its size and the presets it registers. That checked-in file is the environment's only
preset set; nothing else passes PRESETS. DIRECTORY holds the package and the shard's data/ across runs. The command
takes the isolated-stack lock, fetches the tag's shard.tar.gz, renders the package's .env from the inputs, checks that
initialization will receive an operator approval, starts the package, waits for initialization, then compares the
deployed shard with the release.json CI published beside it: release id, schema, every class, the migration and every
preset commitment. Any difference fails the deployment and is named.
"""
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
from urllib.request import urlopen

import shard

RELEASES = "https://github.com/BibliothecaDAO/eternum/releases/download"
ENVIRONMENTS = shard.ROOT / "deploy/release"
INPUTS = ("package", "shard_name", "chain_id", "guardian_url", "public_rpc_url", "public_admission_url",
          "player_capacity", "presets", "node_memory", "herald_memory")


def main(environment, directory):
    inputs = load_inputs(environment)
    with shard.isolated_stack_lock(f"deploy {environment}"):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        release = fetch_package(inputs["package"], directory)
        (directory / ".env").write_text(render_environment(inputs, (directory / "images.env").read_text()))
        check_operator_approval(directory, rendered_init_environment(directory))
        start(directory)
        differences = release_differences(release, *deployed_facts(directory / "data"), inputs["presets"])
    if differences:
        print(f"{environment} does not run {inputs['package']}:", *differences, sep="\n  ", file=sys.stderr)
        return 1
    print(f"{environment} runs {inputs['package']} (commit {release['commit']})")
    return 0


def load_inputs(environment):
    inputs = json.loads((ENVIRONMENTS / f"{environment}.json").read_text())
    missing = [key for key in INPUTS if key not in inputs]
    if missing:
        raise ValueError(f"{environment}.json lacks {', '.join(missing)}")
    return inputs


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
        "PUBLIC_RPC_URL": inputs["public_rpc_url"], "PUBLIC_ADMISSION_URL": inputs["public_admission_url"],
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


def start(directory):
    subprocess.run([*compose(directory), "up", "-d"], check=True)
    subprocess.run([*compose(directory), "wait", "init"], check=True, stdout=subprocess.DEVNULL)
    code = subprocess.check_output([*compose(directory), "ps", "--all", "--format", "{{.ExitCode}}", "init"],
                                   text=True).strip()
    if code != "0":
        raise RuntimeError(f"initialization exited {code}; read {directory / 'data'}/*.log")


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
