#!/usr/bin/env python3
"""Compare the live fold with a separate container rebuilding from chain history."""

import json
from pathlib import Path
import subprocess
import sys
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime import compose, primary_service, read_fixture, read_release, run
from drill_runtime import write_drill_report


def snapshot(port, game):
    with urllib.request.urlopen(f'http://127.0.0.1:{port}/madara/games/{game}/snapshot', timeout=10) as response:
        return json.load(response)


def main():
    if len(sys.argv) != 5:
        raise SystemExit('usage: herald-replay.py MADARA_RELEASE FIXTURE_DIRECTORY HERALD_DIRECTORY OUTPUT_DIRECTORY')
    release, fixture, herald, output = (Path(value).resolve() for value in sys.argv[1:])
    read_release(release)
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parents[1]
    configuration = json.loads((herald / 'compose.json').read_text())
    database_url = configuration['services']['herald-replay']['environment']['DATABASE_URL']
    database = database_url.rsplit('/', 1)[1]
    command = compose(deployment, release, fixture / 'service.env')
    tables = subprocess.check_output([*command, 'exec', '-T', primary_service(command), 'psql', '-U', 'postgres',
        '-d', database, '-Atc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"], text=True).strip()
    if tables != '0':
        raise SystemExit('reconstruction database is not empty; preserve it and use a new rehearsal database')
    command += ['-f', str(deployment / 'herald.yml'), '--env-file', str(herald / 'herald.env'), '--profile', 'replay']
    run([*command, 'up', '-d', '--wait', 'herald-replay'], output / 'start.log', deployment)
    run([*command, 'logs', '--no-log-prefix', 'herald-replay'], output / 'replay.log', deployment)
    readiness = [json.loads(line) for line in (output / 'replay.log').read_text().splitlines() if line.startswith('{')]
    ready = next(entry for entry in readiness if entry.get('event') == 'herald_ready')
    if ready['checkpointBlock'] is not None or ready['metrics']['decoded_events'] == 0:
        raise RuntimeError('reconstruction did not decode history from an empty checkpoint store')
    game = str(int(read_fixture(fixture)['game'], 16))
    live, replay = snapshot(13003, game), snapshot(13004, game)
    for name, value in [('live.json', live), ('reconstructed.json', replay)]:
        (output / name).write_text(json.dumps(value, indent=2) + '\n')
    if live['models'] != replay['models']:
        raise RuntimeError('live and reconstructed row folds differ')
    run(['docker', 'inspect', 'madara-rand-herald-1', 'madara-rand-herald-replay-1'], output / 'containers.json', deployment)
    containers = json.loads((output / 'containers.json').read_text())
    if containers[0]['Id'] == containers[1]['Id'] or containers[0]['Image'] != containers[1]['Image']:
        raise RuntimeError('expected different containers running the same image')
    write_drill_report(output, {
        'scope': 'local rehearsal, not the host-independence gate; native gameplay fixture',
        'empty_reconstruction_database': True, 'equal_rows': True, 'ready': ready,
        'containers': [container['Id'] for container in containers],
    })


if __name__ == '__main__':
    main()
