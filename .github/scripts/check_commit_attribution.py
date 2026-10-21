"""Refuses commits that name an AI tool as their author, committer or co-author, or in a trailer or "Generated with"
footer. Commits in this repository carry the git user only.

Usage: check_commit_attribution.py BASE_REF HEAD checks every commit a pull request's HEAD adds to the accepted
history, and exits 1 naming each refused commit and why. The accepted history is next, and main too for a pull request
into main: those commits are on a protected branch already, so they are not judged again. Anything else HEAD carries is
judged, including commits an earlier run of this check refused. It fetches the history it compares, and exits 1 when
it cannot."""
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


def accepted_branches(base_ref: str) -> list[str]:
    return ["next", "main"] if base_ref == "main" else ["next"]


def fetch(base_ref: str, head: str) -> list[str]:
    """Fetches HEAD and the accepted branches' commits (no file contents) and names the accepted refs."""
    branches = accepted_branches(base_ref)
    shallow = subprocess.check_output(["git", "rev-parse", "--is-shallow-repository"], text=True).strip() == "true"
    refspecs = [f"+refs/heads/{branch}:refs/remotes/origin/{branch}" for branch in branches]
    deepen = ["--unshallow"] if shallow else []
    subprocess.run(
        ["git", "fetch", "--quiet", "--no-tags", "--filter=blob:none", *deepen, "origin", head, *refspecs], check=True
    )
    return [f"refs/remotes/origin/{branch}" for branch in branches]


def commits(head: str, accepted: list[str]) -> list[list[str]]:
    output = subprocess.check_output(
        ["git", "log", "-z", f"--format={'%x1f'.join(FIELDS)}", head, "--not", *accepted], text=True
    )
    return [entry.split("\x1f") for entry in output.split("\0") if entry]


def main(base_ref: str, head: str) -> int:
    try:
        added = commits(head, fetch(base_ref, head))
    except subprocess.CalledProcessError as error:
        print(f"::error title=AI attribution::cannot read the history to compare {head} with: {error}")
        return 1
    refused = 0
    for sha, *fields in added:
        for reason in refusals(*fields):
            print(f"::error title=AI attribution::{sha[:11]} carries {reason}")
            refused += 1
    return 1 if refused else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
