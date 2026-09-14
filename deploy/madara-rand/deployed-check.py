#!/usr/bin/env python3
"""Exercise both placements on one retained deployed stub and journal."""

import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request
from runtime import compose, read_release, run


def wait_for_admission(port):
    deadline = time.monotonic() + 30
    request = urllib.request.Request(f'http://127.0.0.1:{port}/actions', data=b'{"intent":[],"r":"0x1","s":"0x1"}',
                                     headers={'content-type': 'application/json'})
    while time.monotonic() < deadline:
        try:
            urllib.request.urlopen(request, timeout=1).close()
            raise RuntimeError('malformed admission unexpectedly succeeded')
        except urllib.error.HTTPError as error:
            if error.code == 400:
                return
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(0.1)
    raise RuntimeError('admission did not become ready after prefix recovery')


def exercise(placement, deployment, release, fixture, output):
    environment = fixture / 'service.env'
    command = compose(deployment, release, environment)
    run([*command, 'stop', 'randomness-sidecar'], output / f'{placement}-stop-sidecar.log', deployment)
    values = environment.read_text().splitlines()
    if sum(line.startswith('RANDOMNESS_PLACEMENT=') for line in values) != 1:
        raise RuntimeError('fixture must declare one placement')
    environment.write_text('\n'.join(f'RANDOMNESS_PLACEMENT={placement}' if line.startswith('RANDOMNESS_PLACEMENT=')
                                     else line for line in values) + '\n')
    run([*command, 'up', '-d', '--wait', 'madara'], output / f'{placement}-start-node.log', deployment)
    if placement == 'sidecar':
        run([*command, '--profile', 'sidecar', 'up', '-d', 'randomness-sidecar'],
            output / 'sidecar-start-worker.log', deployment)
    wait_for_admission(15081 if placement == 'sidecar' else 15080)
    for index in range(8):
        run(['bun', 'deploy/madara-rand/exercise-fixture.ts', str(fixture / 'fixture.json'),
             str(output / f'{placement}-{index}.json'), placement],
            output / f'{placement}-{index}.log', deployment.parents[1])


def verify_results(fixture, results):
    for result in results:
        payload = {'jsonrpc': '2.0', 'id': 1, 'method': 'starknet_call', 'params': {
            'block_id': 'pre_confirmed', 'request': {'contract_address': fixture['execution']['address'],
                'entry_point_selector': result['result_selector'], 'calldata': [result['order']]}}}
        request = urllib.request.Request(fixture['rpc'], data=json.dumps(payload).encode(),
                                         headers={'content-type': 'application/json'})
        with urllib.request.urlopen(request, timeout=5) as response:
            observed = json.load(response)
        if observed.get('result') != result['result']:
            raise RuntimeError('recorded result changed across node configurations')


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: deployed-check.py RELEASE_DIRECTORY FIXTURE_DIRECTORY OUTPUT_DIRECTORY')
    release, fixture, output = (Path(argument).resolve() for argument in sys.argv[1:])
    manifest = read_release(release)
    output.mkdir(parents=True, exist_ok=False)
    deployment = Path(__file__).resolve().parent
    for placement in ('sidecar', 'embedded'):
        exercise(placement, deployment, release, fixture, output)
    results = [json.loads(path.read_text()) for path in sorted(output.glob('sidecar-*.json'))]
    results += [json.loads(path.read_text()) for path in sorted(output.glob('embedded-*.json'))]
    orders = [int(result['order'], 16) for result in results]
    if orders != list(range(orders[0], orders[0] + 16)):
        raise RuntimeError('ticket order did not survive placement switch')
    fixture_manifest = json.loads((fixture / 'fixture.json').read_text())
    command = compose(deployment, release, fixture / 'service.env')
    run([*command, '-f', str(deployment / 'baseline.yml'), 'up', '-d', '--wait', 'madara'],
        output / 'disabled-start-node.log', deployment)
    verify_results(fixture_manifest, results)
    try:
        urllib.request.urlopen('http://127.0.0.1:15080/actions', timeout=1).close()
        raise RuntimeError('disabled node unexpectedly runs admission')
    except urllib.error.HTTPError:
        raise RuntimeError('disabled node unexpectedly serves admission HTTP')
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        pass
    run([*command, 'up', '-d', '--wait', 'madara'], output / 'enabled-restore-node.log', deployment)
    wait_for_admission(15080)
    verify_results(fixture_manifest, results)
    report = {'schema': 1, 'scope': 'local rehearsal, not the host-independence gate; deployed conformance stub only',
              'image': manifest['image'], 'patch_revision': manifest['patch_revision'],
              'fixture': fixture_manifest, 'disabled_and_restored_results_match': True,
              'orders': orders, 'duplicates_per_action': 16, 'passed': True,
              'artifacts': {path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                            for path in sorted(output.iterdir()) if path.is_file()}}
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(output / 'report.json'), 'passed': True}))


if __name__ == '__main__':
    main()
