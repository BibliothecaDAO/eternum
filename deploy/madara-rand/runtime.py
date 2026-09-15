"""Commands confined to the isolated rehearsal project and its release digest."""

import json
import os
import re
import subprocess
from pathlib import Path


def read_fixture(directory):
    manifest = json.loads((directory / 'fixture.json').read_text())
    if manifest['rpc'] != 'http://127.0.0.1:15050/rpc/v0_9_0':
        raise SystemExit('expected the isolated fixture RPC')
    if not re.fullmatch(r'[1-9][0-9]{0,8}', manifest['fixtureId']):
        raise SystemExit('invalid fixture identity')
    return manifest


def service_environment(directory):
    return dict(line.split('=', 1) for line in (directory / 'service.env').read_text().splitlines() if '=' in line)


def journal_host(connection):
    match = re.search(r'(?:^| )host=(journal-(?:standby|replacement|successor|witness))(?: |$)', connection)
    if not match:
        raise RuntimeError('unsupported isolated journal host')
    return match.group(1)


def read_release(release):
    manifest = json.loads((release / 'manifest.json').read_text())
    if not manifest['image'].startswith('127.0.0.1:15000/madara-rand@sha256:'):
        raise SystemExit('expected the isolated local release digest')
    if (release / 'image.env').read_text().strip() != f'MADARA_IMAGE={manifest["image"]}':
        raise SystemExit('image environment differs from release manifest')
    return manifest


def run(command, log, directory, input_text=None):
    with log.open('w') as stream:
        environment = {key: value for key, value in os.environ.items()
                       if key != 'MADARA_IMAGE' and not key.startswith(('RANDOMNESS_', 'HERALD_'))}
        subprocess.run(command, cwd=directory, env=environment, stdout=stream, stderr=subprocess.STDOUT, check=True, input=input_text, text=input_text is not None)


def compose(deployment, release, environment):
    command = ['docker', 'compose', '-p', 'madara-rand', '-f', str(deployment / 'docker-compose.yml'),
            '-f', str(deployment / 'node.yml'), '-f', str(deployment / 'drills/promotion.yml'), '--env-file', str(release / 'image.env'),
            '--env-file', str(environment)]

    if primary_service(command) in ('journal-replacement', 'journal-successor'):
        command += ['-f', str(deployment / 'drills/promotion-next.yml')]
    if primary_service(command) == 'journal-successor':
        command += ['-f', str(deployment / 'drills/promotion-final.yml')]
    return command


def primary_service(command):
    for index, value in enumerate(command):
        if value != '--env-file':
            continue
        for line in Path(command[index + 1]).read_text().splitlines():
            if line.startswith('RANDOMNESS_JOURNAL_PRIMARY=host='):
                host = line.split('host=', 1)[1].split()[0]
                if host not in ('journal-standby', 'journal-replacement', 'journal-successor'):
                    raise RuntimeError('unsupported current journal primary')
                return host
    raise RuntimeError('journal primary is not declared in the service environment')


def running_journal_hosts():
    container = json.loads(subprocess.check_output(['docker', 'inspect', 'madara-rand-madara-1']))[0]
    values = dict(line.split('=', 1) for line in container['Config']['Env'] if '=' in line)
    primary = re.search(r'(?:^| )host=([^ ]+)', values['RANDOMNESS_JOURNAL_PRIMARY']).group(1)
    witness = re.search(r'(?:^| )host=([^ ]+)', values['RANDOMNESS_JOURNAL_STANDBY']).group(1)
    if (primary, witness) not in (('journal-standby', 'journal-replacement'), ('journal-replacement', 'journal-successor'), ('journal-successor', 'journal-witness')):
        raise RuntimeError('running journal topology is not a supported retained pair')
    database = re.search(r'(?:^| )dbname=([^ ]+)', values['RANDOMNESS_JOURNAL_PRIMARY']).group(1)
    progress = subprocess.check_output(['docker', 'exec', f'madara-rand-{primary}-1', 'psql', '-U', 'postgres',
        '-d', database, '-Atc', 'SELECT accepted_order=executed_order FROM randomness.stream'], text=True).strip()
    if progress != 't':
        raise RuntimeError('current deployment has pending accepted work; recover it before switching fixtures')
    return primary, witness
