"""Refuses commits that name an AI tool as their author, committer or co-author, or in a trailer or "Generated with"
footer. Commits in this repository carry the git user only.

Usage: check_commit_attribution.py HEAD ACCEPTED... checks the commits HEAD adds to the accepted history (reachable
from HEAD and from no ACCEPTED commit, such as the pull request's previous head and next), and exits 1 naming each
refused commit and why. A commit already on next is accepted history, so it is never judged again. An ACCEPTED
name this clone does not hold (history a force push dropped) is skipped; when none is held, only HEAD itself is
checked."""
import re
import subprocess
import sys

AI = r"(claude|anthropic|openai|chatgpt|codex|copilot)"
IDENTITY = re.compile(AI, re.IGNORECASE)
# A trailer line ("Key: value") or a footer that names an AI tool, e.g. "Co-Authored-By: Claude ..." or
# "Claude-Session: https://...".
TRAILER = re.compile(r"^[A-Za-z][A-Za-z-]*:\s.*$", re.MULTILINE)
FOOTER = re.compile(rf"generated (with|by)\b.*{AI}", re.IGNORECASE)

FIELDS = ["%H", "%an", "%ae", "%cn", "%ce", "%B"]


def refusals(name: str, email: str, committer: str, committer_email: str, message: str) -> list[str]:
    """Why one commit is refused, or nothing."""
    found = []
    if IDENTITY.search(f"{name} {email}"):
        found.append(f"author {name} <{email}>")
    if IDENTITY.search(f"{committer} {committer_email}"):
        found.append(f"committer {committer} <{committer_email}>")
    for line in TRAILER.findall(message):
        if IDENTITY.search(line):
            found.append(f"trailer {line.strip()[:80]}")
    for line in message.splitlines():
        if FOOTER.search(line):
            found.append(f"footer {line.strip()[:80]}")
    return found


def is_commit(name: str) -> bool:
    return subprocess.run(["git", "cat-file", "-e", f"{name}^{{commit}}"], capture_output=True).returncode == 0


def commits(head: str, accepted: list[str]) -> list[list[str]]:
    for name in accepted:
        if not is_commit(name):
            print(f"::warning title=AI attribution::{name} is unknown here, so it is not excluded")
    known = [name for name in accepted if is_commit(name)]
    if known:
        added = [head, "--not", *known]
    else:
        print(f"::warning title=AI attribution::no accepted commit is known here, so only {head} is checked")
        added = ["-1", head]
    output = subprocess.check_output(["git", "log", "-z", f"--format={'%x1f'.join(FIELDS)}", *added], text=True)
    return [entry.split("\x1f") for entry in output.split("\0") if entry]


def main(head: str, *accepted: str) -> int:
    refused = 0
    for sha, *fields in commits(head, list(accepted)):
        for reason in refusals(*fields):
            print(f"::error title=AI attribution::{sha[:11]} carries {reason}")
            refused += 1
    return 1 if refused else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:]))
