"""check_commit_attribution.py refuses AI authorship and trailers in a commit range, and passes plain commits."""
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO

sys.path.insert(0, os.path.dirname(__file__))
from check_commit_attribution import main  # noqa: E402

PERSON = ("djizus", "dev@example.test")


class CommitAttribution(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.git("init", "-q")
        self.base = self.commit("Start the history")

    def git(self, *args: str, author=PERSON, committer=PERSON) -> str:
        env = {
            **os.environ,
            "GIT_AUTHOR_NAME": author[0],
            "GIT_AUTHOR_EMAIL": author[1],
            "GIT_COMMITTER_NAME": committer[0],
            "GIT_COMMITTER_EMAIL": committer[1],
        }
        return subprocess.check_output(["git", *args], cwd=self.directory.name, env=env, text=True).strip()

    def commit(self, message: str, **people) -> str:
        self.git("commit", "-q", "--allow-empty", "-m", message, **people)
        return self.git("rev-parse", "HEAD")

    def check(self, after=None) -> tuple[int, str]:
        output = StringIO()
        cwd = os.getcwd()
        os.chdir(self.directory.name)
        try:
            with redirect_stdout(output):
                code = main(after or self.base, "HEAD")
        finally:
            os.chdir(cwd)
        return code, output.getvalue()

    def test_passes_commits_that_carry_the_git_user_only(self):
        self.commit("Forward the audit anchor\n\nFixes: the monitor rewound to block 0 on every tick.")
        self.assertEqual(self.check(), (0, ""))

    def test_judges_only_the_commits_added_after_the_previous_head(self):
        self.commit("Earlier work\n\nCo-Authored-By: Claude Opus <noreply@anthropic.com>")
        previous = self.git("rev-parse", "HEAD")
        self.commit("New work")
        self.assertEqual(self.check(after=previous), (0, ""))

    def test_checks_the_head_alone_when_the_previous_head_is_unknown(self):
        self.commit("Earlier work\n\nCo-Authored-By: Claude Opus <noreply@anthropic.com>")
        head = self.commit("Plain message", author=("Claude", "noreply@anthropic.com"))
        code, output = self.check(after="0" * 40)
        self.assertEqual(code, 1)
        self.assertIn("only HEAD is checked", output)
        self.assertEqual(output.count("carries"), 1)
        self.assertIn(f"{head[:11]} carries author", output)

    def test_refuses_each_kind_of_ai_attribution(self):
        cases = {
            "author": dict(message="Plain message", author=("Claude", "noreply@anthropic.com")),
            "committer": dict(message="Plain message", committer=("Codex", "codex@openai.com")),
            "trailer Co-Authored-By": dict(message="Plain\n\nCo-Authored-By: Claude Opus <noreply@anthropic.com>"),
            "trailer Claude-Session": dict(message="Plain\n\nClaude-Session: https://claude.ai/code/session_x"),
            "footer": dict(message="Plain\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"),
        }
        for kind, case in cases.items():
            with self.subTest(kind):
                self.setUp()
                message = case.pop("message")
                sha = self.commit(message, **case)
                code, output = self.check()
                self.assertEqual(code, 1)
                self.assertIn(f"{sha[:11]} carries {kind}", output)


if __name__ == "__main__":
    unittest.main()
