#!/usr/bin/env python3
"""Withhold the synchronous witness and check logs and subscriptions before acceptance."""

import json
import os
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime import compose, read_fixture, read_release, run, service_environment, journal_host
from drill_runtime import journal_snapshot, write_drill_report


def start_observer(deployment, fixture_dir, output, gate):
    child_environment = dict(os.environ, RANDOMNESS_ADMISSION_GATE=str(gate))
    with (output / 'delivery.log').open('w') as log:
        return subprocess.Popen(['bun', 'deploy/madara-rand/check-herald.ts', str(fixture_dir / 'fixture.json'),
            'sidecar', str(output / 'delivery')], cwd=deployment.parents[1], env=child_environment,
            stdout=log, stderr=subprocess.STDOUT)


def verify_hidden_action(command, deployment, database, before, ready, output):
    during = journal_snapshot(command, deployment, database, output / 'during.json')
    if during != before:
        raise RuntimeError('an unavailable witness changed the accepted prefix')
    run(['docker', 'logs', 'madara-rand-randomness-sidecar-1'], output / 'before-commit.log', deployment)
    entries = [json.loads(line) for line in (output / 'before-commit.log').read_text().splitlines() if line.startswith('{')]
    if any(int(entry.get('fields', {}).get('action', '0'), 16) == int(ready['action'], 16) for entry in entries):
        raise RuntimeError('unaccepted action appeared in worker logs')


def verify_resumed_action(command, deployment, database, before, output, resumed_ms):
    delivery = json.loads((output / 'delivery/report.json').read_text())
    if delivery['delivery']['epoch_ms'] < resumed_ms:
        raise RuntimeError('subscription exposed an unaccepted result')
    after = journal_snapshot(command, deployment, database, output / 'after.json')
    if after[:-1] != before or len(after) != len(before) + 1 or after[-1]['status'] != 'consumed':
        raise RuntimeError('resumption did not converge on one consumed record')


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: preview-partition.py MADARA_RELEASE PROMOTED_FIXTURE_DIRECTORY OUTPUT_DIRECTORY')
    release, fixture_dir, output = (Path(value).resolve() for value in sys.argv[1:])
    read_release(release)
    environment = service_environment(fixture_dir)
    if int(environment['RANDOMNESS_EPOCH']) < 2 or environment['RANDOMNESS_PLACEMENT'] != 'sidecar':
        raise SystemExit('this drill uses the promoted sidecar and its replacement witness')
    witness = f"madara-rand-{journal_host(environment['RANDOMNESS_JOURNAL_STANDBY'])}-1"
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parents[1]
    command = compose(deployment, release, fixture_dir / 'service.env')
    fixture = read_fixture(fixture_dir)
    database = f'randomness_execution_{fixture["fixtureId"]}'
    before = journal_snapshot(command, deployment, database, output / 'before.json')
    gate = output / 'admission'
    child = start_observer(deployment, fixture_dir, output, gate)
    paused = False
    try:
        deadline = time.monotonic() + 15
        while not Path(f'{gate}.ready.json').exists() and child.poll() is None and time.monotonic() < deadline:
            time.sleep(0.01)
        ready = json.loads(Path(f'{gate}.ready.json').read_text())
        run(['docker', 'pause', witness], output / 'pause.log', deployment)
        paused = True
        Path(f'{gate}.go').touch(exist_ok=False)
        time.sleep(1)
        verify_hidden_action(command, deployment, database, before, ready, output)
        resumed_ms = time.time_ns() / 1_000_000
        run(['docker', 'unpause', witness], output / 'unpause.log', deployment)
        paused = False
        if child.wait(timeout=30) != 0:
            raise RuntimeError('partitioned action did not resume through accepted admission')
        verify_resumed_action(command, deployment, database, before, output, resumed_ms)
        write_drill_report(output, {
            'scope': 'local rehearsal, not the host-independence gate; native gameplay fixture',
            'order': ready['order'], 'witness_resumed_epoch_ms': resumed_ms, 'unaccepted_prefix_unchanged': True,
            'unaccepted_action_absent_from_logs': True, 'row_delivered_only_after_witness_resumed': True,
        })
    finally:
        if paused:
            subprocess.run(['docker', 'unpause', witness], check=True)
        if child.poll() is None:
            child.terminate()
            child.wait(timeout=5)


if __name__ == '__main__':
    main()
