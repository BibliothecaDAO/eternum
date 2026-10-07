import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import deploy


def release():
    return {"tag": "shard-v1.0.0", "commit": "abc", "releaseId": 1, "schema": "0xs", "migrationClassHash": "0x0",
            "classes": {"games": "0x1", "logic": {"Season": "0x2", "Map": "0x3"}, "account": "0x4"},
            "presets": {"2": "0x20", "5": "0x50", "101": "0x65"}}


def deployed():
    manifest = {"native": {"releaseId": 1, "activeSchema": "0xs", "gamesClassHash": "0x01", "migrationClassHash": "0x0",
                           "logic": {"Season": "0x2", "Map": "0x3"}},
                "shard": {"accountClassHash": "0x4"}}
    return manifest, {"presets": {"2": "0x20", "5": "0x050"}}


class DeployTest(unittest.TestCase):
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
                  "public_admission_url": "https://admission.staging.test", "node_memory": "8g", "herald_memory": "6g"}
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
    def test_initialization_needs_the_operator_token_it_will_receive_or_an_enrolment_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            # A token this shell holds but Compose would not pass renders as null.
            with self.assertRaisesRegex(ValueError, "no OPERATOR_TOKEN"):
                deploy.check_operator_approval(directory, {"OPERATOR_TOKEN": None})
            deploy.check_operator_approval(directory, {"OPERATOR_TOKEN": "secret"})
            (directory / "data").mkdir()
            (directory / "data" / "operator-enrolment.json").write_text("{}")
            deploy.check_operator_approval(directory, {})

    def test_the_package_passes_the_operator_token_through_sudo(self):
        preserved = [flag for flag in deploy.compose(Path("/srv/shard")) if flag.startswith("--preserve-env=")]
        self.assertIn("OPERATOR_TOKEN", preserved[0].removeprefix("--preserve-env=").split(","))


if __name__ == "__main__":
    unittest.main()
