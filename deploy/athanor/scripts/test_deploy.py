import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import deploy


def release():
    return {"tag": "shard-v1.0.0", "commit": "abc", "releaseId": 1, "schema": "0xs", "migrationClassHash": "0x0",
            "classes": {"games": "0x1", "logic": {"Season": "0x2", "Map": "0x3"}, "account": "0x4", "verifier": "0x5"},
            "presets": {"2": "0x20", "5": "0x50", "101": "0x65"}}


def deployed():
    manifest = {"native": {"releaseId": 1, "activeSchema": "0xs", "gamesClassHash": "0x01", "verifierClassHash": "0x5", "migrationClassHash": "0x0",
                           "logic": {"Season": "0x2", "Map": "0x3"}},
                "shard": {"accountClassHash": "0x4"}}
    return manifest, {"presets": {"2": "0x20", "5": "0x050"}}


class DeployTest(unittest.TestCase):
    def test_prepare_materializes_the_key_before_the_rpc_file_bind_is_created(self):
        with (
            patch.object(deploy.subprocess, "run") as run,
            patch.object(deploy.subprocess, "check_output", return_value="0"),
            patch.object(deploy, "wait_for_identity"),
            patch.object(deploy, "directory_status", return_value={"status": "pending"}),
        ):
            deploy.start(Path("/unused"), {"public_herald_url": "https://herald.test"})
        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(commands[0][-4:], ["run", "--rm", "--no-deps", "prepare"][-5:])
        self.assertEqual(commands[1][-4:], ["up", "-d", "herald", "metrics"])

    def test_a_shard_running_its_release_has_no_differences(self):
        manifest, initialized = deployed()
        self.assertEqual(deploy.release_differences(release(), manifest, initialized, [2, 5]), [])

    def test_every_difference_from_the_release_is_named(self):
        manifest, initialized = deployed()
        manifest["native"]["logic"]["Map"] = "0x9"
        manifest["native"]["logic"]["Troops"] = "0x7"
        manifest["native"]["migrationClassHash"] = "0x6"
        manifest["shard"]["accountClassHash"] = "0x8"
        initialized["presets"].pop("5")
        differences = deploy.release_differences(release(), manifest, initialized, [2, 5])
        self.assertEqual(differences, [
            "Map class 0x9, release has 0x3",
            "Troops class 0x7, release has None",
            "migration class 0x6, release has 0x0",
            "account class 0x8, release has 0x4",
            "preset 5 commitment None, release has 0x50",
        ])

    def test_the_package_environment_carries_the_deployment_inputs(self):
        inputs = {"shard_name": "realms-staging-d", "chain_id": "REALMS_STAGING_D", "player_capacity": 96,
                  "guardian_url": "https://staging.test/api/guardian", "presets": [2, 5],
                  "public_rpc_url": "https://rpc.staging.test/rpc/v0_10_2",
                  "public_herald_url": "https://herald.staging.test", "vrf_workers": 8, "l2_gas_bound": "0x47868c00", "node_memory": "8g", "herald_memory": "6g"}
        rendered = deploy.render_environment(inputs, "SHARD_INIT_IMAGE=ghcr.io/x@sha256:1\n")
        self.assertIn("SHARD_INIT_IMAGE=ghcr.io/x@sha256:1\n", rendered)
        self.assertIn("PRESETS=2,5\n", rendered)
        self.assertIn("CHAIN_ID=REALMS_STAGING_D\n", rendered)
        self.assertIn("NODE_MEMORY=8g\n", rendered)
        self.assertIn("HERALD_MEMORY=6g\n", rendered)


class InputsTest(unittest.TestCase):
    INPUTS = {key: 1 for key in deploy.INPUTS}

    def test_only_committed_unchanged_inputs_deploy(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)

            def git(*command):
                subprocess.run(["git", *command], cwd=root, check=True, capture_output=True)

            git("init", "-q")
            environments = root / "deploy/release"
            environments.mkdir(parents=True)
            inputs = environments / "staging.json"
            with patch.object(deploy.shard, "ROOT", root), patch.object(deploy, "ENVIRONMENTS", environments):
                with self.assertRaisesRegex(ValueError, "deploy/release/staging.json is not committed"):
                    deploy.load_inputs("staging")
                inputs.write_text(json.dumps(self.INPUTS))
                with self.assertRaisesRegex(ValueError, "is not committed"):
                    deploy.load_inputs("staging")
                git("add", "deploy/release/staging.json")
                git("-c", "user.name=ci", "-c", "user.email=ci@example.test", "commit", "-q", "-m", "staging inputs")
                self.assertEqual(deploy.load_inputs("staging"), self.INPUTS)
                inputs.write_text(json.dumps({**self.INPUTS, "presets": [9]}))
                with self.assertRaisesRegex(ValueError, "is not committed"):
                    deploy.load_inputs("staging")


