"""Refuses commits that name an AI tool as their author, committer or co-author, or in a trailer or "Generated with"
footer. Commits in this repository carry the git user only.

Usage: check_commit_attribution.py AFTER HEAD checks the commits HEAD adds after AFTER (reachable from HEAD and not
from AFTER), and exits 1 naming each refused commit and why. When AFTER is not a commit this clone holds (history a
force push dropped), only HEAD itself is checked."""
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


def commits(after: str, head: str) -> list[list[str]]:
    if is_commit(after):
        added = [f"{after}..{head}"]
    else:
        print(f"::warning title=AI attribution::{after} is unknown here, so only {head} is checked")
        added = ["-1", head]
    output = subprocess.check_output(["git", "log", "-z", f"--format={'%x1f'.join(FIELDS)}", *added], text=True)
    return [entry.split("\x1f") for entry in output.split("\0") if entry]


def main(after: str, head: str) -> int:
    refused = 0
    for sha, *fields in commits(after, head):
        for reason in refusals(*fields):
            print(f"::error title=AI attribution::{sha[:11]} carries {reason}")
            refused += 1
    return 1 if refused else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
