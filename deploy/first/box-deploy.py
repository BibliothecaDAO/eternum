#!/usr/bin/env python3
"""Replace the old shard without deleting its data; the existing deployer proves and activates the new one."""
from contextlib import redirect_stdout, redirect_stderr
import io
import json
import os
import re
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
        subprocess.run([*shard.DOCKER, 'compose', '--project-directory', project, 'down'], check=True, capture_output=True)
    for row in matching:
        service_json(base + '/directory/shards/status', {'url': row['url'], 'status': 'retired'})


def main(environment, directory, revision, report_stage):
    deploy.deployment_target(environment, directory)
    report_stage("prepare")
    os.environ.update(operator_environment())
    inputs = deploy.load_inputs(environment)
    with shard.isolated_stack_lock('prepare first deployment'):
        report_stage("retire previous shard")
        retire_previous(inputs, directory)
    if deploy.main(environment, directory, report_stage):
        raise RuntimeError('Shard deployment check failed')
    report_stage("self-check")
    proof = directory / 'data/self-check.json'
    if not proof.exists() or not json.loads(proof.read_text()).get('passed'):
        raise RuntimeError('Deployment did not produce a passing gameplay proof')
    # This record is only a local hint: the caller also checks the live identity and directory.
    (directory / 'first-deployment-check.json').write_text(json.dumps({'revision': revision}))


STAGES = (
    "retire previous shard", "build images", "restart pending shard", "prepare", "start Herald", "wait for Herald identity",
    "register pending", "start services", "initialise", "self-check", "activate",
)


def docker_error_line(error):
    if not isinstance(error, subprocess.CalledProcessError) or not isinstance(error.cmd, (list, tuple)):
        return None
    if "docker" not in error.cmd or "compose" not in error.cmd:
        return None
    stderr = error.stderr or ""
    if isinstance(stderr, bytes):
        stderr = stderr.decode("utf-8", errors="replace")
    lines = [line for line in stderr.splitlines() if line.strip()]
    if not lines:
        return None
    line = lines[-1]
    if any(value and value in line for value in os.environ.values()):
        return None
    if re.search(r"0x[0-9a-f]{17,}", line, re.IGNORECASE) or not line.isprintable():
        return None
    return line.strip()


def run(environment, directory, revision):
    stage = "prepare"
    restarted = False

    def report_stage(name):
        nonlocal stage, restarted
        if name not in STAGES:
            raise ValueError("Unknown deployment stage")
        stage = name
        restarted = restarted or name == "restart pending shard"

    try:
        # Only the structured outcome crosses SSH; subprocess output is captured at its call site.
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            main(environment, directory, revision, report_stage)
    except Exception as error:
        detail = docker_error_line(error)
        if isinstance(error, deploy.DeploymentRefused):
            detail = str(error)
        if isinstance(error, HeraldIdentityRefused):
            detail = f"Herald identity read refused: HTTP {error.status}"
        if isinstance(error, deploy.SelfCheckFailed):
            detail = str(error)
        message = f"Shard deployment stopped at {stage}."
        if detail:
            message += " " + detail
        print(json.dumps({"kind": "shard-deployment-refused", "message": message, **({"restarted": True} if restarted else {})}))
        return 1
    print(json.dumps({"kind": "shard-deployment-complete", "restarted": restarted}))
    return 0


if __name__ == '__main__':
    raise SystemExit(run(sys.argv[1], Path(sys.argv[2]), sys.argv[3]))
