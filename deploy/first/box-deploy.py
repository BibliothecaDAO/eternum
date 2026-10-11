#!/usr/bin/env python3
"""Replace the old shard without deleting its data; the existing deployer proves and activates the new one."""
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
from service_requests import service_json, identity_service_base


def occupying_projects(directory):
    rows = subprocess.check_output([*shard.DOCKER, 'ps', '--format', '{{json .}}'], text=True)
    containers = [json.loads(row) for row in rows.splitlines() if row]
    projects = set()
    for container in containers:
        if not any(f':{port}->' in container.get('Ports', '') for port in (8080, 8081)):
            continue
        detail = json.loads(subprocess.check_output([*shard.DOCKER, 'inspect', container['ID']], text=True))[0]
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


def main(environment, directory, revision):
    os.environ.update(operator_environment())
    inputs = deploy.load_inputs(environment)
    with shard.isolated_stack_lock('prepare first deployment'):
        retire_previous(inputs, directory)
    if deploy.main(environment, directory):
        raise RuntimeError('Shard deployment check failed')
    proof = directory / 'data/self-check.json'
    if not proof.exists() or not json.loads(proof.read_text()).get('passed'):
        raise RuntimeError('Deployment did not produce a passing gameplay proof')
    # This record is only a local hint: the caller also checks the live identity and directory.
    (directory / 'first-deployment-check.json').write_text(json.dumps({'revision': revision}))


if __name__ == '__main__':
    try:
        main(sys.argv[1], Path(sys.argv[2]), sys.argv[3])
    except Exception:
        raise SystemExit('Shard deployment stopped; no subprocess or credential-bearing error was printed') from None
