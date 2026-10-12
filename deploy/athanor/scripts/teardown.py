"""Remove the disposable dev shard; mainnet setup and Cloudflare services survive."""
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


def teardown(environment, report_stage):
    if environment != "dev":
        raise ValueError("Teardown is available only for dev")
    target = json.loads((shard.ROOT / "deploy/first/environments.json").read_text())[environment]
    directory = Path(target["runDirectory"])
    config = deploy.load_inputs(target["environment"])
    with shard.isolated_stack_lock("teardown dev"):
        report_stage("retire directory row")
        directory_status(config, "retired")
        if not directory.exists():
            return
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


def run(environment):
    if environment != "dev":
        raise ValueError("Teardown is available only for dev")
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
            teardown(environment, report_stage)
        except Exception as error:
            deploy.write_failure(error)
            outcome.update(deploy.failure_report(error, stage))
            code = 1
    print(json.dumps(outcome))
    return code


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1]))
