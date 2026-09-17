#!/usr/bin/env python3
"""Fence the local primary, verify the survivor, and replace its synchronous peer."""

import json
import os
import re
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime import compose, primary_service, read_fixture, read_release, run, service_environment
from drill_runtime import chain_result, journal_snapshot


def capture_chain(command, deployment, fixture, output):
    rows = journal_snapshot(command, deployment, f'randomness_execution_{fixture["fixtureId"]}', output / 'survivor.json')
    progress = []
    for row in rows:
        result = chain_result(fixture, row)
        if int(result[0], 16) == 0:
            break
        progress.append(dict(order=row['ticket_order'], binding=result[1], result=result[2], state=result[3]))
    (output / 'chain-progress.json').write_text(json.dumps(progress, indent=2) + '\n')


def fence_primary(command, deployment, output, primary):
    run([*command, 'stop', primary], output / 'stop-primary.log', deployment)
    run(['docker', 'network', 'disconnect', 'madara-rand_default', f'madara-rand-{primary}-1'],
        output / 'disconnect-primary.log', deployment)
    run(['docker', 'inspect', f'madara-rand-{primary}-1'], output / 'fenced-primary.json', deployment)
    retired = json.loads((output / 'fenced-primary.json').read_text())[0]
    if retired['State']['Running'] or retired['NetworkSettings']['Networks']:
        raise RuntimeError('old primary is not stopped and disconnected')


def verify_survivor(deployment, fixture, output, survivor_host, epoch):
    survivor = json.loads(subprocess.check_output(['docker', 'inspect', f'madara-rand-{survivor_host}-1']))[0]
    address = survivor['NetworkSettings']['Networks']['madara-rand_default']['IPAddress']
    environment = dict(os.environ, RANDOMNESS_SURVIVOR=
        f'host={address} port=5432 dbname=randomness_execution_{fixture["fixtureId"]} user=randomness_writer_{epoch} password=local-rehearsal',
        RANDOMNESS_RECOVERY_EPOCH=str(epoch), RANDOMNESS_CHAIN_PROGRESS=str(output / 'chain-progress.json'))
    command = ['cargo', 'test', '-p', 'mc-sequencer-randomness', '--test', 'recovery_snapshot', '--locked', '--',
               '--ignored', '--exact', 'survivor_prefix_matches_chain_before_promotion']
    with (output / 'verify-before-promotion.log').open('w') as log:
        subprocess.run(command, cwd=deployment.parents[2] / 'madara', env=environment, stdout=log,
                       stderr=subprocess.STDOUT, check=True)
    (output / 'verification-command.json').write_text(json.dumps(command) + '\n')


