"""Switch placement while retaining the accepted journal and chain deployment."""

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


def configure_placement(placement, deployment, release, fixture, output):
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


if __name__ == '__main__':
    if len(sys.argv) != 5 or sys.argv[3] not in ('embedded', 'sidecar'):
        raise SystemExit('usage: placement.py RELEASE FIXTURE PLACEMENT OUTPUT')
    release, fixture, output = (Path(sys.argv[i]).resolve() for i in (1, 2, 4))
    read_release(release)
    output.mkdir(parents=True, exist_ok=False)
    configure_placement(sys.argv[3], Path(__file__).resolve().parent, release, fixture, output)
