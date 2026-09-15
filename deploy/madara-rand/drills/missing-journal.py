#!/usr/bin/env python3
"""Verify that missing replicated history stops startup without initializing a stream."""

import json
import re
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime import compose, read_fixture, read_release, run, service_environment, primary_service
from drill_runtime import write_drill_report


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: missing-journal.py MADARA_RELEASE PROMOTED_FIXTURE_DIRECTORY OUTPUT_DIRECTORY')
    release, fixture_dir, output = (Path(value).resolve() for value in sys.argv[1:])
    manifest = read_release(release)
    fixture = read_fixture(fixture_dir)
    environment = service_environment(fixture_dir)
    epoch = int(environment['RANDOMNESS_EPOCH'])
    if epoch < 2:
        raise SystemExit('this drill uses the promoted journal pair')
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parents[1]
    command = compose(deployment, release, fixture_dir / 'service.env')
    database = f'randomness_missing_journal_{fixture["fixtureId"]}_{epoch}'
    sql = [*command, 'exec', '-T', primary_service(command), 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1']
    run([*sql, '-d', 'postgres', '-c', f'CREATE DATABASE {database}'], output / 'empty-database.log', deployment)
    connections = {key: re.sub(r'dbname=[^ ]+', f'dbname={database}', environment[key])
                   for key in ('RANDOMNESS_JOURNAL_PRIMARY', 'RANDOMNESS_JOURNAL_STANDBY')}
    missing = [*command, '--profile', 'sidecar', 'run', '--rm', '--no-deps', '--name', 'madara-rand-missing-journal',
        '-e', f'RANDOMNESS_JOURNAL_PRIMARY={connections["RANDOMNESS_JOURNAL_PRIMARY"]}',
        '-e', f'RANDOMNESS_JOURNAL_STANDBY={connections["RANDOMNESS_JOURNAL_STANDBY"]}',
        'randomness-sidecar']
    with (output / 'startup.log').open('w') as log:
        try:
            result = subprocess.run(missing, stdout=log, stderr=subprocess.STDOUT, timeout=20)
        except subprocess.TimeoutExpired:
            subprocess.run(['docker', 'stop', 'madara-rand-missing-journal'], check=True)
            raise RuntimeError('service did not stop on missing history') from None
    if result.returncode == 0 or 'schema "randomness" does not exist' not in (output / 'startup.log').read_text():
        raise RuntimeError('startup did not report the missing journal schema')
    run([*sql, '-d', database, '-Atc', "SELECT count(*) FROM pg_namespace WHERE nspname='randomness'"],
        output / 'schema-count.log', deployment)
    if (output / 'schema-count.log').read_text().strip() != '0':
        raise RuntimeError('service recreated journal storage')
    (output / 'command.json').write_text(json.dumps(missing, indent=2) + '\n')
    write_drill_report(output, {
        'scope': 'local rehearsal, not the host-independence gate; missing replicated history',
        'image': manifest['image'], 'startup_exit_code': result.returncode, 'replacement_history_created': False,
    })


if __name__ == '__main__':
    main()