def promote_and_replicate(command, deployment, output, survivor_host, witness_host, topology):
    sql = [*command, 'exec', '-T', survivor_host, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
    run([*sql, '-c', "ALTER SYSTEM SET synchronous_standby_names='FIRST 1 (journal_standby)'",
         '-c', "ALTER SYSTEM SET synchronous_commit='remote_apply'", '-c', 'SELECT pg_reload_conf()'],
        output / 'promotion-durability.log', deployment)
    run([*sql, '-c', 'SELECT pg_promote(true, 30)'], output / 'promote.log', deployment)
    promoted = [*command, '-f', str(Path(__file__).with_name(topology))]
    run([*promoted, 'up', '-d', '--wait', '--no-deps', witness_host], output / 'replacement.log', deployment)
    deadline = time.monotonic() + 30
    state = ''
    while state != 'journal_standby:sync' and time.monotonic() < deadline:
        state = subprocess.check_output([*sql, '-Atc',
            "SELECT application_name||':'||sync_state FROM pg_stat_replication WHERE application_name='journal_standby'"], text=True).strip()
        if state != 'journal_standby:sync':
            time.sleep(0.1)
    if state != 'journal_standby:sync':
        raise RuntimeError('replacement is not the required synchronous witness')
    (output / 'replication.txt').write_text(state + '\n')
    return promoted


def rotate_writer(command, deployment, fixture, output, survivor_host, epoch):
    database = f'randomness_execution_{fixture["fixtureId"]}'
    sql = [*command, 'exec', '-T', survivor_host, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1']
    next_epoch = epoch + 1
    writer, replacement = f'randomness_writer_{epoch}', f'randomness_writer_{next_epoch}'
    mutation = f"""BEGIN;
        DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='{replacement}') THEN
          CREATE ROLE {replacement} LOGIN PASSWORD 'local-rehearsal'; END IF; END $$;
        GRANT USAGE ON SCHEMA randomness TO {replacement};
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA randomness TO {replacement};
        UPDATE randomness.stream SET epoch={next_epoch},writer='{replacement}' WHERE epoch={epoch};
        REVOKE ALL ON SCHEMA randomness FROM {writer};
        REVOKE ALL ON ALL FUNCTIONS IN SCHEMA randomness FROM {writer};
        COMMIT;"""
    (output / 'rotate-writer.sql').write_text(mutation + '\n')
    run([*sql, '-c', mutation], output / 'rotate-writer.log', deployment)
    run([*sql, '-c', f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='{writer}' AND datname=current_database()"],
        output / 'terminate-stale-connections.log', deployment)
    stale = [*command, 'exec', '-T', survivor_host, 'psql', '-U', replacement, '-d', database,
             '-v', 'ON_ERROR_STOP=1', '-c', f'SELECT * FROM randomness.head({epoch})']
    with (output / 'stale-epoch.log').open('w') as log:
        result = subprocess.run(stale, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode == 0 or 'fenced journal writer' not in (output / 'stale-epoch.log').read_text():
        raise RuntimeError('storage did not reject the stale epoch')


def resume_configuration(fixture_dir, survivor, witness, epoch):
    path = fixture_dir / 'service.env'
    changes = {'RANDOMNESS_EPOCH': str(epoch + 1), 'RANDOMNESS_PRIVATE_KEY': hex(0xd430 + epoch + 1)}
    hosts = {'RANDOMNESS_JOURNAL_PRIMARY': survivor, 'RANDOMNESS_JOURNAL_STANDBY': witness}
    result = []
    for line in path.read_text().splitlines():
        key, separator, value = line.partition('=')
        if key in changes:
            value = changes[key]
        elif key in hosts:
            value = re.sub(r'host=[^ ]+', f'host={hosts[key]}', value)
            value = value.replace(f'user=randomness_writer_{epoch} ', f'user=randomness_writer_{epoch + 1} ')
        result.append(key + separator + value)
    path.write_text('\n'.join(result) + '\n')


def main():
    if len(sys.argv) != 5:
        raise SystemExit('usage: promote.py MADARA_RELEASE FIXTURE_DIRECTORY PENDING_TRANSACTION OUTPUT_DIRECTORY')
    release, fixture_dir, pending, output = (Path(value).resolve() for value in sys.argv[1:])
    read_release(release)
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parents[1]
    fixture = read_fixture(fixture_dir)
    environment = service_environment(fixture_dir)
    epoch = int(environment['RANDOMNESS_EPOCH'])
    if not 1 <= epoch < 99:
        raise SystemExit('invalid rehearsal authority epoch')
    command = compose(deployment, release, fixture_dir / 'service.env')
    primary = primary_service(command)
    replacements = {
        'journal-standby': ('journal-replacement', 'journal-successor', 'promotion-next.yml'),
        'journal-replacement': ('journal-successor', 'journal-witness', 'promotion-final.yml'),
    }
    if primary not in replacements:
        raise SystemExit('no fresh witness is configured; preserve the current pair')
    survivor, witness, topology = replacements[primary]
    if f'host={survivor} ' not in environment['RANDOMNESS_JOURNAL_STANDBY']:
        raise SystemExit('the configured survivor does not match the current witness')
    capture_chain(command, deployment, fixture, output)
    # These readers retain their own checkpoints; stop them before their database endpoint is fenced.
    run(['docker', 'stop', 'madara-rand-herald-1', 'madara-rand-herald-replay-1'], output / 'stop-readers.log', deployment)
    fence_primary(command, deployment, output, primary)
    verify_survivor(deployment, fixture, output, survivor, epoch)
    promoted = promote_and_replicate(command, deployment, output, survivor, witness, topology)
    rotate_writer(promoted, deployment, fixture, output, survivor, epoch)
    run(['bun', 'deploy/madara-rand/rotate-fixture.ts', str(fixture_dir / 'fixture.json'), str(output / 'authority.json'), str(epoch + 1)],
        output / 'rotate-authority.log', deployment.parents[1])
    resume_configuration(fixture_dir, survivor, witness, epoch)
    run([*promoted, 'up', '-d', '--wait', '--no-deps', 'madara'], output / 'node-new-authority.log', deployment)
    request = urllib.request.Request('http://127.0.0.1:15050', data=pending.read_bytes(),
                                     headers={'content-type': 'application/json'})
    with urllib.request.urlopen(request, timeout=10) as response:
        stale = json.load(response)
    (output / 'stale-submission.json').write_text(json.dumps(stale, indent=2) + '\n')
    if 'error' not in stale or 'authority' not in json.dumps(stale['error']).lower():
        raise RuntimeError('old sequencing credential was not explicitly rejected at submission')
    print(json.dumps({'scope': 'local rehearsal, not the host-independence gate',
                      'epoch': epoch + 1, 'survivor_verified_before_promotion': True, 'replacement_synchronous': True}))


if __name__ == '__main__':
    main()
