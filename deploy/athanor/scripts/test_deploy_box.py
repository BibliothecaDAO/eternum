"""Hermetic deploy recipe tests: real Git history, simulated host commands."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("deploy-box.sh")
REF = "refs/deployments/box"
SERVICES = {"herald", "realms-identity", "realms-launch", "realms-chat"}


class DeployBoxTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.caller = self.root / "caller"
        self.caller.mkdir()
        self.repo.mkdir()
        self.events = self.root / "commands.log"
        self.restarts = self.root / "restarts.log"
        self.pnpm_calls = self.root / "pnpm.log"
        self.bin = self.root / "bin"
        self.install_fake_pnpm()
        self.git("init", "-b", "next")
        self.git("config", "user.name", "Deploy test")
        self.git("config", "user.email", "deploy-test@example.invalid")
        (self.repo / "package.json").write_text("{}\n")
        planner = self.repo / "deploy/athanor/scripts/deploy-box-plan.mjs"
        planner.parent.mkdir(parents=True)
        shutil.copy2(SCRIPT.with_name("deploy-box-plan.mjs"), planner)
        importers = {".": {}, "packages/types": {}, "config": {}}
        for app in ["herald", "realms", "launch-service", "realtime-server"]:
            importers[f"apps/{app}"] = {"dependencies": {"types": {"version": "link:../../packages/types"}}}
        importers["apps/game"] = {"dependencies": {"three": {"version": "1.0.0"}}}
        self.lock = {"importers": importers, "snapshots": {"three@1.0.0": {}}, "packages": {"three@1.0.0": {}}}
        importers["apps/realtime-server"]["dependencies"]["gateway"] = {"version": "1.0.0"}
        self.lock["snapshots"].update({
            "gateway@1.0.0": {"dependencies": {"transport": "@service/transport@1.0.0"}},
            "@service/transport@1.0.0": {},
        })
        self.lock["packages"].update({
            "gateway@1.0.0": {},
            "@service/transport@1.0.0": {"resolution": {"integrity": "original"}},
        })
        self.write_lock()
        self.git("add", "package.json", "pnpm-lock.yaml", "deploy/athanor/scripts/deploy-box-plan.mjs")
        self.git("commit", "-m", "Initial deployment")
        self.base = self.git("rev-parse", "HEAD")
        self.git("init", "--bare", str(self.root / "remote"))
        self.git("remote", "add", "origin", str(self.root / "remote"))
        self.git("update-ref", REF, self.base)
        self.target = self.commit_change("apps/realtime-server/change.txt")
        self.git("push", "-u", "origin", "next")
        self.git("checkout", "--detach", self.base)

    def install_fake_pnpm(self):
        # `env DATABASE_SSL=false pnpm ...` needs an executable, not a shell function.
        self.bin.mkdir()
        pnpm = self.bin / "pnpm"
        pnpm.write_text(r'''#!/usr/bin/env bash
printf '%s:%s\n' "${DATABASE_SSL:-unset}" "$*" >> "$TEST_PNPM_CALLS"
if [[ " $* " == *" install "* && "${TEST_INSTALL_FAIL:-0}" == 1 ]]; then
  echo 'pnpm install failed' >&2
  exit 243
fi
''')
        pnpm.chmod(0o755)

    def git(self, *args):
        return subprocess.check_output(
            ["git", "-C", str(self.repo), *args], stderr=subprocess.DEVNULL, text=True
        ).strip()

    def commit_change(self, path):
        file = self.repo / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text("changed\n")
        self.git("add", path)
        self.git("commit", "-m", "Change service input")
        return self.git("rev-parse", "HEAD")

    def write_lock(self):
        (self.repo / "pnpm-lock.yaml").write_text(json.dumps(self.lock))

    def deploy(self, **settings):
        recipe = SCRIPT.read_text().removesuffix('main "$@"\n')
        harness = recipe + r'''
REPO_DIR="$TEST_REPO"
HEALTH_TIMEOUT_SECONDS=0
id() { echo 0; }
sudo() {
  shift 4 # -u realms env PATH=...; preserve the recipe's actual working directory.
  printf '%s\n' "$PWD" >> "$TEST_COMMANDS"
  "$@"
}
systemctl() { echo "$2" >> "$TEST_RESTARTS"; }
curl() { echo "${TEST_HEALTH_CODE:-200}"; }
main
'''
        env = {
            **os.environ,
            "PATH": f"{self.bin}{os.pathsep}{os.environ['PATH']}",
            "TEST_REPO": str(self.repo),
            "TEST_COMMANDS": str(self.events),
            "TEST_RESTARTS": str(self.restarts),
            "TEST_PNPM_CALLS": str(self.pnpm_calls),
            **settings,
        }
        checker = SCRIPT.with_name("validate-native-target.mjs")
        shutil.copy2(checker, self.root / checker.name)
        manifest = self.root / "native.json"
        manifest.write_text(json.dumps({"world": {"address": "0x1"}, "native": {
            "version": 1, "activeSchema": "test", "schemas": {"test": {"identity": "test", "domains": {"season": {}, "registry": {}}}},
            "domains": {"season": {"address": "0x1"}, "registry": {"address": "0x2"}}}}))
        env.setdefault("NATIVE_WORLD_MANIFEST", str(manifest))
        env.setdefault("ADMISSION_URL", "http://127.0.0.1:15081")
        script = self.root / "recipe.sh"
        script.write_text(harness)
        result = subprocess.run(
            ["bash", str(script)], cwd=self.caller, env=env, capture_output=True, text=True
        )
        self.assertTrue(result.stdout.strip(), result.stderr)
        payload = json.loads(result.stdout.strip().splitlines()[-1])
        return result, payload

    def test_missing_native_target_stops_before_fetch_or_checkout(self):
        result, payload = self.deploy(NATIVE_WORLD_MANIFEST="")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(payload["step"], "require_native_target")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)
        self.assertFalse(self.events.exists())
        self.assertFalse(self.restarts.exists())

    def test_failed_install_retries_from_last_success_even_after_checkout_advanced(self):
        result, payload = self.deploy(TEST_INSTALL_FAIL="1")
        self.assertEqual(result.returncode, 243)
        self.assertEqual(payload["step"], "install_workspace")
        self.assertEqual(self.git("rev-parse", "HEAD"), self.target)
        self.assertEqual(self.git("rev-parse", REF), self.base)
        self.assertFalse(self.restarts.exists())
        self.assertEqual(set(self.events.read_text().splitlines()), {str(self.repo)})

        result, payload = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(payload["status"], "ok")
        self.assertEqual(payload["restarted"], ["realms-chat"])
        self.assertEqual(self.git("rev-parse", REF), self.target)
        result, payload = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(payload["status"], "noop")
        self.assertEqual(self.restarts.read_text().splitlines(), ["realms-chat"])

    def test_missing_checkpoint_establishes_every_service(self):
        self.git("update-ref", "-d", REF)
        result, payload = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(set(payload["restarted"]), SERVICES)
        self.assertEqual(self.git("rev-parse", REF), self.target)
        self.assertIn(
            f"false:--dir {self.repo} --filter @realms-world/db push",
            self.pnpm_calls.read_text().splitlines(),
        )

    def test_failed_health_does_not_mark_checkout_as_deployed(self):
        result, payload = self.deploy(TEST_HEALTH_CODE="503")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(payload["step"], "health")
        self.assertEqual(self.git("rev-parse", REF), self.base)

    def test_shared_package_inputs_restart_chat_too(self):
        self.git("checkout", "next")
        self.target = self.commit_change("packages/types/change.txt")
        self.git("push", "origin", "next")
        result, payload = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(set(payload["restarted"]), SERVICES)

    def test_game_only_lock_change_skips_host_restarts(self):
        self.git("checkout", "next")
        self.git("update-ref", REF, self.target)
        self.lock["importers"]["apps/game"]["dependencies"]["three"]["version"] = "2.0.0"
        self.lock["snapshots"]["three@2.0.0"] = {}
        self.lock["packages"]["three@2.0.0"] = {}
        self.write_lock()
        self.git("add", "pnpm-lock.yaml")
        self.git("commit", "-m", "Game-only dependency update")
        self.git("push", "origin", "next")
        result, payload = self.deploy(TEST_INSTALL_FAIL="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(payload["restarted"], [])
        self.assertFalse(self.restarts.exists())

    def test_launch_config_restarts_only_launch(self):
        self.git("checkout", "next")
        self.git("update-ref", REF, self.target)
        self.commit_change("config/deployer/runner.ts")
        self.git("push", "origin", "next")
        result, payload = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(payload["restarted"], ["realms-launch"])

    def test_transitive_dependency_change_restarts_only_its_consumer(self):
        self.git("checkout", "next")
        self.git("update-ref", REF, self.target)
        self.lock["packages"]["@service/transport@1.0.0"]["resolution"]["integrity"] = "updated"
        self.write_lock()
        self.git("add", "pnpm-lock.yaml")
        self.git("commit", "-m", "Update aliased transitive dependency")
        self.git("push", "origin", "next")
        result, payload = self.deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(payload["restarted"], ["realms-chat"])


if __name__ == "__main__":
    unittest.main()
