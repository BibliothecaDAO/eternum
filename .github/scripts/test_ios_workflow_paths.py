"""The iOS app's build (.github/workflows/ios.yml) runs when any file it reads changes, on a pull request and on next.

Its inputs are read from where they are named: the shell (apps/ios), the game files the offline page script copies in
(the string literals of apps/ios/scripts/write-offline-page.mjs that name a file under apps/game/public), the media the
workflow keeps in its checkout, the local actions it uses, the install's lockfile, workspace and root manifest (the pnpm
version), and the workflow itself.
"""
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_validation_areas import local_uses, tracked

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ".github/workflows/ios.yml"
OFFLINE_PAGE_SCRIPT = "apps/ios/scripts/write-offline-page.mjs"
GAME_PUBLIC = "apps/game/public/"
INSTALL = ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"]
EVENT = re.compile(r"^  (pull_request|push):\s*$")
LIST_ITEM = re.compile(r"""^\s*- ["']?([^"']+)["']?\s*$""")
INLINE_PATHS = re.compile(r"^\s*paths:\s*\[(.*)\]\s*$")


def path_filters(text):
    """Each trigger's `paths`, as a list per event, written as a block list or inline."""
    filters, event, in_paths = {}, None, False
    for line in text.splitlines():
        if heading := EVENT.match(line):
            event, in_paths = heading[1], False
        elif event and (inline := INLINE_PATHS.match(line)):
            filters[event] = [item.strip().strip("\"'") for item in inline[1].split(",") if item.strip()]
        elif event and line.strip() == "paths:":
            in_paths, filters[event] = True, []
        elif in_paths and (item := LIST_ITEM.match(line)):
            filters[event].append(item[1])
        elif in_paths:
            in_paths = False
    return filters


def selects(pattern, path):
    """GitHub's path filter glob: `**` crosses directories, `*` and `?` do not."""
    expression = re.escape(pattern).replace(r"\*\*", ".*").replace(r"\*", "[^/]*").replace(r"\?", "[^/]")
    return re.fullmatch(expression, path) is not None


def kept_media(text):
    """The media paths the workflow's checkout keeps, listed under its `keep:` block."""
    block = re.search(r"keep: \|\n((?:\s{12}\S.*\n)+)", text)
    return [line.strip() for line in block[1].splitlines()] if block else []


def offline_page_inputs():
    """The game files the offline page script names: its string literals that are files under apps/game/public."""
    literals = re.findall(r"""["'`]/?([\w./-]+)["'`]""", (ROOT / OFFLINE_PAGE_SCRIPT).read_text())
    return sorted({f"{GAME_PUBLIC}{name}" for name in literals if f"{GAME_PUBLIC}{name}" in tracked()})


def build_inputs(text):
    shell = sorted(name for name in tracked() if name.startswith("apps/ios/"))
    actions = [target for _, target in local_uses(WORKFLOW)]
    return [WORKFLOW, *INSTALL, *shell, *offline_page_inputs(), *kept_media(text), *actions]


class IosWorkflowPathsTest(unittest.TestCase):
    def setUp(self):
        self.text = (ROOT / WORKFLOW).read_text()
        self.filters = path_filters(self.text)

    def test_reads_the_offline_page_and_its_icon(self):
        self.assertEqual(
            offline_page_inputs(), [f"{GAME_PUBLIC}images/game-pwa-192x192.png", f"{GAME_PUBLIC}offline.html"]
        )

    def test_every_input_selects_the_build_on_pull_requests_and_on_next(self):
        self.assertEqual(sorted(self.filters), ["pull_request", "push"])
        for event, patterns in self.filters.items():
            missed = [path for path in build_inputs(self.text) if not any(selects(p, path) for p in patterns)]
            self.assertEqual(missed, [], event)

    def test_both_triggers_list_the_same_paths(self):
        self.assertEqual(self.filters["pull_request"], self.filters["push"])

    def test_the_glob_reads_as_github_reads_it(self):
        self.assertTrue(selects("apps/ios/**", "apps/ios/ios/App/App/Info.plist"))
        self.assertFalse(selects("apps/ios/*", "apps/ios/ios/App/App/Info.plist"))
        self.assertFalse(selects("package.json", "apps/ios/package.json"))


if __name__ == "__main__":
    unittest.main()
