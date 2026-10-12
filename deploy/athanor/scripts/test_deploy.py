import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import deploy


def release():
    return {"commit": "abc", "releaseId": 1, "schema": "0xs", "migrationClassHash": "0x0",
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
    INPUTS = {**{key: 1 for key in deploy.INPUTS}, "guardian_url": "https://identity.test/api/guardian"}

    def test_only_committed_unchanged_inputs_deploy(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)

            def git(*command):
                subprocess.run(["git", *command], cwd=root, check=True, capture_output=True)

            git("init", "-q")
            environments = root / "deploy/release"
            environments.mkdir(parents=True)
            table = root / "deploy/first/environments.json"
            table.parent.mkdir(parents=True)
            table.write_text(json.dumps({"dev": {"release": "staging", "origin": "https://identity.test"}}))
            inputs = environments / "staging.json"
            with patch.object(deploy.shard, "ROOT", root), patch.object(deploy, "ENVIRONMENTS", environments):
                with self.assertRaisesRegex(ValueError, "deploy/release/staging.json is not committed"):
                    deploy.load_inputs("staging")
                inputs.write_text(json.dumps({key: value for key, value in self.INPUTS.items() if key != "guardian_url"}))
                with self.assertRaisesRegex(ValueError, "is not committed"):
                    deploy.load_inputs("staging")
                git("add", "deploy/release/staging.json")
                git("-c", "user.name=ci", "-c", "user.email=ci@example.test", "commit", "-q", "-m", "staging inputs")
                self.assertEqual(deploy.load_inputs("staging"), self.INPUTS)
                inputs.write_text(json.dumps({**self.INPUTS, "presets": [9]}))
                with self.assertRaisesRegex(ValueError, "is not committed"):
                    deploy.load_inputs("staging")


class EnrolmentTest(unittest.TestCase):
    def test_initialization_requires_the_wrapper_supplied_credential(self):
        with patch.dict(deploy.os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "protected operator"):
                deploy.check_operator_approval()
        with patch.dict(deploy.os.environ, {"OPERATOR_TOKEN": "test-token"}):
            deploy.check_operator_approval()

    def test_sudo_preserves_only_driver_placement(self):
        preserved = next(flag for flag in deploy.compose(Path("/srv/shard")) if flag.startswith("--preserve-env="))
        self.assertEqual(preserved, "--preserve-env=HARNESS_CPUSET")



class ActivationTest(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(deploy, "confirm_worker_ledger_operator"))
        self.enterContext(patch.object(deploy, "roles_handed_off", return_value=False, create=True))

    def test_real_data_directory_records_a_failed_check_without_promoting(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            with (
                patch.object(deploy, "gameplay_check_identity", return_value="test-identity"),
                patch.object(deploy, "run_self_check", return_value={"passed": False, "firstFailedRoute": "Explore"}),
                patch.object(deploy, "directory_status", return_value={"status": "pending"}) as directory,
            ):
                with self.assertRaisesRegex(RuntimeError, "Explore: other; directory status unchanged"):
                    deploy.verify_and_activate({}, data)
                directory.assert_called_once_with({}, "pending")
            self.assertEqual(json.loads((data / "self-check.json").read_text())["firstFailedRoute"], "Explore")

    def test_failed_check_is_rerun_after_replacing_the_old_release_images(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data = root / "data"
            data.mkdir()
            for name in ("native-world.json", "initialized.json"):
                (data / name).write_text("{}")
            identity = deploy.gameplay_check_identity(data)
            (data / "self-check.json").write_text(json.dumps({
                "passed": False, "firstFailedRoute": "Explore", "checkedIdentity": identity,
                "gameId": 1, "supplementalGameIds": [2],
            }))
            (root / "release.json").write_text(json.dumps({
                "tag": "shard-v0.7.0-rc.2", "images": {"init": "registry/old@sha256:1"},
            }))
            built = {**release(), "images": {"init": "sha256:2", "herald": "sha256:3", "metrics": "sha256:4"}}
            deploy.write_build(root, built)
            with (
                patch.object(deploy, "run_self_check", return_value={
                    "passed": True, "gameId": 3, "supplementalGameIds": [4],
                }) as check,
                patch.object(deploy, "confirm_worker_launcher"),
                patch.object(deploy, "directory_status", return_value={"status": "pending"}) as directory,
            ):
                deploy.verify_and_activate({}, data)
            check.assert_called_once_with(data)
            self.assertEqual(directory.call_args.args, ({}, "active"))
            self.assertEqual(json.loads((data / "self-check.json").read_text())["gameId"], 3)
            self.assertEqual(json.loads((root / "release.json").read_text()), built)
            self.assertIn("SHARD_INIT_IMAGE=sha256:2", (root / "images.env").read_text())

    def test_unprintable_refusal_keeps_its_route_and_full_saved_reason(self):
        failure = {"category": "refused", "reason": "army must be at its realm's spire", "transactionHash": "0x123"}
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            with (
                patch.object(deploy, "gameplay_check_identity", return_value="test-identity"),
                patch.object(deploy, "run_self_check", return_value={
                    "passed": False, "firstFailedRoute": "Move", "failure": failure,
                }),
                patch.object(deploy, "directory_status", return_value={"status": "pending"}) as directory,
            ):
                with self.assertRaises(deploy.SelfCheckFailed) as caught:
                    deploy.verify_and_activate({}, data)
                self.assertEqual(str(caught.exception), "self-check failed at Move: other; directory status unchanged")
                directory.assert_called_once_with({}, "pending")
            self.assertEqual(json.loads((data / "self-check.json").read_text())["failure"], failure)

    def test_receipt_failure_is_saved_before_the_public_refusal_is_raised(self):
        failure = {"category": "refused", "reason": "insufficient stamina, you need: 30, and have: 20", "transactionHash": "0x123"}
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            with patch.object(deploy, "gameplay_check_identity", return_value="test-identity"), patch.object(deploy, "run_self_check", return_value={"passed": False, "firstFailedRoute": "Explore", "failure": failure}), patch.object(deploy, "directory_status", return_value={"status": "pending"}) as directory:
                with self.assertRaisesRegex(deploy.SelfCheckFailed, "insufficient stamina, you need: 30, and have: 20"):
                    deploy.verify_and_activate({}, data)
                directory.assert_called_once_with({}, "pending")
            self.assertEqual(json.loads((data / "self-check.json").read_text())["failure"], failure)

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
            patch("directory.service_json", side_effect=HTTPError("https://identity.test", 404, "Not found", {}, None)),
        ):
            with self.assertRaisesRegex(RuntimeError, "identity service must carry the pending route before a shard from this code starts"):
                deploy.directory_status({"guardian_url": "https://identity.test/api/guardian", "public_herald_url": "https://herald.test"}, "pending")

class WorkerLauncherTest(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(deploy, "confirm_worker_ledger_operator"))
        self.launcher_state = self.enterContext(patch.object(deploy, "roles_handed_off", return_value=False, create=True))

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
                        patch.object(deploy, "roles_handed_off", return_value=True),
                        patch.object(deploy, "run_self_check") as check,
                        patch.object(deploy, "directory_status", return_value={"status": "pending"}) as status,
                        patch.object(deploy, "confirm_worker_launcher") as worker,
                    ):
                        with self.assertRaisesRegex(RuntimeError, "^chain facts changed after the role handoff; retire this chain$"):
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

    def test_launcher_enrollment_is_confirmed_on_chain_without_creating_a_game(self):
        events = []
        manifest = {"shard": {"chainId": "0x123"}}
        def service(_, action, payload):
            events.append(action)
            return {"chainId": "0x123", "launcherAccount": "0x42"}
        with (
            patch.object(deploy, "deployed_facts", return_value=(manifest, {})),
            patch.object(deploy, "launcher_service", side_effect=service),
            patch.object(deploy, "service_role_check", side_effect=lambda *args: events.append(args[1])),
            patch.object(deploy, "gameplay_check_identity", return_value="pins"),
            patch.object(deploy.shard, "write_json"),
        ):
            deploy.confirm_worker_launcher({"public_herald_url": "https://herald.test", "presets": [5]}, Path("/unused"))
        self.assertEqual(events, ["enrol", "handoff"])


if __name__ == "__main__":
    unittest.main()


class LauncherAuthorityTest(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(deploy, "confirm_worker_ledger_operator"))

    def test_unchanged_bootstrap_roles_allow_a_fresh_self_check(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            (data / "self-check.json").write_text('{"passed":true,"checkedIdentity":"old"}')
            with patch.object(deploy, "gameplay_check_identity", return_value="changed"), patch.object(deploy, "roles_handed_off", return_value=False, create=True) as state, patch.object(deploy, "directory_status", side_effect=lambda _, status: {"status": status}), patch.object(deploy, "run_self_check", return_value={"passed": True}) as check, patch.object(deploy, "confirm_worker_launcher"):
                deploy.verify_and_activate({}, data)
            state.assert_called_once_with(data)
            check.assert_called_once_with(data)

    def test_installed_worker_blocks_self_check_even_without_an_intent_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            with patch.object(deploy, "gameplay_check_identity", return_value="changed"), patch.object(deploy, "roles_handed_off", return_value=True, create=True) as state, patch.object(deploy, "directory_status", return_value={"status": "pending"}), patch.object(deploy, "run_self_check") as check, patch.object(deploy, "confirm_worker_launcher") as worker:
                with self.assertRaisesRegex(RuntimeError, "^chain facts changed after the role handoff; retire this chain$"):
                    deploy.verify_and_activate({}, data)
            state.assert_called_once_with(data)
            check.assert_not_called()
            worker.assert_not_called()


class LauncherStateTransportTest(unittest.TestCase):
    def test_state_command_reads_the_private_node_without_a_worker_account_argument(self):
        with patch.object(deploy.subprocess, "run") as run:
            run.return_value.returncode = 0
            run.return_value.stdout = '{"passed":true,"handedOff":false}\n'
            self.assertFalse(deploy.roles_handed_off(Path("/unused/data")))
        self.assertEqual(run.call_args.args[0][-3:], ["service-role-check", "state", "/data"])

    def test_unknown_state_and_failed_reads_never_assume_bootstrap_authority(self):
        for output in ("", "null", '{"passed":false,"handedOff":false}', '{"passed":true,"handedOff":"false"}'):
            with self.subTest(output=output), patch.object(deploy.subprocess, "run") as run:
                run.return_value.returncode = 0
                run.return_value.stdout = output
                with self.assertRaisesRegex(RuntimeError, "Role state read failed"):
                    deploy.roles_handed_off(Path("/unused/data"))
        with patch.object(deploy.subprocess, "run") as run:
            run.return_value = subprocess.CompletedProcess(["docker", "compose"], 1, stdout="", stderr="refused")
            with self.assertRaises(subprocess.CalledProcessError):
                deploy.roles_handed_off(Path("/unused/data"))


class WorkerLedgerOperatorTest(unittest.TestCase):
    def test_activation_confirms_the_relay_role_before_the_launcher_handoff_and_active(self):
        with tempfile.TemporaryDirectory() as temporary:
            events = []
            with patch.object(deploy, "gameplay_check_identity", return_value="pins"), \
                    patch.object(deploy, "run_self_check", return_value={"passed": True}), \
                    patch.object(deploy, "roles_handed_off", return_value=False), \
                    patch.object(deploy, "directory_status", side_effect=lambda _, status: (events.append(status) or {"status": status})), \
                    patch.object(deploy, "confirm_worker_ledger_operator", side_effect=lambda *_: events.append("relay_confirmed")), \
                    patch.object(deploy, "confirm_worker_launcher", side_effect=lambda *_: events.append("launcher_confirmed")):
                deploy.verify_and_activate({}, Path(temporary))
            self.assertEqual(events, ["pending", "relay_confirmed", "launcher_confirmed", "active"])

    def test_missing_or_failed_relay_handoff_never_activates(self):
        with tempfile.TemporaryDirectory() as temporary:
            with patch.object(deploy, "gameplay_check_identity", return_value="pins"), \
                    patch.object(deploy, "run_self_check", return_value={"passed": True}), \
                    patch.object(deploy, "roles_handed_off", return_value=False), \
                    patch.object(deploy, "directory_status", return_value={"status": "pending"}) as status, \
                    patch.object(deploy, "confirm_worker_ledger_operator", side_effect=RuntimeError("Relay unavailable")), \
                    patch.object(deploy, "confirm_worker_launcher") as launcher:
                with self.assertRaisesRegex(RuntimeError, "Relay unavailable"):
                    deploy.verify_and_activate({}, Path(temporary))
            self.assertEqual([call.args[1] for call in status.call_args_list], ["pending"])
            launcher.assert_not_called()

    def test_relay_enrollment_pins_chain_and_uses_the_ledger_role_setter(self):
        manifest = {"shard": {"chainId": "0x123"}}
        config = {"guardian_url": "https://id.test/api/guardian", "public_herald_url": "https://herald.test"}
        for chain, valid in [("0x123", True), ("0x999", False)]:
            with patch.object(deploy, "deployed_facts", return_value=(manifest, {})), \
                    patch.object(deploy, "service_json", return_value={"chainId": chain, "ledgerOperatorAccount": "0x42"}) as request, \
                    patch.object(deploy, "service_role_check") as role:
                if valid:
                    deploy.confirm_worker_ledger_operator(config, Path("/unused"))
                    role.assert_called_once_with(Path("/unused"), "handoff", "0x42", role="ledger_operator")
                else:
                    with self.assertRaisesRegex(RuntimeError, "another chain"):
                        deploy.confirm_worker_ledger_operator(config, Path("/unused"))
                    role.assert_not_called()
                request.assert_called_once_with("https://id.test/api/value/operator/shard/enrol", {"chainId": "0x123", "heraldUrl": "https://herald.test"}, timeout=120)


class RestartUnfinishedTest(unittest.TestCase):
    def probe(self, rows, *, recorded="0x54455354", differences=("initialization is incomplete",),
              proof=False, empty=False, manifest="valid", error=None, refused=None):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            if not empty:
                data = root / "data"
                data.mkdir()
                (data / "marker").write_text("keep")
                if manifest != "missing":
                    content = json.dumps({"shard": {"chainId": recorded}}) if manifest == "valid" else "{"
                    (data / "native-world.json").write_text(content)
                if proof:
                    (data / "self-check.json").write_text('{"passed":true}')
            inputs = {"chain_id": "TEST", "guardian_url": "https://id.test/api/guardian",
                      "public_herald_url": "https://herald.test"}
            stages = []
            with (
                patch.object(deploy, "service_json", return_value=rows, side_effect=error) as request,
                patch.object(deploy, "unfinished_differences", return_value=list(differences)),
                patch.object(deploy.subprocess, "run") as run,
            ):
                if refused:
                    with self.assertRaisesRegex(Exception, refused):
                        deploy.restart_unfinished(root, inputs, release(), stages.append)
                else:
                    deploy.restart_unfinished(root, inputs, release(), stages.append)
                deleted = stages == ["restart pending shard"]
                if deleted:
                    self.assertEqual(run.call_args.args[0][-2:], ["down", "--volumes"])
                    self.assertFalse((root / "data").exists())
                else:
                    run.assert_not_called()
                    if not empty:
                        self.assertEqual((root / "data/marker").read_text(), "keep")
                if request.called:
                    request.assert_called_once_with("https://id.test/api/directory/shards", authenticated=True)
                return deleted

    def test_twelve_deletion_probes(self):
        own = {"chainId": "0x54455354", "url": "https://herald.test", "status": "pending"}
        cases = [
            (1, [own], {}, True),
            (2, [{**own, "status": "active"}], {"refused": "cannot be reinitialized"}, False),
            (3, [{**own, "status": "retired"}], {"refused": "cannot be reinitialized"}, False),
            (4, [{**own, "status": "draining"}], {"refused": "cannot be reinitialized"}, False),
            (5, [], {"refused": "remove the run directory yourself"}, False),
            (6, [], {"proof": True, "refused": "remove the run directory yourself"}, False),
            (7, [own], {"recorded": "0x999", "proof": True, "refused": "chain 0x999, configured chain is 0x54455354"}, False),
            (8, [own, {**own, "chainId": "0x999", "status": "retired"}],
             {"recorded": "0x999", "proof": True, "refused": "chain 0x999"}, False),
            (9, [], {"recorded": "0x999", "refused": "chain 0x999"}, False),
            (10, [{**own, "url": "https://other.test"}], {"refused": "another Herald URL"}, False),
            (11, [own], {"proof": True, "differences": ["Games class differs"]}, True),
            (12, [{**own, "chainId": "0x999"}], {"refused": "another chain"}, False),
        ]
        for case, rows, options, deleted in cases:
            with self.subTest(case=case):
                self.assertEqual(self.probe({"shards": rows}, **options), deleted)

    def test_duplicate_and_malformed_rows_never_delete(self):
        own = {"chainId": "0x54455354", "url": "https://herald.test", "status": "pending"}
        for answer, reason in (
            ({"shards": [own, own]}, "Several directory rows"),
            ({}, "malformed"), (None, "malformed"), ({"shards": None}, "malformed"),
            ({"shards": [{}]}, "malformed"), ({"shards": [{**own, "status": "unknown"}]}, "malformed"),
            ({"shards": [{**own, "chainId": "not-a-chain"}]}, "malformed"),
            ({"shards": [own, {**own, "url": "", "chainId": "0x999"}]}, "malformed"),
            ({"shards": [{**own, "url": "https://user:password@herald.test"}]}, "malformed"),
        ):
            with self.subTest(answer=answer):
                self.assertFalse(self.probe(answer, refused=reason))

    def test_missing_unreadable_identity_and_status_failure_never_delete(self):
        for manifest in ("missing", "invalid"):
            with self.subTest(manifest=manifest):
                self.assertFalse(self.probe({"shards": []}, manifest=manifest, refused="no readable chain"))
        self.assertFalse(self.probe(None, error=OSError("unreachable"), refused="unreachable"))

    def test_compatible_unlisted_or_listed_shard_continues_in_place(self):
        for status in (None, "pending", "active", "draining", "retired"):
            rows = [] if status is None else [{"chainId": "0x54455354", "url": "https://herald.test", "status": status}]
            with self.subTest(status=status):
                self.assertFalse(self.probe({"shards": rows}, differences=[]))

    def test_fresh_directory_has_nothing_to_delete(self):
        self.assertFalse(self.probe({"shards": []}, empty=True))

    def test_unreadable_native_manifest_never_reads_status_or_deletes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "marker").touch()
            with patch.object(Path, "read_text", side_effect=PermissionError()), patch.object(deploy, "service_json") as request:
                with self.assertRaisesRegex(deploy.DeploymentRefused, "no readable chain"):
                    deploy.restart_unfinished(root, {"chain_id": "TEST", "public_herald_url": "https://herald.test"}, {}, lambda _: None)
            request.assert_not_called()
            self.assertTrue((root / "marker").exists())

    def test_wrong_directory_refuses_before_inputs_build_or_status_reads(self):
        with patch.object(deploy, "load_inputs") as inputs, patch.object(deploy.shard, "build_images") as build:
            with self.assertRaisesRegex(deploy.DeploymentRefused, "Run directory must be"):
                deploy.main("staging", Path("/wrong"))
            inputs.assert_not_called()
            build.assert_not_called()

    def test_built_classes_guardian_and_saved_identity_are_compared_before_start(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary)
            inputs = {'chain_id': 'TEST', 'guardian_url': 'https://identity.test/api/guardian',
                      'l2_gas_bound': '0x10', 'presets': [2, 5, 101]}
            manifest, initialized = deployed()
            manifest['shard'].update(chainId='0x54455354', guardianPublicKey='0x7')
            for name in ('host-keys.json', 'host-accounts.json', 'vrf-key.json', 'gameplay-contracts.json', 'chain-config.yaml', 'harness.env'):
                (data / name).write_text('{}')
            (data / 'native-world.json').write_text(json.dumps(manifest))
            (data / 'initialized.json').write_text(json.dumps(initialized))
            (data / 'init-configuration.json').write_text(json.dumps({
                'shard': 'test', 'chain_id': 'TEST', 'guardian_url': inputs['guardian_url'], 'l2_gas_bound': '0x10'}))
            with patch.object(deploy.shard, 'read_guardian_identity', return_value={'guardianPublicKey': '0x7'}):
                self.assertEqual(deploy.unfinished_differences(data, inputs, release()), [])
                candidate = release()
                candidate['classes']['games'] = '0x99'
                self.assertEqual(deploy.unfinished_differences(data, inputs, candidate), ['Games class 0x01, release has 0x99'])
                manifest['shard']['chainId'] = '0x99'
                (data / 'native-world.json').write_text(json.dumps(manifest))
                self.assertIn('chain identity differs', deploy.unfinished_differences(data, inputs, release()))
                (data / 'host-keys.json').unlink()
                self.assertEqual(deploy.unfinished_differences(data, inputs, release()), ['initialization is incomplete'])
