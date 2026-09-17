#!/usr/bin/env python3
"""Kill the sidecar on either side of broadcasting one retained transaction."""

import json
from pathlib import Path
import subprocess
import sys
import threading
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from runtime import compose, read_fixture, read_release, run
from drill_runtime import chain_result, fault_proxy, journal_snapshot, write_drill_report


def capture_pending_action(command, deployment, database, fixture, mode, before, output):
    pending = journal_snapshot(command, deployment, database, output / 'pending.json')
    if pending[:-1] != before or len(pending) != len(before) + 1 or pending[-1]['status'] != 'submitted':
        raise RuntimeError('fault did not retain exactly one accepted submission')
    order = pending[-1]['ticket_order']
    observed = chain_result(fixture, pending[-1])
    deadline = time.monotonic() + 10
    while mode == 'after-broadcast' and int(observed[0], 16) == 0 and time.monotonic() < deadline:
        time.sleep(0.01)
        observed = chain_result(fixture, pending[-1])
    if (int(observed[0], 16) != 0) != (mode == 'after-broadcast'):
        raise RuntimeError('chain progress does not match the selected broadcast boundary')
    (output / 'chain-before-crash.json').write_text(json.dumps(observed) + '\n')
    return pending


def verify_recovered_action(command, deployment, database, fixture, before, pending, output):
    order = pending[-1]['ticket_order']
    deadline = time.monotonic() + 30
    after = journal_snapshot(command, deployment, database, output / 'after.json')
    while after[-1]['status'] != 'consumed' and time.monotonic() < deadline:
        time.sleep(0.05)
        after = journal_snapshot(command, deployment, database, output / 'after.json')
    if len(after) != len(pending) or after[:-1] != before or after[-1]['status'] != 'consumed':
        raise RuntimeError('recovery did not consume exactly the pending action')
    for key in ('ticket_order', 'action', 'binding', 'envelope'):
        if after[-1][key] != pending[-1][key]:
            raise RuntimeError(f'recovery changed {key}')
    result = chain_result(fixture, after[-1])
    if int(result[1], 16) != int(after[-1]['binding'], 16) or int(result[2], 16) != int(after[-1]['result'], 16):
        raise RuntimeError('recovered chain result differs from the retained journal')
    (output / 'chain-after-recovery.json').write_text(json.dumps(result) + '\n')


def main():
    if len(sys.argv) != 5 or sys.argv[3] not in ('before-broadcast', 'after-broadcast', 'promote-before-broadcast'):
        raise SystemExit('usage: submission-crash.py MADARA_RELEASE FIXTURE_DIRECTORY before-broadcast|after-broadcast|promote-before-broadcast OUTPUT_DIRECTORY')
    release, fixture_dir, output = (Path(sys.argv[index]).resolve() for index in (1, 2, 4))
    mode = sys.argv[3]
    manifest = read_release(release)
    if 'RANDOMNESS_PLACEMENT=sidecar\n' not in (fixture_dir / 'service.env').read_text():
        raise SystemExit('select the sidecar placement before the crash drill')
    fixture = read_fixture(fixture_dir)
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parents[1]
    command = compose(deployment, release, fixture_dir / 'service.env')
    database = f'randomness_execution_{fixture["fixtureId"]}'
    before = journal_snapshot(command, deployment, database, output / 'before.json')
    if any(row['status'] != 'consumed' for row in before):
        raise SystemExit('recover pending records before starting a new fault drill')
    network = json.loads(subprocess.check_output(['docker', 'network', 'inspect', 'madara-rand_default']))[0]
    gateway = network['IPAM']['Config'][0]['Gateway']
    environment = output / 'proxy.env'
    environment.write_text(f'RANDOMNESS_REHEARSAL_RPC=http://{gateway}:15052\n')
    proxy_command = [*command, '-f', str(Path(__file__).with_name('rpc-fault.yml')), '--env-file', str(environment)]
    reached, released = threading.Event(), threading.Event()
    server = fault_proxy(gateway, 'after-broadcast' if mode == 'after-broadcast' else 'before-broadcast', output, reached, released)
    child = None
    try:
        run([*proxy_command, '--profile', 'sidecar', 'up', '-d', '--no-deps', 'randomness-sidecar'],
            output / 'proxy-start.log', deployment)
        time.sleep(1)
        with (output / 'client.log').open('w') as log:
            child = subprocess.Popen(['bun', 'deploy/madara-rand/exercise-fixture.ts', str(fixture_dir / 'fixture.json'),
                str(output / 'client-result.json'), 'sidecar'], cwd=deployment.parents[1], stdout=log, stderr=subprocess.STDOUT)
        if not reached.wait(30):
            raise RuntimeError('worker did not reach the selected broadcast boundary')
        pending = capture_pending_action(command, deployment, database, fixture, mode, before, output)
        order = pending[-1]['ticket_order']
        run([*command, 'kill', '-s', 'SIGKILL', 'randomness-sidecar'], output / 'kill.log', deployment)
        child.wait(timeout=35)
        released.set()
        server.shutdown()
        if mode == 'promote-before-broadcast':
            run([sys.executable, str(Path(__file__).with_name('promote.py')), str(release), str(fixture_dir),
                 str(output / 'submitted-transaction.json'), str(output / 'promotion')], output / 'promotion.log', deployment)
            command = compose(deployment, release, fixture_dir / 'service.env')
        run([*command, '--profile', 'sidecar', 'up', '-d', '--no-deps', 'randomness-sidecar'],
            output / 'recover.log', deployment)
        verify_recovered_action(command, deployment, database, fixture, before, pending, output)
        run([*command, 'logs', '--no-log-prefix', 'randomness-sidecar'], output / 'worker.log', deployment)
        run([*command, 'logs', '--no-log-prefix', 'madara'], output / 'node.log', deployment)
        write_drill_report(output, {
            'scope': 'local rehearsal, not the host-independence gate; native gameplay deployment',
            'mode': mode, 'image': manifest['image'], 'order': order, 'original_binding_consumed': True,
        })
    finally:
        if child is not None and child.poll() is None:
            child.terminate()
            child.wait(timeout=5)
        released.set()
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
