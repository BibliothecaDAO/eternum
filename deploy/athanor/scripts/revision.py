"""One deployment revision: the clean checkout, pushed to origin; production also passed landing validation."""
import json
from pathlib import Path
import subprocess
import sys
from urllib.request import Request, urlopen

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
        require_landing_run(revision)
    return revision


def require_landing_run(revision):
    url = ("https://api.github.com/repos/BibliothecaDAO/eternum/actions/workflows/validation.yml/runs"
           f"?event=push&branch=next&head_sha={revision}&per_page=100")
    try:
        with urlopen(Request(url, headers={"User-Agent": "realms-deployment/1"}), timeout=30) as response:
            runs = json.load(response)["workflow_runs"]
    except (OSError, ValueError, KeyError):
        raise RevisionRefused("Production validation status is unavailable; nothing was deployed.") from None
    landing = [run for run in runs if run["head_sha"] == revision and run["event"] == "push"
               and run["head_branch"] == "next"]
    if any(run["conclusion"] == "success" for run in landing):
        return
    cancelled = next((run for run in landing if run["conclusion"] == "cancelled"), None)
    if cancelled:
        raise RevisionRefused(f"Production validation was cancelled; rerun gh run rerun {int(cancelled['id'])} "
                              "after newer merges finish, or deploy the newest green next commit.")
    raise RevisionRefused("Production requires a successful validation push run on next for this exact commit.")


if __name__ == '__main__':
    try:
        print(json.dumps({'revision': deployment_revision(sys.argv[1])}))
    except RevisionRefused as error:
        print(json.dumps({'error': str(error)}))
        raise SystemExit(1)
