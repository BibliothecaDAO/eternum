#!/usr/bin/env python3
"""Run the Dojo baseline decoder on the same chain and Herald release as native."""

import json
from pathlib import Path
import sys
from runtime import compose, primary_service, read_fixture, read_release, run

if len(sys.argv) != 6:
    raise SystemExit('usage: start-baseline-herald.py MADARA_RELEASE HERALD_RELEASE FIXTURE DOJO_MANIFEST OUTPUT')
release, herald, fixture, manifest, output = (Path(value).resolve() for value in sys.argv[1:])
read_release(release)
identity = read_fixture(fixture)['fixtureId']
world = json.loads(manifest.read_text())
if 'native' in world:
    raise SystemExit('baseline requires the unchanged Dojo deployment')
image = json.loads((herald / 'manifest.json').read_text())['image']
if not image.startswith('127.0.0.1:15000/randomness-herald@sha256:'):
    raise SystemExit('expected the isolated Herald release')
output.mkdir(parents=True, exist_ok=False)
deployment = Path(__file__).resolve().parent
command = compose(deployment, release, fixture / 'service.env')
primary = primary_service(command)
database = f'randomness_baseline_{identity}'
run([*command, 'exec', '-T', primary, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
     '-c', f'CREATE DATABASE {database}'], output / 'database.log', deployment)
environment = output / 'baseline.env'
environment.write_text(f'HERALD_IMAGE={image}\nBASELINE_MANIFEST={manifest}\n'
                       f'BASELINE_DATABASE_URL=postgres://postgres:local-rehearsal@{primary}:5432/{database}\n')
environment.chmod(0o600)
command += ['-f', str(deployment / 'baseline-herald.yml'), '--env-file', str(environment)]
run([*command, 'config', '--format', 'json'], output / 'compose.json', deployment)
run([*command, 'up', '-d', '--wait', 'herald-baseline'], output / 'start.log', deployment)
print(json.dumps({'world': world['world']['address'], 'herald': 'http://127.0.0.1:13005'}))
