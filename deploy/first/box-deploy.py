#!/usr/bin/env python3
"""Replace the old shard without deleting its data; the existing deployer proves and activates the new one."""
from contextlib import redirect_stdout, redirect_stderr
import time
import traceback
from urllib.error import HTTPError
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'deploy/athanor/scripts'))
import shard
import deploy
from operator_token import operator_environment
from directory import HeraldIdentityRefused
from service_requests import service_json, identity_service_base


def occupying_projects(directory):
    rows = subprocess.check_output([*shard.DOCKER, 'ps', '--format', '{{json .}}'], text=True, stderr=subprocess.PIPE)
    containers = [json.loads(row) for row in rows.splitlines() if row]
    projects = set()
    for container in containers:
        if not any(f':{port}->' in container.get('Ports', '') for port in (8080, 8081)):
            continue
        detail = json.loads(subprocess.check_output([*shard.DOCKER, 'inspect', container['ID']], text=True, stderr=subprocess.PIPE))[0]
        labels = detail['Config'].get('Labels') or {}
        project = labels.get('com.docker.compose.project.working_dir')
        if not project:
            raise ValueError('A non-compose container occupies a shard port; it was not stopped')
        if Path(project).resolve() != directory.resolve():
            projects.add(project)
    return sorted(projects)


def retire_previous(inputs, directory):
    projects = occupying_projects(directory)
    base = identity_service_base(inputs['guardian_url'])
    listing = service_json(base + '/directory')
    expected = int.from_bytes(inputs['chain_id'].encode('ascii'), 'big')
    matching = [row for row in listing['shards'] if row['url'] == inputs['public_herald_url'] and int(row['chainId'], 16) != expected]
    if not projects and not matching:
        return
    for row in matching:
        if row['status'] == 'active':
            service_json(base + '/directory/shards/status', {'url': row['url'], 'status': 'draining'})
    for project in projects:
        # No --volumes: both the former chain's files and Docker volumes remain available.
        subprocess.run([*shard.DOCKER, 'compose', '--project-directory', project, 'down'], check=True, stdout=sys.stdout, stderr=sys.stderr)
    for row in matching:
        service_json(base + '/directory/shards/status', {'url': row['url'], 'status': 'retired'})


def main(environment, directory, revision, report_stage):
    deploy.deployment_target(environment, directory)
    report_stage("prepare")
    os.environ.update(operator_environment())
    inputs = deploy.load_inputs(environment)
    with shard.isolated_stack_lock('prepare first deployment'):
        report_stage("build images")
        shard.build_images()
        report_stage("retire previous shard")
        retire_previous(inputs, directory)
    if deploy.main(environment, directory, report_stage):
        raise RuntimeError('Shard deployment check failed')
    built_revision = json.loads((directory / 'release.json').read_text())['commit']
    if revision is not None and built_revision != revision:
        raise deploy.DeploymentRefused(f"Box built commit {built_revision}, requested {revision}; deployment was not confirmed")


STAGES = (
    "retire previous shard", "build images", "restart pending shard", "prepare", "start Herald", "wait for Herald identity",
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
    detail = str(error) if isinstance(error, deploy.DeploymentRefused) else None
    status = error.code if isinstance(error, HTTPError) else None
    if isinstance(error, HeraldIdentityRefused):
        status = error.status
    code = getattr(error, "service_code", None) or type(error).__name__
    message = f"Shard deployment stopped at {stage}; HTTP {status if status is not None else 'n/a'}; code {code}."
    if detail:
        message += " " + detail
    return {"kind": "shard-deployment-refused", "message": message, "status": status, "error": code}


def run(environment, directory, revision):
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
            if revision is None:
                if deploy.main(environment, directory, report_stage):
                    raise RuntimeError("Shard deployment check failed")
            else:
                main(environment, directory, revision, report_stage)
        except Exception as error:
            write_failure(error)
            outcome.update(failure_report(error, stage))
            code = 1
    outcome.update(stage=stage, restarted=restarted)
    print(json.dumps(outcome))
    return code


if __name__ == '__main__':
    raise SystemExit(run(sys.argv[1], Path(sys.argv[2]), sys.argv[3]))
