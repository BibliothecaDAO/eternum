"""Schedule dev Frontier on the deployed image's season clock."""
import argparse
import json
from datetime import datetime
from pathlib import Path
import subprocess
import sys
import time

import deploy
import shard
from service_requests import service_json


def parse_arguments(arguments):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=["dev"])
    parser.add_argument("--starts-at", help="ISO instant with timezone; omit both dates to open one bag now")
    parser.add_argument("--ends-at", help="ISO instant with timezone; must end on an army tick")
    args = parser.parse_args(arguments)
    if bool(args.starts_at) != bool(args.ends_at):
        parser.error("Supply both --starts-at and --ends-at, or neither")
    return args


def open_frontier(environment, starts_at=None, ends_at=None):
    if environment != "dev":
        raise ValueError("Box season opening is available only for dev")
    target = json.loads((shard.ROOT / "deploy/first/environments.json").read_text())[environment]
    directory = Path(target["runDirectory"])
    dates = season_dates(directory, starts_at, ends_at)
    base = target["origin"] + "/api/factory/calendar"
    calendar = service_json(base)
    for phase in calendar["phases"]:
        if phase["phase"] == "frontier" and phase_pending_or_running(phase, time.time()):
            require_same_season(phase, dates, starts_at is not None)
            return phase
    return service_json(base + "/frontier", dates, method="PUT")


def season_dates(directory, starts_at, ends_at):
    request = {"startsAt": starts_at, "endsAt": ends_at}
    return json.loads(subprocess.check_output([
        *deploy.compose(directory), "run", "--rm", "--no-deps", "-T",
        "--entrypoint", "bun", "harness", "deploy/athanor/scripts/season-dates.ts", json.dumps(request),
    ], text=True))


def phase_pending_or_running(phase, now):
    return datetime.fromisoformat(phase["endsAt"].replace("Z", "+00:00")).timestamp() > now


def require_same_season(phase, dates, explicit_dates):
    if explicit_dates and any(phase[key] != dates[key] for key in ("startsAt", "endsAt")):
        raise ValueError("Dev already has a pending or running Frontier season with different dates")


if __name__ == "__main__":
    args = parse_arguments(sys.argv[1:])
    try:
        with shard.isolated_stack_lock("open dev Frontier"):
            print(json.dumps(open_frontier(args.environment, args.starts_at, args.ends_at)))
    except Exception as error:
        deploy.write_failure(error)
        print(json.dumps(deploy.failure_report(error, "open Frontier calendar")))
        raise SystemExit(1)
