import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import unittest
import tempfile
from contextlib import redirect_stdout, nullcontext
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("box_deploy", Path(__file__).resolve().parents[2] / "first/box-deploy.py")
box_deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(box_deploy)


class DeploymentRefusalTest(unittest.TestCase):
    def docker_failure(self, line):
        return subprocess.CalledProcessError(1, ["docker", "compose", "up", "-d"], stderr=line)

    def report_failure(self, fail):
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as temporary, patch.object(box_deploy, "main", side_effect=fail), redirect_stdout(output):
            self.assertEqual(box_deploy.run("test", Path(temporary), "revision"), 1)
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
        with patch.object(box_deploy.deploy.subprocess, "run", side_effect=compose), patch.object(box_deploy.deploy.subprocess, "check_output", return_value="0"), patch.object(box_deploy.deploy, "wait_for_identity", side_effect=lambda _: events.append("identity")), patch.object(box_deploy.deploy, "directory_status", side_effect=lambda *_: events.append("pending") or {"status": "pending"}):
            box_deploy.deploy.start(Path("/unused"), {}, events.append)
        self.assertEqual(events, ["prepare", "prepare", "start Herald", "metrics", "wait for Herald identity", "identity", "register pending", "pending", "start services", "-d", "initialise", "init"])


class DeploymentOrderTest(unittest.TestCase):
    def test_build_failure_leaves_the_former_shard_running(self):
        with (
            patch.object(box_deploy.deploy, "deployment_target"),
            patch.object(box_deploy, "operator_environment", return_value={}),
            patch.object(box_deploy.deploy, "load_inputs", return_value={}),
            patch.object(box_deploy.shard, "isolated_stack_lock", return_value=nullcontext()),
            patch.object(box_deploy.shard, "build_images", side_effect=RuntimeError("build failed")),
            patch.object(box_deploy, "retire_previous") as retire,
            patch.object(box_deploy.deploy, "main") as deploy,
        ):
            with self.assertRaisesRegex(RuntimeError, "build failed"):
                box_deploy.main("test", Path("/unused"), "revision", lambda _: None)
            retire.assert_not_called()
            deploy.assert_not_called()

    def test_images_build_before_retirement_and_deployment(self):
        self.check_build_revision("revision")

    def test_built_commit_must_match_the_requested_revision(self):
        self.check_build_revision("another-revision")

    def check_build_revision(self, built_revision):
        events = []
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / "data").mkdir()
            (directory / "release.json").write_text(json.dumps({"commit": built_revision}))
            with (
                patch.object(box_deploy.deploy, "deployment_target"),
                patch.object(box_deploy, "operator_environment", return_value={}),
                patch.object(box_deploy.deploy, "load_inputs", return_value={}),
                patch.object(box_deploy.shard, "isolated_stack_lock", return_value=nullcontext()),
                patch.object(box_deploy.shard, "build_images", side_effect=lambda: events.append("build")),
                patch.object(box_deploy, "retire_previous", side_effect=lambda *_: events.append("retire")),
                patch.object(box_deploy.deploy, "main", side_effect=lambda *_: events.append("deploy")),
            ):
                if built_revision == "revision":
                    box_deploy.main("test", directory, "revision", lambda _: None)
                else:
                    with self.assertRaisesRegex(box_deploy.deploy.DeploymentRefused, "Box built commit another-revision, requested revision"):
                        box_deploy.main("test", directory, "revision", lambda _: None)
            self.assertEqual(events, ["build", "retire", "deploy"])
