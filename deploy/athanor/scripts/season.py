"""Open dev's free Frontier phase now, using the deployed preset and the protected operator wrapper."""
import json
from datetime import datetime
from pathlib import Path
import subprocess
import sys
import time

import deploy
import shard
from service_requests import service_json


def open_frontier(environment):
    if environment != "dev":
        raise ValueError("Box season opening is available only for dev")
    target = json.loads((shard.ROOT / "deploy/first/environments.json").read_text())[environment]
    base = target["origin"] + "/api/factory/calendar"
    calendar = service_json(base)
    now = time.time()
    for phase in calendar["phases"]:
        if phase["phase"] == "frontier" and phase_running(phase, now):
            return phase
    program = """
import { frontierBaseConfig } from './config/source/frontier/base';
import { frontierPreset } from './config/source/frontier/native';
import { seasonSeconds } from './packages/core/src/utils/days';
const tick = frontierBaseConfig.tick.armiesTickIntervalInSeconds * 1000;
const start = Math.floor(Date.now() / tick) * tick;
console.log(JSON.stringify({startsAt: new Date(start).toISOString(),
  endsAt: new Date(start + seasonSeconds(1, frontierPreset.dayUnitSeconds) * 1000).toISOString()}));
"""
    dates = json.loads(subprocess.check_output([
        *deploy.compose(Path(target["runDirectory"])), "run", "--rm", "--no-deps", "-T",
        "--entrypoint", "bun", "harness", "--eval", program,
    ], text=True))
    return service_json(base + "/frontier", dates, method="PUT")


def phase_running(phase, now):
    starts = datetime.fromisoformat(phase["startsAt"].replace("Z", "+00:00")).timestamp()
    ends = datetime.fromisoformat(phase["endsAt"].replace("Z", "+00:00")).timestamp()
    return starts <= now < ends


if __name__ == "__main__":
    try:
        with shard.isolated_stack_lock("open dev Frontier"):
            print(json.dumps(open_frontier(sys.argv[1])))
    except Exception as error:
        deploy.write_failure(error)
        print(json.dumps(deploy.failure_report(error, "open Frontier calendar")))
        raise SystemExit(1)
