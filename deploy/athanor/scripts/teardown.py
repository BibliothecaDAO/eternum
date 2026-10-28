"""Remove a shard and retire its directory row; mainnet setup and Cloudflare services survive.

    teardown.py dev [/opt/athanor/backups/NAME]
    teardown.py production /opt/athanor/backups/NAME

Dev's shard is disposable. Production's is removed only after `backup.py verify` accepts a copy of it under
/opt/athanor/backups: proven to restore, of the running chain, taken after its writes closed and with no transaction
since (backup.py quiesce, then capture). Dev takes the same backup when given one, so production's path is rehearsed
on dev. Once a backup verifies, /opt/athanor/logs/teardown-ENVIRONMENT.json records it with the shard's chain before
anything is removed. While the chain's volume exists every run verifies again; only a run stopped after the volumes
are gone resumes from that record, and never from another backup or another chain's. A rerun after the run directory is gone only retires the row; a finished teardown keeps its record as
teardown-CHAIN.json.
"""
from contextlib import redirect_stdout, redirect_stderr
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import deploy
import shard
from directory import directory_status


BACKUPS = Path("/opt/athanor/backups")
USAGE = "Teardown takes dev, or production with a verified backup under /opt/athanor/backups"


def parse_arguments(arguments):
    """The environment, and the backup that must verify before its shard is removed: production's always."""
    if arguments == ["dev"]:
        return "dev", None
    if len(arguments) == 2 and arguments[0] in ("dev", "production"):
        backup = Path(arguments[1])
        if backup.is_absolute() and backup.parent == BACKUPS and backup.name not in ("", ".", ".."):
            return arguments[0], backup
    raise ValueError(USAGE)


def shard_identity(directory):
    """The shard this run directory holds: its name and its chain."""
    values = dict(line.split("=", 1) for line in (directory / ".env").read_text().splitlines() if "=" in line)
    return {"project": values["SHARD_NAME"], "chain_id": values["CHAIN_ID"]}


LOGS = Path("/opt/athanor/logs")


def verification_record(environment):
    """Where a verified backup is recorded: outside the run directory, so it outlives the removal it permits."""
    return LOGS / f"teardown-{environment}.json"


def chain_data_exists(project):
    """Whether the shard's chain volume is still there: until compose down removes it, the node can be asked. Docker
    lists volumes whether or not this one exists, so an empty list proves it is gone; a listing that fails proves
    nothing, and the teardown stops before removing anything."""
    volume = f"{project}_chain"
    listed = subprocess.run([*shard.DOCKER, "volume", "ls", "--quiet", "--filter", f"name={volume}"],
                            capture_output=True, text=True)
    if listed.returncode != 0:
        raise RuntimeError(f"Docker could not list volumes, so {volume} may still exist; nothing was removed: "
                           f"{listed.stderr.strip()}")
    return volume in listed.stdout.split()


def require_verified_backup(environment, directory, backup):
    """The backup verified for this shard now, by the checkout's backup.py verify as root (the copy is root's), and
    recorded before anything is removed. While the chain's data exists it is always verified again, so a shard that
    reopened its writes after an earlier verification is never removed on that record. Only once its volumes are gone,
    where nothing can be asked, does the record of this chain and backup let a stopped removal finish."""
    path = verification_record(environment)
    recorded = json.loads(path.read_text()) if path.exists() else None
    if not (directory / ".env").exists():
        # A removal stopped part way: only a record of this backup, from the run that began it, lets it finish.
        if recorded and recorded["backup"] == str(backup):
            return
        raise ValueError("This shard can no longer be identified and no teardown of it verified this backup; "
                         "nothing more was removed")
    identity = shard_identity(directory)
    expected = {**identity, "backup": str(backup)}
    if not chain_data_exists(identity["project"]):
        if recorded == expected:
            return
        raise ValueError("This shard's chain is gone and no teardown of it verified this backup; nothing more was removed")
    check = subprocess.run(["sudo", "-n", sys.executable, str(shard.ROOT / "deploy/shard/backup.py"), "verify",
                            identity["project"], str(backup)], capture_output=True, text=True)
    if check.returncode != 0:
        raise ValueError(f"The backup does not verify; nothing was removed: {check.stdout.strip() or check.stderr.strip()}")
    LOGS.mkdir(mode=0o700, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.write_text(json.dumps(expected))
    temporary.chmod(0o600)
    temporary.replace(path)


def complete_verification_record(environment):
    """A finished teardown keeps its record under its chain, so the next teardown starts from none."""
    path = verification_record(environment)
    if path.exists():
        chain = json.loads(path.read_text())["chain_id"]
        path.replace(LOGS / f"teardown-{chain}.json")


def teardown(arguments, report_stage):
    environment, backup = parse_arguments(arguments)
    target = json.loads((shard.ROOT / "deploy/first/environments.json").read_text())[environment]
    directory = Path(target["runDirectory"])
    config = deploy.load_inputs(target["environment"])
    with shard.isolated_stack_lock(f"teardown {environment}"):
        if directory.exists() and backup is not None:
            report_stage("verify backup")
            require_verified_backup(environment, directory, backup)
        if directory.exists():
            report_stage("stop and remove volumes")
            if (directory / "compose.yml").exists():
                subprocess.run([*deploy.compose(directory), "down", "--volumes", "--remove-orphans"], check=True,
                               stdout=sys.stdout, stderr=sys.stderr)
            report_stage("keep deployment logs")
            LOGS.mkdir(mode=0o700, exist_ok=True)
            for log in directory.glob("deploy-*.log"):
                shutil.copyfile(log, LOGS / log.name)
                (LOGS / log.name).chmod(0o600)
            report_stage("remove run directory")
            shutil.rmtree(directory)
        report_stage("retire directory row")
        directory_status(config, "retired")
        if backup is not None:
            complete_verification_record(environment)



def run(arguments):
    parse_arguments(arguments)
    LOGS.mkdir(mode=0o700, exist_ok=True)
    path = LOGS / f"teardown-{time.time_ns()}.log"
    stage = "prepare"
    def report_stage(name):
        nonlocal stage
        stage = name
        print(json.dumps({"stage": name}), flush=True)
    outcome = {"kind": "shard-teardown-complete", "log": str(path)}
    code = 0
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", buffering=1) as log, redirect_stdout(log), redirect_stderr(log):
        try:
            teardown(arguments, report_stage)
        except Exception as error:
            deploy.write_failure(error)
            outcome.update(deploy.failure_report(error, stage), stage=stage)
            code = 1
    print(json.dumps(outcome))
    return code


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