class EnrolmentTest(unittest.TestCase):
    def test_initialization_requires_the_file_wrapper_instead_of_an_inherited_token(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            with patch.dict(deploy.os.environ, {}, clear=True):
                with self.assertRaisesRegex(ValueError, "protected operator"):
                    deploy.check_operator_approval(directory, {"OPERATOR_TOKEN_FILE": "/opt/athanor/operator-token"})
            with patch.dict(deploy.os.environ, {"OPERATOR_TOKEN": "test-token"}):
                deploy.check_operator_approval(directory, {"OPERATOR_TOKEN_FILE": "/opt/athanor/operator-token"})
                with self.assertRaisesRegex(ValueError, "protected operator"):
                    deploy.check_operator_approval(directory, {"OPERATOR_TOKEN": "test-token"})

    def test_sudo_preserves_only_the_credential_path(self):
        preserved = next(flag for flag in deploy.compose(Path("/srv/shard")) if flag.startswith("--preserve-env="))
        self.assertNotIn("OPERATOR_TOKEN", preserved.removeprefix("--preserve-env=").split(","))
        self.assertIn("OPERATOR_TOKEN_FILE", preserved.removeprefix("--preserve-env=").split(","))



class ActivationTest(unittest.TestCase):
    def test_real_data_directory_records_a_failed_check_without_promoting(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            with (
                patch.object(deploy, "gameplay_check_identity", return_value="test-identity"),
                patch.object(deploy, "run_self_check", return_value={"passed": False, "firstFailedRoute": "Explore"}),
                patch.object(deploy, "directory_status", return_value={"status": "pending"}) as directory,
            ):
                with self.assertRaisesRegex(RuntimeError, "Explore; directory status unchanged"):
                    deploy.verify_and_activate({}, data)
                directory.assert_called_once_with({}, "pending")
            self.assertEqual(json.loads((data / "self-check.json").read_text())["firstFailedRoute"], "Explore")

    def test_real_data_directory_records_success_before_promoting(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            def activate(*args):
                if args[1] == "pending":
                    return {"status": "pending"}
                self.assertTrue(json.loads((data / "self-check.json").read_text())["passed"])
                return {"status": "active"}
            with (
                patch.object(deploy, "gameplay_check_identity", return_value="test-identity"),
                patch.object(deploy, "confirm_worker_launcher"),
                patch.object(deploy, "run_self_check", return_value={"passed": True}),
                patch.object(deploy, "directory_status", side_effect=activate),
            ):
                deploy.verify_and_activate({}, data)
            self.assertFalse((data / "data").exists())

    def test_active_rechecks_create_no_games_and_leave_status_unchanged(self):
        with tempfile.TemporaryDirectory() as temporary:
            with (
                patch.object(deploy, "directory_status", return_value={"status": "active"}),
                patch.object(deploy, "run_self_check") as check,
            ):
                deploy.verify_and_activate({}, Path(temporary))
            check.assert_not_called()

    def test_official_deployment_registers_pending_after_identity_before_initialization(self):
        events = []
        with (
            patch.object(deploy.subprocess, "run", side_effect=lambda args, **_: events.append(args[-1])),
            patch.object(deploy.subprocess, "check_output", return_value="0"),
            patch.object(deploy, "wait_for_identity", side_effect=lambda *_: events.append("identity")),
            patch.object(deploy, "directory_status", side_effect=lambda *_: (events.append("pending") or {"status": "pending"})),
        ):
            deploy.start(Path("/unused"), {})
        self.assertEqual(events[:5], ["prepare", "metrics", "identity", "pending", "-d"])

    def test_missing_pending_route_names_the_required_service_order(self):
        from urllib.error import HTTPError
        with (
            patch.dict(deploy.os.environ, {"OPERATOR_TOKEN": "test-token"}),
            patch("directory.urlopen", side_effect=HTTPError("https://identity.test", 404, "Not found", {}, None)),
        ):
            with self.assertRaisesRegex(RuntimeError, "identity service must carry the pending route before a shard from this code starts"):
                deploy.directory_status({"guardian_url": "https://identity.test/api/guardian", "public_herald_url": "https://herald.test"}, "pending")

class WorkerLauncherTest(unittest.TestCase):
    def test_gameplay_evidence_survives_a_package_change(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data = root / "data"
            data.mkdir()
            for name in ("native-world.json", "initialized.json"):
                (data / name).write_text("{}")
            release = root / "release.json"
            release.write_text(json.dumps({"commit": "a", "images": {"init": "sha256:1"}}))
            first = deploy.gameplay_check_identity(data)
            release.write_text(json.dumps({"commit": "b", "images": {"init": "sha256:2"}}))
            self.assertEqual(first, deploy.gameplay_check_identity(data))

    def test_runner_gameplay_evidence_survives_an_image_change(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            for name in ("native-world.json", "initialized.json"):
                (data / name).write_text("{}")
            (data / "configuration.json").write_text(json.dumps({"init_image": "sha256:1"}))
            stack = data / "compose.json"
            stack.write_text(json.dumps({"services": {"init": {"image": "sha256:1"}}}))
            first = deploy.gameplay_check_identity(data)
            stack.write_text(json.dumps({"services": {"init": {"image": "sha256:2"}}}))
            self.assertEqual(first, deploy.gameplay_check_identity(data))

    def test_handoff_then_packaging_change_resumes_worker_check_without_rechecking(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            for name in ("native-world.json", "initialized.json"):
                (data / name).write_text("{}")
            (data / "configuration.json").write_text("{}")
            stack = data / "compose.json"
            stack.write_text(json.dumps({"image": "sha256:before"}))
            def interrupted_handoff(*_):
                (data / "launcher-enrolment.json").write_text(json.dumps({"launcherAccount": "0x42"}))
                raise RuntimeError("Worker check unavailable")
            with (
                patch.object(deploy, "run_self_check", return_value={"passed": True}) as check,
                patch.object(deploy, "directory_status", return_value={"status": "pending"}),
                patch.object(deploy, "confirm_worker_launcher", side_effect=interrupted_handoff),
            ):
                with self.assertRaisesRegex(RuntimeError, "Worker check unavailable"):
                    deploy.verify_and_activate({}, data)
                self.assertEqual(check.call_count, 1)
            stack.write_text(json.dumps({"image": "sha256:after"}))
            with (
                patch.object(deploy, "run_self_check") as check,
                patch.object(deploy, "directory_status", side_effect=lambda _, status: {"status": status}),
                patch.object(deploy, "confirm_worker_launcher") as worker,
            ):
                deploy.verify_and_activate({}, data)
                check.assert_not_called()
                worker.assert_called_once()
            for changed_file in ("native-world.json", "initialized.json", "self-check.json"):
                with self.subTest(changed_file=changed_file):
                    before = (data / changed_file).read_text()
                    (data / changed_file).write_text("{}" if changed_file == "self-check.json" else '{"changed":true}')
                    with (
                        patch.object(deploy, "run_self_check") as check,
                        patch.object(deploy, "directory_status", return_value={"status": "pending"}) as status,
                        patch.object(deploy, "confirm_worker_launcher") as worker,
                    ):
                        with self.assertRaisesRegex(RuntimeError, "launcher already handed off; finish the Worker check or retire the chain"):
                            deploy.verify_and_activate({}, data)
                        check.assert_not_called()
                        worker.assert_not_called()
                        status.assert_called_once_with({}, "pending")
                    (data / changed_file).write_text(before)

    def test_activation_waits_for_confirmed_worker_handoff_and_its_real_creation(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            events = []
            with (
                patch.object(deploy, "gameplay_check_identity", return_value="test-identity"),
                patch.object(deploy, "run_self_check", return_value={"passed": True}),
                patch.object(deploy, "directory_status", side_effect=lambda _, status: (events.append(status) or {"status": status})),
                patch.object(deploy, "confirm_worker_launcher", side_effect=lambda *_: events.append("confirmed_worker")),
            ):
                deploy.verify_and_activate({}, data)
            self.assertEqual(events, ["pending", "confirmed_worker", "active"])

    def test_worker_unavailable_stays_pending_and_retry_uses_only_bound_gameplay_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            with (
                patch.object(deploy, "gameplay_check_identity", return_value="test-identity"),
                patch.object(deploy, "run_self_check", return_value={"passed": True}) as check,
                patch.object(deploy, "directory_status", return_value={"status": "pending"}) as status,
                patch.object(deploy, "confirm_worker_launcher", side_effect=RuntimeError("Worker unavailable")),
            ):
                for _ in range(2):
                    with self.assertRaisesRegex(RuntimeError, "Worker unavailable"):
                        deploy.verify_and_activate({}, data)
                self.assertEqual(check.call_count, 1)
                self.assertTrue(all(call.args[1] == "pending" for call in status.call_args_list))
            with (
                patch.object(deploy, "gameplay_check_identity", return_value="changed-world"),
                patch.object(deploy, "run_self_check", return_value={"passed": False}) as check,
                patch.object(deploy, "directory_status", return_value={"status": "pending"}),
            ):
                with self.assertRaises(RuntimeError):
                    deploy.verify_and_activate({}, data)
                check.assert_called_once()

    def test_launcher_enrollment_is_checked_on_chain_before_requesting_the_signed_game(self):
        events = []
        manifest = {"shard": {"chainId": "0x123"}}
        def service(_, action, payload):
            events.append(action)
            return {"chainId": "0x123", "launcherAccount": "0x42", "txHash": "0x456"}
        with (
            patch.object(deploy, "deployed_facts", return_value=(manifest, {})),
            patch.object(deploy, "launcher_service", side_effect=service),
            patch.object(deploy, "launcher_chain_check", side_effect=lambda *args: events.append(args[2])),
        ):
            deploy.confirm_worker_launcher({"public_herald_url": "https://herald.test", "presets": [5]}, Path("/unused"))
        self.assertEqual(events, ["enrol", "handoff", "check", "verify"])


if __name__ == "__main__":
    unittest.main()
