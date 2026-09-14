#!/usr/bin/env python3
"""Exercise both placements on one retained native deployment and journal."""

import hashlib
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
from runtime import compose, read_release, run
from placement import configure_placement, wait_for_admission


def exercise(placement, deployment, release, fixture, output):
    configure_placement(placement, deployment, release, fixture, output)
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
    disabled_preparation = output / 'disabled-preparation'
    disabled_preparation.mkdir()
    configure_placement('sidecar', deployment, release, fixture, disabled_preparation)
    command = compose(deployment, release, fixture / 'service.env')
    run([*command, '-f', str(deployment / 'baseline.yml'), 'up', '-d', '--wait', 'madara'],
        output / 'disabled-start-node.log', deployment)
    verify_results(fixture_manifest, results)
    run(['bun', 'deploy/madara-rand/exercise-fixture.ts', str(fixture / 'fixture.json'),
         str(output / 'disabled-explore.json'), 'sidecar'], output / 'disabled-explore.log', deployment.parents[1])
    disabled = json.loads((output / 'disabled-explore.json').read_text())
    if int(disabled['order'], 16) != orders[-1] + 1:
        raise RuntimeError('feature-disabled explore changed ticket order')
    results.append(disabled)
    orders.append(int(disabled['order'], 16))
    try:
        urllib.request.urlopen('http://127.0.0.1:15080/actions', timeout=1).close()
        raise RuntimeError('disabled node unexpectedly runs admission')
    except urllib.error.HTTPError:
        raise RuntimeError('disabled node unexpectedly serves admission HTTP')
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        pass
    run([*command, 'up', '-d', '--wait', 'madara'], output / 'enabled-restore-node.log', deployment)
    wait_for_admission(15081)
    verify_results(fixture_manifest, results)
    report = {'schema': 1, 'scope': 'local rehearsal, not the host-independence gate; native gameplay deployment',
              'image': manifest['image'], 'patch_revision': manifest['patch_revision'],
              'fixture': fixture_manifest, 'disabled_and_restored_results_match': True, 'feature_disabled_explore_executed': True,
              'orders': orders, 'duplicates_per_action': 16, 'passed': True,
              'artifacts': {str(path.relative_to(output)): hashlib.sha256(path.read_bytes()).hexdigest()
                            for path in sorted(output.rglob('*')) if path.is_file()}}
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(output / 'report.json'), 'passed': True}))


if __name__ == '__main__':
    main()
