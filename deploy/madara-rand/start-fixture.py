#!/usr/bin/env python3
"""Start the isolated release and initialize a new conformance deployment."""

import json
import re
from pathlib import Path
import sys
from runtime import compose, read_release, run, running_journal_hosts


def initialize_database(deployment, output, database, primary):
    command = ['docker', 'exec', '-i', f'madara-rand-{primary}-1', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1']
    # CREATE DATABASE fails if it exists. Existing accepted streams are never recreated here.
    run([*command, '-d', 'postgres', '-c', f'CREATE DATABASE {database}'],
        output / 'create-database.log', deployment)
    schema = deployment.parents[2] / 'madara/madara/crates/client/sequencer-randomness/src/journal.sql'
    run([*command, '-d', database, '-f', '-'], output / 'initialize-stream.log', deployment, schema.read_text() + schema.with_name('journal-lookup.sql').read_text())


def main():
    if len(sys.argv) != 6 or not re.fullmatch(r'[1-9][0-9]{0,8}', sys.argv[3]):
        raise SystemExit('usage: start-fixture.py RELEASE_DIRECTORY OUTPUT_DIRECTORY FIXTURE_ID NATIVE_SOURCE REALM_COUNT')
    fixture_id = sys.argv[3]
    database = f'randomness_execution_{fixture_id}'
    release = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    if output.exists():
        raise SystemExit('fixture output already exists; preserve and recover that deployment')
    manifest = read_release(release)
    output.mkdir(parents=True)
    deployment = Path(__file__).resolve().parent
    primary, witness = running_journal_hosts()
    native_source = Path(sys.argv[4]).resolve()
    bootstrap = output / 'bootstrap.env'
    bootstrap.write_text('\n'.join([
        'RANDOMNESS_ACCOUNT=0x1', 'RANDOMNESS_DEPLOYMENT=0x2', 'RANDOMNESS_EPOCH=1',
        'RANDOMNESS_PLACEMENT=sidecar', 'RANDOMNESS_PRIVATE_KEY=0xd431',
        f'RANDOMNESS_SCHEMA_HOST_PATH={native_source / "contracts/l3/world-native/schema/schema.json"}',
        'RANDOMNESS_L2_RPC_URL=http://madara:9944',
        f'RANDOMNESS_JOURNAL_PRIMARY=host={primary} dbname={database} user=randomness_writer_1 password=local-rehearsal',
        f'RANDOMNESS_JOURNAL_STANDBY=host={witness} dbname={database} user=randomness_writer_1 password=local-rehearsal', '',
    ]))
    bootstrap.chmod(0o600)
    initial = compose(deployment, release, bootstrap)
    run([*initial, 'stop', 'randomness-sidecar'], output / 'stop-previous-worker.log', deployment)
    run([*initial, 'config', '--format', 'json'], output / 'compose-bootstrap.json', deployment)
    run([*initial, 'up', '-d', '--wait', 'madara'], output / 'start-node.log', deployment)
    for package in ('world-native', 'player-account'):
        run(['scarb', 'build'], output / f'{package}-contracts.log', native_source / 'contracts/l3' / package)
    run(['bun', 'contracts/l3/world-native/scripts/generate-schema.mjs', '--check'],
        output / 'native-schema-check.log', native_source)
    run(['docker', 'run', '--rm', '--entrypoint', '/bin/randomness-sidecar',
         '--mount', f'type=bind,source={native_source / "contracts/l3/world-native/schema/schema.json"},target=/schema.json,readonly',
         manifest['image'], '--check-native-schema', '/schema.json'], output / 'admission-schema-check.log', deployment)
    run(['bun', 'deploy/madara-rand/deploy-fixture.ts', str(output), fixture_id, str(native_source), sys.argv[5], primary, witness], output / 'deploy.log', native_source)
    initialize_database(deployment, output, database, primary)
    run([*initial, 'stop', 'madara'], output / 'stop-bootstrap.log', deployment)
    configured = compose(deployment, release, output / 'service.env')
    run([*configured, 'up', '-d', '--wait', 'madara'], output / 'start-configured-node.log', deployment)
    run([*configured, '--profile', 'sidecar', 'up', '-d', 'randomness-sidecar'], output / 'start-sidecar.log', deployment)
    (output / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'fixture': str(output / 'fixture.json'), 'scope': 'native explore deployment'}))


if __name__ == '__main__':
    main()
