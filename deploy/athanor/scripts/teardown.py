"""Remove a shard and retire its directory row; mainnet setup and Cloudflare services survive.

    teardown.py dev [/opt/athanor/backups/NAME]
    teardown.py production /opt/athanor/backups/NAME

Dev's shard is disposable. Production's is removed only after `backup.py verify` accepts a copy of it under
/opt/athanor/backups: proven to restore, of the running chain, captured within the hour. Dev takes the same backup
when given one, so production's path is rehearsed on dev. A rerun after the run directory is gone only retires the row.
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


def require_verified_backup(directory, backup):
    """Runs the checkout's backup.py verify as root (the copy is root's) against the shard in this run directory."""
    project = next(line.split("=", 1)[1] for line in (directory / ".env").read_text().splitlines()
                   if line.startswith("SHARD_NAME="))
    check = subprocess.run(["sudo", "-n", sys.executable, str(shard.ROOT / "deploy/shard/backup.py"), "verify", project,
                            str(backup)], capture_output=True, text=True)
    if check.returncode != 0:
        raise ValueError(f"The backup does not verify; nothing was removed: {check.stdout.strip() or check.stderr.strip()}")


def teardown(arguments, report_stage):
    environment, backup = parse_arguments(arguments)
    target = json.loads((shard.ROOT / "deploy/first/environments.json").read_text())[environment]
    directory = Path(target["runDirectory"])
    config = deploy.load_inputs(target["environment"])
    with shard.isolated_stack_lock(f"teardown {environment}"):
        if directory.exists() and backup is not None:
            report_stage("verify backup")
            require_verified_backup(directory, backup)
        if directory.exists():
            report_stage("stop and remove volumes")
            if (directory / "compose.yml").exists():
                subprocess.run([*deploy.compose(directory), "down", "--volumes", "--remove-orphans"], check=True,
                               stdout=sys.stdout, stderr=sys.stderr)
            report_stage("keep deployment logs")
            logs = Path("/opt/athanor/logs")
            logs.mkdir(mode=0o700, exist_ok=True)
            for log in directory.glob("deploy-*.log"):
                shutil.copyfile(log, logs / log.name)
                (logs / log.name).chmod(0o600)
            report_stage("remove run directory")
            shutil.rmtree(directory)
        report_stage("retire directory row")
        directory_status(config, "retired")



def run(arguments):
    parse_arguments(arguments)
    logs = Path("/opt/athanor/logs")
    logs.mkdir(mode=0o700, exist_ok=True)
    path = logs / f"teardown-{time.time_ns()}.log"
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
