import io
import json
import os
from pathlib import Path
import subprocess
import unittest
import tempfile
from contextlib import redirect_stdout, nullcontext
from unittest.mock import patch

import deploy as box_deploy


class DeploymentRefusalTest(unittest.TestCase):
    def docker_failure(self, line):
        return subprocess.CalledProcessError(1, ["docker", "compose", "up", "-d"], stderr=line)

    def report_failure(self, fail):
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as temporary, patch.object(box_deploy, "main", side_effect=lambda env, directory, report: fail(env, directory, None, report)), redirect_stdout(output):
            self.assertEqual(box_deploy.run("test", Path(temporary)), 1)
            report = json.loads(output.getvalue())
            log = Path(report["log"])
            self.assertEqual(log.stat().st_mode & 0o777, 0o600)
            self.assertIn("Traceback", log.read_text())
            return report, log.read_text()

    def test_every_stage_is_named_and_full_output_stays_in_private_log(self):
        for stage in box_deploy.STAGES:
            def fail(_environment, _directory, _revision, report_stage):
                report_stage(stage)
                print("subprocess evidence")
                raise ValueError("failure evidence")
            with self.subTest(stage=stage):
                report, log = self.report_failure(fail)
                self.assertEqual(report["stage"], stage)
                self.assertEqual(report["restarted"], stage == "restart pending shard")
                self.assertIn("subprocess evidence", log)
                self.assertNotIn("failure evidence", report["message"])

    def test_compose_failure_reaches_the_structured_output(self):
        def fail(_environment, _directory, _revision, report_stage):
            report_stage("start Herald")
            raise self.docker_failure("failed to create network: all predefined address pools have been fully subnetted")
        with patch.dict(os.environ, {}, clear=True):
            report, _ = self.report_failure(fail)
        self.assertEqual(report["error"], "CalledProcessError")
        self.assertNotIn("failed to create network", report["message"])

    def test_herald_http_status_survives_without_response_body(self):
        def fail(_environment, _directory, _revision, report_stage):
            report_stage("wait for Herald identity")
            raise box_deploy.HeraldIdentityRefused(403)
        report, _ = self.report_failure(fail)
        self.assertEqual(report["status"], 403)
        self.assertIn("HTTP 403", report["message"])

    def test_real_start_reports_each_stage_before_its_operation(self):
        events = []
        def compose(command, **kwargs):
            self.assertIn("stderr", kwargs)
            self.assertIn("stdout", kwargs)
            events.append(command[-1])
        with patch.object(box_deploy.subprocess, "run", side_effect=compose), patch.object(box_deploy.subprocess, "check_output", return_value="0"), patch.object(box_deploy, "wait_for_identity", side_effect=lambda _: events.append("identity")), patch.object(box_deploy, "directory_status", side_effect=lambda *_: events.append("pending") or {"status": "pending"}):
            box_deploy.start(Path("/unused"), {}, events.append)
        self.assertEqual(events, ["prepare", "prepare", "start Herald", "metrics", "wait for Herald identity", "identity", "register pending", "pending", "start services", "-d", "initialise", "init"])
