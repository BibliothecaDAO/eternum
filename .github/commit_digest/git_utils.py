from __future__ import annotations

import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List


@dataclass
class Commit:
    sha: str
    short_sha: str
    author: str
    author_email: str
    authored_at: datetime
    title: str
    body: str
    files: List[str]


class GitExecutionError(RuntimeError):
    pass


def _run_git(args: Iterable[str], *, repo: Path) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise GitExecutionError(result.stderr.strip() or "Unknown git error")
    return result.stdout.strip()


def fetch_branch(branch: str, *, repo: Path) -> None:
    _run_git(["fetch", "origin", branch, "--depth", "100"], repo=repo)


def list_commit_shas(branch: str, max_commits: int, *, repo: Path) -> List[str]:
    output = _run_git(
        ["rev-list", f"origin/{branch}", f"--max-count={max_commits}"],
        repo=repo,
    )
    shas = [line.strip() for line in output.splitlines() if line.strip()]
    return shas


def _parse_commit_meta(raw: str) -> Commit:
    sha, author, email, authored_at_raw, title, body = raw.split("\x1f", 5)
    authored_at = datetime.fromisoformat(authored_at_raw.strip())
    return Commit(
        sha=sha,
        short_sha=sha[:7],
        author=author,
        author_email=email,
        authored_at=authored_at,
        title=title.strip(),
        body=body.strip(),
        files=[],
    )


def load_commit(sha: str, *, repo: Path) -> Commit:
    meta_format = "%H\x1f%an\x1f%ae\x1f%aI\x1f%s\x1f%b"
    raw_meta = _run_git(["show", "--quiet", f"--format={meta_format}", sha], repo=repo)
    commit = _parse_commit_meta(raw_meta)

    files_raw = _run_git(["show", "--pretty=format:", "--name-only", sha], repo=repo)
    files = [line.strip() for line in files_raw.splitlines() if line.strip()]
    commit.files = files
    return commit


def collect_commits(branch: str, max_commits: int, *, repo: Path) -> List[Commit]:
    shas = list_commit_shas(branch, max_commits, repo=repo)
    commits = [load_commit(sha, repo=repo) for sha in shas]
    commits.sort(key=lambda c: c.authored_at)
    return commits


__all__ = [
    "Commit",
    "GitExecutionError",
    "fetch_branch",
    "collect_commits",
]
