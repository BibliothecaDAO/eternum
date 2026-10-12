import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from contextlib import nullcontext

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
    def test_handoff_failures_resume_from_live_roles_without_local_proof(self):
        for fail_at in ("relay", "launcher", "active"):
            with self.subTest(fail_at=fail_at), tempfile.TemporaryDirectory() as temporary:
                data = Path(temporary)
                (data / "obsolete-result.json").write_text('{"passed":false}')
                installed = set()
                events = []
                failed = False

                def step(name):
                    nonlocal failed
                    events.append(name)
                    if name == fail_at and not failed:
                        failed = True
                        raise RuntimeError("interrupted")
                    installed.add(name)

                with (
                    patch.object(deploy, "confirm_worker_ledger_operator", side_effect=lambda *_: step("relay")),
                    patch.object(deploy, "confirm_worker_launcher", side_effect=lambda *_: step("launcher")),
                    patch.object(deploy, "directory_status", side_effect=lambda _, status: step(status)),
                ):
                    with self.assertRaisesRegex(RuntimeError, "interrupted"):
                        deploy.activate({}, data)
                    self.assertNotIn("active", installed)
                    deploy.activate({}, data)
                self.assertEqual(installed, {"relay", "launcher", "active"})
                self.assertEqual(events[-3:], ["relay", "launcher", "active"])
                self.assertEqual((data / "obsolete-result.json").read_text(), '{"passed":false}')

    def test_matching_facts_activate_with_extra_historical_presets_and_files(self):
        for mismatch in (False, True):
            with self.subTest(mismatch=mismatch), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                data = root / "data"
                data.mkdir()
                manifest, initialized = deployed()
                initialized["presets"].update({"103": "0x67", "104": "0x68"})
                if mismatch:
                    manifest["native"]["gamesClassHash"] = "0x99"
                (data / "native-world.json").write_text(json.dumps(manifest))
                (data / "initialized.json").write_text(json.dumps(initialized))
                (data / "obsolete-result.json").write_text('{"passed":false}')
                with (
                    patch.object(deploy, "deployment_target", return_value={"environment": "dev"}),
                    patch.object(deploy, "load_inputs", return_value={"presets": [2, 5]}),
                    patch.object(deploy, "deployment_revision"),
                    patch.object(deploy.shard, "isolated_stack_lock", return_value=nullcontext()),
                    patch.object(deploy.shard, "build_images", return_value={**release(), "images": {"init": "sha256:1"}}),
                    patch.object(deploy, "restart_unfinished"),
                    patch.object(deploy, "render_environment", return_value=""),
                    patch.object(deploy, "check_operator_approval"),
                    patch.object(deploy, "start", return_value={"status": "pending"}),
                    patch.object(deploy, "activate") as activate,
                ):
                    self.assertEqual(deploy.main("test", root), int(mismatch))
                if mismatch:
                    activate.assert_not_called()
                else:
                    activate.assert_called_once()
                self.assertEqual((data / "obsolete-result.json").read_text(), '{"passed":false}')


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


    def test_launcher_enrollment_is_confirmed_on_chain_without_creating_a_game(self):
        events = []
        manifest = {"shard": {"chainId": "0x123"}}
        def service(_, action, payload):
            events.append(action)
            return {"chainId": "0x123", "launcherAccount": "0x42"}
        with (
            patch.object(deploy, "deployed_facts", return_value=(manifest, {})),
            patch.object(deploy, "launcher_service", side_effect=service),
            patch.object(deploy, "service_role_check", side_effect=lambda *args: events.append("handoff")),
            patch.object(deploy.shard, "write_json"),
        ):
            deploy.confirm_worker_launcher({"public_herald_url": "https://herald.test", "presets": [5]}, Path("/unused"))
        self.assertEqual(events, ["enrol", "handoff"])


    def test_relay_enrollment_pins_chain_and_uses_the_ledger_role_setter(self):
        manifest = {"shard": {"chainId": "0x123"}}
        config = {"guardian_url": "https://id.test/api/guardian", "public_herald_url": "https://herald.test"}
        for chain, valid in [("0x123", True), ("0x999", False)]:
            with patch.object(deploy, "deployed_facts", return_value=(manifest, {})), \
                    patch.object(deploy, "service_json", return_value={"chainId": chain, "ledgerOperatorAccount": "0x42"}) as request, \
                    patch.object(deploy, "service_role_check") as role:
                if valid:
                    deploy.confirm_worker_ledger_operator(config, Path("/unused"))
                    role.assert_called_once_with(Path("/unused"), "0x42", role="ledger_operator")
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
                    (data / "obsolete-result.json").write_text('{"passed":true}')
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
            (3, [{**own, "status": "retired"}], {"refused": "remove the run directory yourself"}, False),
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


class ChainIdentityTest(unittest.TestCase):
    def test_restarts_keep_identity_and_fresh_chains_get_distinct_felts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = deploy.chain_identity(root, "dev")
            second = deploy.chain_identity(root, "dev")
            self.assertNotEqual(first, second)
            self.assertLessEqual(len(first.encode("ascii")), 31)
            (root / ".env").write_text(f"CHAIN_ID={first}\n")
            self.assertEqual(deploy.chain_identity(root, "dev"), first)
