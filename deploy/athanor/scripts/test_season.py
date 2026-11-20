import contextlib
import importlib.util
import io
import json
from datetime import datetime
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import deploy
import season

ROOT = Path(__file__).resolve().parents[3]
START = "2026-10-30T06:30:00.000Z"
END = "2026-10-31T22:30:00.000Z"
NOW = datetime.fromisoformat("2026-10-28T12:00:00+00:00").timestamp()
DATES = {"startsAt": START, "endsAt": END}

spec = importlib.util.spec_from_file_location("operator_command", Path(__file__).with_name("operator-command.py"))
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)


class SeasonCommandTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        root = Path(self.temporary.name)
        settings = root / "deploy/first/environments.json"
        settings.parent.mkdir(parents=True)
        self.directory = root / "run"
        data = self.directory / "data"
        data.mkdir(parents=True)
        (data / "native-world.json").write_text("{}")
        settings.write_text(json.dumps({"dev": {"origin": "https://dev.test", "runDirectory": str(self.directory)}}))
        self.phases = []
        self.writes = []
        self.commands = []
        for replacement in (
            patch.object(season.shard, "ROOT", root),
            patch.object(season, "service_json", side_effect=self.calendar),
            patch.object(season.subprocess, "check_output", side_effect=self.run_dates),
            patch.object(season.time, "time", return_value=NOW),
        ):
            replacement.start()
            self.addCleanup(replacement.stop)

    def run_dates(self, command, **kwargs):
        self.commands.append(command)
        self.assertEqual(command, [
            *deploy.compose(self.directory), "run", "--rm", "--no-deps", "-T",
            "--entrypoint", "bun", "harness", "deploy/athanor/scripts/season-dates.ts", command[-1],
        ])
        # Docker is the substituted boundary; the deployed command's date calculation runs for real.
        result = subprocess.run(["bun", *command[-2:]], cwd=ROOT, capture_output=True, text=True)
        if result.returncode:
            raise ValueError(result.stderr)
        return result.stdout

    def calendar(self, url, payload=None, *, method=None):
        if payload is None:
            self.assertEqual(url, "https://dev.test/api/factory/calendar")
            return {"phases": self.phases}
        self.assertEqual((url, method), ("https://dev.test/api/factory/calendar/frontier", "PUT"))
        self.writes.append(payload)
        phase = {"phase": "frontier", **payload}
        self.phases = [phase]
        return phase

    def test_rehearsal_dates_reach_the_calendar_and_retry_does_not_write(self):
        result = season.open_frontier("dev", "2026-10-30T12:00:00+05:30", "2026-11-01T04:00:00+05:30")
        self.assertEqual(result, {"phase": "frontier", **DATES})
        self.assertEqual(season.open_frontier("dev", START, END), result)
        self.assertEqual(self.writes, [DATES])

    def test_open_now_uses_the_armies_tick_and_one_complete_bag(self):
        before = datetime.now().timestamp()
        result = season.open_frontier("dev")
        after = datetime.now().timestamp()
        start = datetime.fromisoformat(result["startsAt"].replace("Z", "+00:00")).timestamp()
        end = datetime.fromisoformat(result["endsAt"].replace("Z", "+00:00")).timestamp()
        self.assertEqual(start % 120, 0)
        self.assertTrue(before - 120 < start <= after)
        self.assertEqual(end - start, 288000)

    def test_running_or_pending_season_is_preserved(self):
        for now in (NOW, datetime.fromisoformat("2026-10-30T07:00:00+00:00").timestamp()):
            with self.subTest(now=now), patch.object(season.time, "time", return_value=now):
                phase = {"phase": "frontier", **DATES}
                self.phases = [phase]
                self.assertEqual(season.open_frontier("dev"), phase)
        self.assertEqual(self.writes, [])

    def test_running_or_pending_dates_cannot_be_moved(self):
        self.phases = [{"phase": "frontier", **DATES}]
        with self.assertRaisesRegex(ValueError, "different dates"):
            season.open_frontier("dev", "2026-10-31T22:50:00Z", "2026-11-02T14:50:00Z")
        self.assertEqual(self.writes, [])

    def test_ended_season_can_roll_over_to_the_next_bag(self):
        self.phases = [{"phase": "frontier", "startsAt": "2026-10-20T00:00:00Z", "endsAt": "2026-10-23T08:00:00Z"}]
        self.assertEqual(season.open_frontier("dev", START, END), {"phase": "frontier", **DATES})
        self.assertEqual(self.writes, [DATES])

    def test_invalid_dates_never_write(self):
        for start, end, error in (
            ("2026-10-30T06:30:01Z", END, "120 s tick"),
            (START, "2026-10-31T06:30:01Z", "120 s tick"),
            ("2026-10-30T06:30:00", END, "timezone"),
            (START, None, "both season dates"),
        ):
            with self.subTest(start=start, end=end), self.assertRaisesRegex(ValueError, error):
                season.open_frontier("dev", start, end)
        self.assertEqual(self.writes, [])

    def test_other_environments_are_refused_before_files_or_services(self):
        with self.assertRaisesRegex(ValueError, "only for dev"):
            season.open_frontier("production")
        self.assertEqual(self.commands, [])
        self.assertEqual(self.writes, [])


class OperatorSeasonTest(unittest.TestCase):
    def test_wrapper_passes_explicit_dates_with_protected_credentials(self):
        arguments = ["dev", "--starts-at", START, "--ends-at", END]
        with patch.object(operator, "operator_environment", return_value={"OPERATOR_TOKEN": "test-token"}), \
                patch.object(operator.os, "execve") as execute:
            operator.run("season", arguments)
        _, child_arguments, environment = execute.call_args.args
        self.assertEqual(child_arguments[1:], [str(Path(__file__).with_name("season.py")), *arguments])
        self.assertEqual(environment["OPERATOR_TOKEN"], "test-token")
        self.assertNotIn("test-token", child_arguments)

    def test_wrapper_refuses_non_dev_and_partial_dates_before_credentials(self):
        for arguments in (["production"], ["dev", "--starts-at", START]):
            with self.subTest(arguments=arguments), contextlib.redirect_stderr(io.StringIO()), \
                    patch.object(operator, "operator_environment") as credential, self.assertRaises(SystemExit):
                try:
                    operator.run("season", arguments)
                finally:
                    credential.assert_not_called()

