#!/usr/bin/env python3
"""Collect the frozen workload with the same enabled node binary in all placements."""

import json
from pathlib import Path
import sys
import subprocess
import time
from runtime import compose, read_release, run, running_journal_hosts
from placement import configure_placement


def main():
    if len(sys.argv) != 5:
        raise SystemExit('usage: collect-explore-run.py RUN_DIRECTORY NODE_RELEASE EMBEDDED_HERALD_DIRECTORY SIDECAR_HERALD_DIRECTORY')
    output, release, embedded_herald, sidecar_herald = (Path(value).resolve() for value in sys.argv[1:])
    read_release(release)
    plan = json.loads((output / 'plan.json').read_text())
    deployment = Path(__file__).resolve().parent
    repository = deployment.parents[1]
    newest = max(Path(fixture['path']).stat().st_mtime for fixture in plan['fixtures'].values())
    while time.time() < newest + plan['preparationRestSeconds']:
        time.sleep(min(1, newest + plan['preparationRestSeconds'] - time.time()))
    for placement, herald in [('baseline', embedded_herald), ('embedded', embedded_herald), ('sidecar', sidecar_herald)]:
        fixture = Path(plan['fixtures']['sidecar' if placement == 'sidecar' else 'embedded']['path']).parent
        preparation = output / f'{placement}-preparation'
        preparation.mkdir(exist_ok=False)
        running_journal_hosts()
        configure_placement('embedded' if placement == 'embedded' else 'sidecar', deployment, release, fixture, preparation)
        command = compose(deployment, release, fixture / 'service.env')
        if placement == 'baseline':
            run([*command, 'stop', 'randomness-sidecar'], preparation / 'stop-idle-worker.log', deployment)
        readers = [*command, '-f', str(deployment / 'herald.yml'), '--env-file', str(herald / 'herald.env')]
        run([*readers, 'up', '-d', '--wait', 'herald'], preparation / 'herald.log', deployment)
        # A previous replay reader is not part of the measured live-delivery workload.
        run([*readers, '--profile', 'replay', 'stop', 'herald-replay'], preparation / 'stop-replay.log', deployment)
        run([*command, 'config', '--format', 'json'], preparation / 'compose.json', deployment)
        since = str(time.time())
        with (output / f'{placement}.log').open('w') as log:
            result = subprocess.run(['bun', str(deployment / 'explore-benchmark.ts'), str(output / 'plan.json'), placement,
                                     str(output / f'{placement}.json')], cwd=repository, stdout=log, stderr=subprocess.STDOUT)
        run(['docker', 'logs', '--since', since, 'madara-rand-madara-1'], output / f'{placement}-node.log', deployment)
        if placement == 'sidecar':
            run(['docker', 'logs', '--since', since, 'madara-rand-randomness-sidecar-1'], output / 'sidecar-worker.log', deployment)
        if result.returncode:
            raise RuntimeError(f'{placement} workload failed; original samples and logs retained, no replacement draws')
        print(json.dumps({'placement': placement, 'collected': True}), flush=True)
    run(['python3', str(deployment / 'analyze-explore-run.py'), str(output)], output / 'analysis.log', deployment)


if __name__ == '__main__':
    main()
