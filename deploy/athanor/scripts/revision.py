"""One deployment revision: the clean checkout, pushed to origin; production also passed landing validation."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]


class RevisionRefused(ValueError):
    pass


def read(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True, stderr=subprocess.PIPE).strip()


def deployment_revision(environment):
    if environment not in ('dev', 'production'):
        raise RevisionRefused('Unknown deployment environment')
    if read('git', 'status', '--porcelain'):
        raise RevisionRefused('Deploy from a clean checkout; commit and push changes first.')
    revision = read('git', 'rev-parse', 'HEAD')
    read('git', 'fetch', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*')
    refs = read('git', 'for-each-ref', '--format=%(refname)', '--contains', revision, 'refs/remotes/origin/')
    if not refs:
        raise RevisionRefused('Push this checkout commit to origin before deploying.')
    if environment == 'production':
        if 'refs/remotes/origin/next' not in refs.splitlines():
            raise RevisionRefused('Production requires this checkout commit on origin/next.')
        repository = read('gh', 'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner')
        gate = subprocess.run(['bash', '.github/scripts/landing-run.sh'], cwd=ROOT,
                              env={**os.environ, 'SHA': revision, 'REPO': repository}, capture_output=True)
        if gate.returncode:
            raise RevisionRefused('Production requires a successful validation push run on next for this exact commit.')
    return revision


if __name__ == '__main__':
    try:
        print(json.dumps({'revision': deployment_revision(sys.argv[1])}))
    except RevisionRefused as error:
        print(json.dumps({'error': str(error)}))
        raise SystemExit(1)
