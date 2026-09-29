#!/usr/bin/env python3
"""Fails when a validation area's own files read a path the area does not cover, naming each miss.

A stream push or pull request runs only the areas its diff selects, so an area must cover every file its code and tests
read: otherwise a change to that file skips the checks that read it and first shows on the integration branch. The
reads found are relative module specifiers and relative path literals (fixtures opened with `new URL(..., import.meta
.url)`), resolved from the file that names them.
"""
from functools import cache
import os
from pathlib import Path
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validation_areas import AREAS, ENTRIES, SHARED, UNCHECKED, matches

ROOT = Path(__file__).resolve().parents[2]
SOURCES = (".ts", ".tsx", ".js", ".mjs", ".cjs")
# A quoted relative path, and a following `$` when it is a template literal cut at its first substitution: that prefix
# reads the directory it names, while a whole literal naming a directory only anchors other paths.
RELATIVE = re.compile(r"""["'`](\.\.?/[^"'`\s$]*)(\$?)""")
# Extensionless and compiled-extension specifiers resolve to the source file beside them.
CANDIDATES = ("", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js")


@cache
def tracked():
    return frozenset(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")) - {""}


@cache
def tracked_directories():
    return frozenset(str(parent) for name in tracked() for parent in Path(name).parents)


@cache
def reads(name):
    """The repository paths a source file reads through relative references; directories end with /."""
    text = (ROOT / name).read_text(errors="replace")
    found = set()
    for reference, substitution in RELATIVE.findall(text):
        target = resolve(Path(name).parent, reference)
        if target and (substitution or not target.endswith("/")):
            found.add(target)
    return found


# Only tracked paths count: a build output a checkout does not have is not a read CI can see. A reference to one of
# the reader's own ancestors, such as the repository root, anchors other paths rather than reading one.
def resolve(directory, reference):
    base = Path(os.path.normpath(directory / reference))
    if base.parts[:1] == ("..",) or base == directory or base in directory.parents:
        return None
    stem = base.with_suffix("") if base.suffix in (".js", ".mjs") else base
    for candidate in [f"{base}{ending}" for ending in CANDIDATES] + [f"{stem}{ending}" for ending in CANDIDATES]:
        if candidate in tracked():
            return candidate
    if str(base) in tracked_directories():
        return f"{base}/"
    return None


def misses(sources):
    """Each (area, reader, read path) where the code an area's checks run reads a path outside that area."""
    found = []
    for area, patterns in AREAS.items():
        if area in UNCHECKED:
            continue
        covered = SHARED + patterns
        entries = ENTRIES.get(area) or [name for name in sources if matches(name, patterns)]
        found += [(area, reader, path) for reader, path in reachable_reads(entries) if not matches(path, covered)]
    return found


def reachable_reads(entries):
    """Every (reader, read path) reachable from the entries, following reads into source files wherever they lie."""
    pending, seen, found = list(entries), set(entries), []
    while pending:
        reader = pending.pop()
        for path in sorted(reads(reader)):
            found.append((reader, path))
            if path.endswith(SOURCES) and path not in seen:
                seen.add(path)
                pending.append(path)
    return found


def main():
    found = misses(sorted(name for name in tracked() if name.endswith(SOURCES)))
    for area, reader, path in found:
        print(f"{area}: {reader} reads {path}, which the area does not cover", file=sys.stderr)
    if found:
        raise SystemExit(f"{len(found)} reads fall outside their validation area; widen the area in validation_areas.py")
    print(f"validation areas: each of {len(AREAS) - len(UNCHECKED)} areas covers every file its checks read")


if __name__ == "__main__":
    main()
