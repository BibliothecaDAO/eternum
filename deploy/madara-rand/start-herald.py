#!/usr/bin/env python3
"""Start native Herald with separate live and reconstruction databases."""

import json
from pathlib import Path
import re
import sys
from runtime import compose, read_release, run


def main():
    if len(sys.argv) != 5:
        raise SystemExit('usage: start-herald.py MADARA_RELEASE HERALD_RELEASE FIXTURE_DIRECTORY OUTPUT_DIRECTORY')
    release, herald, fixture, output = (Path(argument).resolve() for argument in sys.argv[1:])
    read_release(release)
    manifest = json.loads((herald / 'manifest.json').read_text())
    if not manifest['image'].startswith('127.0.0.1:15000/randomness-herald@sha256:'):
        raise SystemExit('expected the isolated Herald digest')
    fixture_id = json.loads((fixture / 'fixture.json').read_text())['fixtureId']
    if not re.fullmatch(r'[1-9][0-9]{0,8}', fixture_id):
        raise SystemExit('invalid fixture identity')
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parent
    command = compose(deployment, release, fixture / 'service.env')
    databases = [f'randomness_herald_{fixture_id}', f'randomness_replay_{fixture_id}']
    for database in databases:
        run([*command, 'exec', '-T', 'journal-primary', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1',
             '-d', 'postgres', '-c', f'CREATE DATABASE {database}'], output / f'{database}.log', deployment)
    environment = output / 'herald.env'
    environment.write_text('\n'.join([
        f'HERALD_IMAGE={manifest["image"]}', f'HERALD_MANIFEST={fixture / "native-manifest.json"}',
        f'HERALD_DATABASE_URL=postgres://postgres:local-rehearsal@journal-primary:5432/{databases[0]}',
        f'HERALD_REPLAY_DATABASE_URL=postgres://postgres:local-rehearsal@journal-primary:5432/{databases[1]}', '',
    ]))
    environment.chmod(0o600)
    command += ['-f', str(deployment / 'herald.yml'), '--env-file', str(environment)]
    run([*command, '--profile', 'replay', 'config', '--format', 'json'], output / 'compose.json', deployment)
    run([*command, 'up', '-d', '--wait', 'herald'], output / 'start.log', deployment)
    (output / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'environment': str(environment), 'scope': 'native Herald over the conformance row fixture'}))


if __name__ == '__main__':
    main()
