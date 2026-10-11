import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("box_deploy", Path(__file__).resolve().parents[2] / "first/box-deploy.py")
box_deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(box_deploy)


class DeploymentRefusalTest(unittest.TestCase):
    def docker_failure(self, line):
        return subprocess.CalledProcessError(1, ["docker", "compose", "up", "-d"], stderr=line)

    def test_docker_last_error_survives_but_earlier_output_does_not(self):
        error = self.docker_failure(b"earlier private output\nfailed to create network: all predefined address pools have been fully subnetted\n")
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(box_deploy.docker_error_line(error), "failed to create network: all predefined address pools have been fully subnetted")

    def test_environment_values_private_keys_and_long_hex_lines_are_dropped(self):
        for line, environment in (
            ("refused operator test-operator-token", {"OPERATOR_TOKEN": "test-operator-token"}),
            ("refused private-key-material", {"PRIVATE_KEY": "private-key-material"}),
            ("refused test-value", {"UNRELATED_NAME": "test-value"}),
            ("refused 0x" + "a" * 64, {}),
            ("refused 0X123456789abcdef01", {}),
            ("refused \x1b[31mcontrol", {}),
        ):
            with self.subTest(environment=list(environment)), patch.dict(os.environ, environment, clear=True):
                self.assertIsNone(box_deploy.docker_error_line(self.docker_failure("earlier safe line\n" + line)))

    def test_only_compose_stderr_is_eligible(self):
        with patch.dict(os.environ, {}, clear=True):
            for error in (ValueError("private"), subprocess.CalledProcessError(1, ["other"], stderr="private"), subprocess.CalledProcessError(1, ["docker", "compose"], output="private")):
                self.assertIsNone(box_deploy.docker_error_line(error))

    def test_every_stage_is_named_and_arbitrary_exception_text_stays_private(self):
        for stage in box_deploy.STAGES:
            def fail(_environment, _directory, _revision, report_stage):
                report_stage(stage)
                print("private subprocess output")
                raise ValueError("private exception")
            output = io.StringIO()
            with self.subTest(stage=stage), patch.object(box_deploy, "main", side_effect=fail), redirect_stdout(output):
                self.assertEqual(box_deploy.run("test", Path("/unused"), "revision"), 1)
            self.assertEqual(json.loads(output.getvalue()), {"kind": "shard-deployment-refused", "message": f"Shard deployment stopped at {stage}."})

    def test_compose_failure_reaches_the_structured_output(self):
        def fail(_environment, _directory, _revision, report_stage):
            report_stage("start Herald")
            raise self.docker_failure("failed to create network: all predefined address pools have been fully subnetted")
        output = io.StringIO()
        with patch.dict(os.environ, {}, clear=True), patch.object(box_deploy, "main", side_effect=fail), redirect_stdout(output):
            self.assertEqual(box_deploy.run("test", Path("/unused"), "revision"), 1)
        self.assertEqual(json.loads(output.getvalue())["message"], "Shard deployment stopped at start Herald. failed to create network: all predefined address pools have been fully subnetted")

    def test_herald_http_status_survives_without_response_body(self):
        def fail(_environment, _directory, _revision, report_stage):
            report_stage("wait for Herald identity")
            raise box_deploy.HeraldIdentityRefused(403)
        output = io.StringIO()
        with patch.object(box_deploy, "main", side_effect=fail), redirect_stdout(output):
            box_deploy.run("test", Path("/unused"), "revision")
        self.assertEqual(json.loads(output.getvalue())["message"], "Shard deployment stopped at wait for Herald identity. Herald identity read refused: HTTP 403")

    def test_real_start_reports_each_stage_before_its_operation(self):
        events = []
        def compose(command, **kwargs):
            self.assertTrue(kwargs["capture_output"])
            events.append(command[-1])
        with patch.object(box_deploy.deploy.subprocess, "run", side_effect=compose), patch.object(box_deploy.deploy.subprocess, "check_output", return_value="0"), patch.object(box_deploy.deploy, "wait_for_identity", side_effect=lambda _: events.append("identity")), patch.object(box_deploy.deploy, "directory_status", side_effect=lambda *_: events.append("pending") or {"status": "pending"}):
            box_deploy.deploy.start(Path("/unused"), {}, events.append)
        self.assertEqual(events, ["prepare", "prepare", "start Herald", "metrics", "wait for Herald identity", "identity", "register pending", "pending", "start services", "-d", "initialise", "init"])
