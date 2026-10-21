#!/usr/bin/env python3
"""Fails when a validation area's own files read a path the area does not cover, or a CI file has the wrong owner,
naming each miss.

A pull request runs only the areas its diff selects, so an area must cover every file its code and tests read:
otherwise a change to that file skips the checks that read it and first shows on next. The
reads found are relative module specifiers and relative path literals (fixtures opened with `new URL(..., import.meta
.url)`), resolved from the file that names them. An area's checks also run the files its workflows' commands name,
directly or through a package.json script, so those files and their reads count too.

Every tracked file under .github must have an owner (an area, STATIC or SHARED), and a local workflow or action must
belong to the area that runs it: the area whose validation.yml job calls it, or each owner of the workflow using it.
"""
from functools import cache
import fnmatch
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validation_areas import AREAS, SHARED, STATIC, UNCHECKED, matches, unowned_ci_files

ROOT = Path(__file__).resolve().parents[2]
SOURCES = (".ts", ".tsx", ".js", ".mjs", ".cjs")
# A quoted relative path, and a following `$` when it is a template literal cut at its first substitution: that prefix
# reads the directory it names, while a whole literal naming a directory only anchors other paths.
# A job key in a workflow's jobs map, and a local reusable workflow or composite action that a job or step uses.
JOB = re.compile(r"^  ([\w-]+):\s*$")
LOCAL_USE = re.compile(r"^\s*(?:- )?uses:\s*\./(\.github/(?:workflows/[\w.-]+\.ya?ml|actions/[\w.-]+))\s*$")
RELATIVE = re.compile(r"""["'`](\.\.?/[^"'`\s$]*)(\$?)""")
# Programs whose path arguments name the files a command runs.
RUNNERS = {"node", "bun", "python3", "python", "bash", "sh", "tsx"}
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


def steps(workflow_text):
    """Each (working directory, command text) of a workflow's run steps."""
    found, directory, block, indent = [], ".", None, 0
    for line in workflow_text.splitlines():
        stripped = line.strip()
        if block is not None:
            if stripped and len(line) - len(line.lstrip()) <= indent:
                found.append((directory, "\n".join(block)))
                block = None
            else:
                block.append(stripped)
                continue
        if stripped.startswith("- "):
            directory = "."
            stripped = stripped[2:]
        if stripped.startswith("working-directory:"):
            directory = stripped.split(":", 1)[1].strip()
        elif stripped.startswith("run:"):
            command = stripped[4:].strip()
            if command in ("|", ">-", ">", "|-"):
                block, indent = [], len(line) - len(line.lstrip())
            else:
                found.append((directory, command))
    if block is not None:
        found.append((directory, "\n".join(block)))
    return found


def package_scripts(directory):
    path = ROOT / directory / "package.json"
    return json.loads(path.read_text()).get("scripts", {}) if path.is_file() else {}


def ran_files(directory, command, scripts_of=package_scripts, depth=0):
    """The tracked files a shell command runs from a directory, following pnpm scripts into their package.json."""
    found = set()
    for simple in re.split(r"&&|\|\||;|\||\n", command):
        try:
            words = shlex.split(simple)
        except ValueError:
            continue
        while words and re.fullmatch(r"\w+=.*", words[0]):
            words = words[1:]
        if not words:
            continue
        if words[0] == "cd" and len(words) > 1:
            directory = os.path.normpath(os.path.join(directory, words[1]))
        elif words[0] == "npx":
            # npx [flags] pnpm@<version> ... runs that pnpm like a pnpm on PATH.
            rest = [word for word in words[1:] if not word.startswith("-")]
            if rest and re.fullmatch(r"pnpm(@\S+)?", rest[0]) and depth < 5:
                found |= pnpm_ran(directory, rest[1:], scripts_of, depth)
        elif words[0] == "pnpm" and depth < 5:
            found |= pnpm_ran(directory, words[1:], scripts_of, depth)
        elif words[0] in RUNNERS:
            for word in words[1:]:
                found |= tracked_matches(os.path.normpath(os.path.join(directory, word)))
    return found


