#!/usr/bin/env python3
"""Inspect a copy of the retired disk without restoring its authority or network."""

import json
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime import read_fixture, run, service_environment, journal_host
from drill_runtime import write_drill_report

IMAGE = 'postgres@sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73'


def copy_retired_disk(deployment, output, volume, retired_host):
    retired = json.loads(subprocess.check_output(['docker', 'inspect', f'madara-rand-{retired_host}-1']))[0]
    if retired['State']['Running'] or retired['NetworkSettings']['Networks']:
        raise RuntimeError('the retired primary must remain stopped and disconnected')
    volumes = subprocess.check_output(['docker', 'volume', 'ls', '--format', '{{.Name}}'], text=True).splitlines()
    if volume in volumes:
        raise RuntimeError('quarantine volume already exists; preserve it instead of overwriting a restore')
    source = next(mount['Name'] for mount in retired['Mounts'] if mount['Destination'] == '/var/lib/postgresql/data')
    run(['docker', 'volume', 'create', '--label', 'com.docker.compose.project=madara-rand',
         '--label', 'com.docker.compose.volume=journal-quarantine', volume], output / 'volume.log', deployment)
    run(['docker', 'run', '--rm', '--network', 'none', '--mount', f'type=volume,source={source},target=/source,readonly',
         '--mount', f'type=volume,source={volume},target=/copy', IMAGE, 'sh', '-c', 'cp -a /source/. /copy/'],
        output / 'copy.log', deployment)


def inspect_restore(database, output, container, live_host):
    sql = """SELECT json_agg(row_to_json(t) ORDER BY ticket_order) FROM
        (SELECT ticket_order,encode(action,'hex') action,encode(envelope,'hex') envelope,encode(binding,'hex') binding
         FROM randomness.tickets) t"""
    rows = []
    for address, name in [(container, 'restored'), (f'madara-rand-{live_host}-1', 'live')]:
        command = ['docker', 'exec', address, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1']
        run([*command, '-Atc', sql], output / f'{name}.json', output)
        rows.append(json.loads((output / f'{name}.json').read_text()))
    if not rows[0] or rows[0] != rows[1][:len(rows[0])]:
        raise RuntimeError('retired disk does not retain the same accepted bindings')
    command = ['docker', 'exec', container, 'psql', '-U', 'postgres', '-d', database,
               '-v', 'ON_ERROR_STOP=1', '-c', 'UPDATE randomness.stream SET epoch=epoch+1']
    with (output / 'rejected-write.log').open('w') as log:
        result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode == 0 or 'read-only transaction' not in (output / 'rejected-write.log').read_text():
        raise RuntimeError('quarantined restore accepted a write')
    return len(rows[0]), len(rows[1]) - len(rows[0])


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: restore.py FIXTURE_DIRECTORY OUTPUT_DIRECTORY')
    fixture, output = (Path(value).resolve() for value in sys.argv[1:])
    fixture_id = read_fixture(fixture)['fixtureId']
    environment = service_environment(fixture)
    epoch = int(environment['RANDOMNESS_EPOCH'])
    primary = journal_host(environment['RANDOMNESS_JOURNAL_PRIMARY'])
    retired = {'journal-replacement': 'journal-standby', 'journal-successor': 'journal-replacement'}[primary]
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parents[1]
    volume = f'madara-rand_journal-quarantine-{fixture_id}-{epoch}'
    container = f'madara-rand-journal-quarantine-{fixture_id}-{epoch}'
    copy_retired_disk(deployment, output, volume, retired)
    environment = output / 'restore.env'
    environment.write_text(f'RESTORE_VOLUME={volume}\nRESTORE_CONTAINER={container}\n')
    command = ['docker', 'compose', '-p', 'madara-rand', '-f', str(Path(__file__).with_name('restore.yml')), '--env-file', str(environment)]
    run([*command, 'up', '-d', '--wait', 'journal-quarantine'], output / 'start.log', deployment)
    count, missing_suffix = inspect_restore(f'randomness_execution_{fixture_id}', output, container, primary)
    run(['docker', 'inspect', container], output / 'container.json', deployment)
    container = json.loads((output / 'container.json').read_text())[0]
    if container['HostConfig']['NetworkMode'] != 'none':
        raise RuntimeError('retired disk restore acquired a network')
    write_drill_report(output, {
        'scope': 'local rehearsal, not the host-independence gate',
        'accepted_prefix_bindings_match': count, 'missing_current_suffix': missing_suffix, 'activation_permitted': False, 'quarantined_without_network': True, 'writes_rejected': True,
    })


if __name__ == '__main__':
    main()
