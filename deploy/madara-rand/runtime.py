"""Commands confined to the isolated rehearsal project and its release digest."""

import json
import os
import subprocess


def read_release(release):
    manifest = json.loads((release / 'manifest.json').read_text())
    if not manifest['image'].startswith('127.0.0.1:15000/madara-rand@sha256:'):
        raise SystemExit('expected the isolated local release digest')
    if (release / 'image.env').read_text().strip() != f'MADARA_IMAGE={manifest["image"]}':
        raise SystemExit('image environment differs from release manifest')
    return manifest


def run(command, log, directory):
    with log.open('w') as stream:
        environment = {key: value for key, value in os.environ.items()
                       if key != 'MADARA_IMAGE' and not key.startswith('RANDOMNESS_')}
        subprocess.run(command, cwd=directory, env=environment, stdout=stream, stderr=subprocess.STDOUT, check=True)


def compose(deployment, release, environment):
    return ['docker', 'compose', '-p', 'madara-rand', '-f', str(deployment / 'docker-compose.yml'),
            '-f', str(deployment / 'node.yml'), '--env-file', str(release / 'image.env'),
            '--env-file', str(environment)]