def pnpm_ran(directory, arguments, scripts_of, depth):
    """What a pnpm invocation runs when it names a script of the package at its --dir."""
    while arguments[:1] and arguments[0] in ("--dir", "-C"):
        directory, arguments = os.path.normpath(os.path.join(directory, arguments[1])), arguments[2:]
    if arguments[:1] == ["run"]:
        arguments = arguments[1:]
    script = scripts_of(directory).get(arguments[0]) if arguments else None
    return ran_files(directory, script, scripts_of, depth + 1) if script else set()


def tracked_matches(path):
    """A tracked file a path or glob argument names; directories and flags name none."""
    if any(character in path for character in "*?["):
        return {name for name in tracked() if fnmatch.fnmatch(name, path)}
    return {path} if path in tracked() else set()


def workflow_runs(area):
    """Each (workflow, file) the area's own workflows run."""
    return {
        (workflow, path)
        for workflow in sorted(name for name in tracked() if name.startswith(".github/workflows/"))
        if area in owners(workflow)
        for directory, command in steps((ROOT / workflow).read_text())
        for path in ran_files(directory, command)
    }


def misses(sources):
    """Each (area, reader, read path) where the code an area's checks run reads a path outside that area."""
    found = []
    for area, patterns in AREAS.items():
        if area in UNCHECKED:
            continue
        covered = SHARED + patterns
        runs = workflow_runs(area)
        found += [(area, workflow, path) for workflow, path in sorted(runs) if not matches(path, covered)]
        entries = [name for name in sources if matches(name, patterns)] + sorted({path for _, path in runs})
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


def owners(path):
    """The areas whose patterns name a path, plus "static" when STATIC does."""
    found = {area for area, patterns in AREAS.items() if matches(path, patterns)}
    return found | {"static"} if matches(path, STATIC) else found


def local_uses(workflow):
    """Each (job key, local workflow or action path) a workflow uses."""
    job, found = None, []
    for line in (ROOT / workflow).read_text().splitlines():
        if heading := JOB.match(line):
            job = heading[1]
        elif use := LOCAL_USE.match(line):
            target = use[1] if use[1].startswith(".github/workflows/") else f"{use[1]}/action.yml"
            found.append((job, target))
    return found


def ownership_misses():
    """Each CI file no area owns, and each local workflow or action whose owners leave out an area that runs it."""
    unowned = unowned_ci_files(sorted(tracked()))
    found = [f"{path} has no owner: name it in an area, STATIC or SHARED" for path in unowned]
    for workflow in sorted(name for name in tracked() if name.startswith(".github/workflows/")):
        for job, target in local_uses(workflow):
            # validation.yml's jobs are named for the areas they run; any other workflow runs for its own owners.
            runners = {job} if workflow == ".github/workflows/validation.yml" else owners(workflow)
            if missing := runners - owners(target):
                found.append(f"{target} runs for {', '.join(sorted(missing))} (from {workflow}) but is not owned by it")
    return found


def main():
    found = misses(sorted(name for name in tracked() if name.endswith(SOURCES)))
    for area, reader, path in found:
        print(f"{area}: {reader} reads {path}, which the area does not cover", file=sys.stderr)
    if found:
        raise SystemExit(f"{len(found)} reads fall outside their validation area; widen the area in validation_areas.py")
    print(f"validation areas: each of {len(AREAS) - len(UNCHECKED)} areas covers every file its checks read")
    ownership = ownership_misses()
    for miss in ownership:
        print(miss, file=sys.stderr)
    if ownership:
        raise SystemExit(f"{len(ownership)} CI files are unowned or owned by the wrong area; fix validation_areas.py")
    print("validation areas: every CI file belongs to the area that runs it")


if __name__ == "__main__":
    main()
