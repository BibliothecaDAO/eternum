"""check_commit_attribution.py refuses AI authorship and trailers in the commits a pull request adds to next (and main),
and passes plain commits. Each case pushes to a bare origin and checks from a one-commit shallow clone, as the scope
job's checkout leaves it."""
import os
import re
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO

sys.path.insert(0, os.path.dirname(__file__))
from check_commit_attribution import main  # noqa: E402

PERSON = ("djizus", "dev@example.test")
TRAILER = "Co-Authored-By: Claude Opus <noreply@anthropic.com>"
WORKFLOW = os.path.join(os.path.dirname(__file__), "..", "workflows", "validation.yml")


class CommitAttribution(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = self.directory.name
        self.origin = os.path.join(root, "origin.git")
        self.author = os.path.join(root, "author")
        self.run_git(root, "init", "-q", "--bare", "-b", "next", self.origin)
        self.run_git(self.origin, "config", "uploadpack.allowFilter", "true")
        self.run_git(self.origin, "config", "uploadpack.allowAnySHA1InWant", "true")
        self.run_git(root, "init", "-q", "-b", "next", self.author)
        self.git("remote", "add", "origin", self.origin)
        self.base = self.commit("Start the history")
        self.push("next", "main")

    @staticmethod
    def run_git(cwd: str, *args: str, author=PERSON, committer=PERSON) -> str:
        env = {
            **os.environ,
            "GIT_AUTHOR_NAME": author[0],
            "GIT_AUTHOR_EMAIL": author[1],
            "GIT_COMMITTER_NAME": committer[0],
            "GIT_COMMITTER_EMAIL": committer[1],
        }
        return subprocess.check_output(["git", *args], cwd=cwd, env=env, text=True, stderr=subprocess.DEVNULL).strip()

    def git(self, *args: str, **people) -> str:
        return self.run_git(self.author, *args, **people)

    def commit(self, message: str, **people) -> str:
        self.git("commit", "-q", "--allow-empty", "-m", message, **people)
        return self.git("rev-parse", "HEAD")

    def push(self, *branches: str):
        for branch in branches:
            self.git("push", "-q", "--force", "origin", f"HEAD:refs/heads/{branch}")

    def check(self, base_ref: str) -> tuple[int, str]:
        """Pushes the author's HEAD as the pull request's head and checks it from a fresh scope-job checkout."""
        head = self.git("rev-parse", "HEAD")
        self.git("push", "-q", "--force", "origin", f"{head}:refs/pull/1/head")
        checkout = tempfile.mkdtemp(dir=self.directory.name)
        self.run_git(checkout, "clone", "-q", "--depth", "1", "--filter=blob:none", f"file://{self.origin}", ".")
        output = StringIO()
        cwd = os.getcwd()
        os.chdir(checkout)
        try:
            with redirect_stdout(output):
                code = main(base_ref, head)
        finally:
            os.chdir(cwd)
        return code, output.getvalue()

    @staticmethod
    def refused(output: str) -> list[str]:
        return sorted(set(re.findall(r"([0-9a-f]{11}) carries", output)))

    def test_passes_commits_that_carry_the_git_user_only(self):
        self.commit("Forward the audit anchor\n\nFixes: the monitor rewound to block 0 on every tick.")
        self.assertEqual(self.check("next"), (0, ""))

    def test_does_not_judge_again_the_commits_already_on_next(self):
        # next carries a commit from before the rule. A pull request from next into main adds nothing new.
        self.commit(f"Old work\n\n{TRAILER}")
        self.push("next")
        self.assertEqual(self.check("main"), (0, ""))
        self.commit("New plain work")
        self.assertEqual(self.check("next"), (0, ""))

    def test_still_refuses_a_refused_commit_after_a_clean_push(self):
        # The first run refuses the attributed commit; a plain commit pushed on top must not make the pull request pass.
        for base_ref in ("next", "main"):
            with self.subTest(base_ref):
                self.git("reset", "-q", "--hard", self.base)
                attributed = self.commit(f"New work\n\n{TRAILER}")
                self.assertEqual(self.refused(self.check(base_ref)[1]), [attributed[:11]])
                self.commit("Plain follow-up")
                code, output = self.check(base_ref)
                self.assertEqual(code, 1)
                self.assertEqual(self.refused(output), [attributed[:11]])

    def test_accepts_main_history_only_for_a_pull_request_into_main(self):
        on_main = self.commit(f"Release fix on main\n\n{TRAILER}")
        self.push("main")
        self.commit("Plain hotfix")
        self.assertEqual(self.check("main"), (0, ""))
        code, output = self.check("next")
        self.assertEqual(code, 1)
        self.assertEqual(self.refused(output), [on_main[:11]])

    def test_fails_when_the_accepted_history_cannot_be_read(self):
        self.git("push", "-q", "origin", "--delete", "main")
        self.commit("Plain work")
        code, output = self.check("main")
        self.assertEqual(code, 1)
        self.assertIn("cannot read the history", output)

    def test_refuses_each_kind_of_ai_attribution(self):
        cases = {
            "author": dict(message="Plain message", author=("Claude", "noreply@anthropic.com")),
            "committer": dict(message="Plain message", committer=("Codex", "codex@openai.com")),
            "trailer Co-Authored-By": dict(message=f"Plain\n\n{TRAILER}"),
            "trailer Claude-Session": dict(message="Plain\n\nClaude-Session: https://claude.ai/code/session_x"),
            "footer": dict(message="Plain\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"),
        }
        for kind, case in cases.items():
            with self.subTest(kind):
                self.git("reset", "-q", "--hard", self.base)
                message = case.pop("message")
                sha = self.commit(message, **case)
                code, output = self.check("next")
                self.assertEqual(code, 1)
                self.assertIn(f"{sha[:11]} carries {kind}", output)

    def test_runs_on_every_pull_request_event_whatever_file_scoping_found(self):
        # A reopened pull request, a follow-up push and a pull request whose base could not be resolved are all checked:
        # the step depends on no event action and no other step's output.
        with open(WORKFLOW) as workflow:
            text = workflow.read()
        lines = text[text.index("- name: Refuse AI authorship and trailers in the commits a pull request adds") :].splitlines()
        # The step ends where a line is indented no deeper than its own "- name:".
        end = next(i for i, line in enumerate(lines[1:], 1) if line.strip() and len(line) - len(line.lstrip()) <= 6)
        step = "\n" + "\n".join(lines[:end]) + "\n"
        self.assertIn("\n        if: github.event_name == 'pull_request'\n", step)
        self.assertIn('check_commit_attribution.py "$BASE_REF" "$HEAD_SHA"', step)
        for dependency in ("github.event.action", "github.event.before", "steps."):
            self.assertNotIn(dependency, step)


if __name__ == "__main__":
    unittest.main()
