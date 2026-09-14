#!/usr/bin/env python3
"""Start the isolated release and initialize a new conformance deployment."""

import json
import re
from pathlib import Path
import sys
from runtime import compose, read_release, run


def initialize_database(deployment, output, database):
    command = ['docker', 'compose', '-p', 'madara-rand', '-f', str(deployment / 'docker-compose.yml'),
               'exec', '-T', 'journal-primary', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1']
    # CREATE DATABASE fails if it exists. Existing accepted streams are never recreated here.
    run([*command, '-d', 'postgres', '-c', f'CREATE DATABASE {database}'],
        output / 'create-database.log', deployment)
    run([*command, '-d', database, '-f', '/schema.sql'], output / 'initialize-stream.log', deployment)


def main():
    if len(sys.argv) != 4 or not re.fullmatch(r'[1-9][0-9]{0,8}', sys.argv[3]):
        raise SystemExit('usage: start-fixture.py RELEASE_DIRECTORY OUTPUT_DIRECTORY FIXTURE_ID')
    fixture_id = sys.argv[3]
    database = f'randomness_execution_{fixture_id}'
    release = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    if output.exists():
        raise SystemExit('fixture output already exists; preserve and recover that deployment')
    manifest = read_release(release)
    output.mkdir(parents=True)
    deployment = Path(__file__).resolve().parent
    repository = deployment.parents[1]
    bootstrap = output / 'bootstrap.env'
    bootstrap.write_text('\n'.join([
        'RANDOMNESS_ACCOUNT=0x1', 'RANDOMNESS_DEPLOYMENT=0x2', 'RANDOMNESS_EPOCH=1',
        'RANDOMNESS_PLACEMENT=sidecar', 'RANDOMNESS_PRIVATE_KEY=0xd431',
        f'RANDOMNESS_JOURNAL_PRIMARY=host=journal-primary dbname={database} user=randomness_writer_1 password=local-rehearsal',
        f'RANDOMNESS_JOURNAL_STANDBY=host=journal-standby dbname={database} user=randomness_writer_1 password=local-rehearsal', '',
    ]))
    bootstrap.chmod(0o600)
    initial = compose(deployment, release, bootstrap)
    run([*initial, 'config', '--format', 'json'], output / 'compose-bootstrap.json', deployment)
    run([*initial, 'up', '-d', '--wait', 'madara'], output / 'start-node.log', deployment)
    run(['scarb', '--manifest-path', 'contracts/l3/randomness-protocol/Scarb.toml', 'build'],
        output / 'contracts.log', repository)
    run(['bun', 'deploy/madara-rand/deploy-fixture.ts', str(output), fixture_id], output / 'deploy.log', repository)
    initialize_database(deployment, output, database)
    run([*initial, 'stop', 'madara'], output / 'stop-bootstrap.log', deployment)
    configured = compose(deployment, release, output / 'service.env')
    run([*configured, 'up', '-d', '--wait', 'madara'], output / 'start-configured-node.log', deployment)
    run([*configured, '--profile', 'sidecar', 'up', '-d', 'randomness-sidecar'], output / 'start-sidecar.log', deployment)
    (output / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'fixture': str(output / 'fixture.json'), 'scope': 'deployed conformance stub'}))


if __name__ == '__main__':
    main()
