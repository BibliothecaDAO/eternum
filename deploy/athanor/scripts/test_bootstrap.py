import os
from pathlib import Path
import subprocess
import unittest

BOOTSTRAP = Path(__file__).resolve().parents[1] / "host/bootstrap.sh"


def run_bootstrap(script, operator=None):
    environment = {key: value for key, value in os.environ.items() if key != "OPERATOR"}
    if operator:
        environment["OPERATOR"] = operator
    return subprocess.run(["bash", "-c", script, "bootstrap-test", str(BOOTSTRAP)],
                          env=environment, capture_output=True, text=True)


class BootstrapTests(unittest.TestCase):
    def test_bootstrap_refuses_missing_operator_before_any_host_change(self):
        result = run_bootstrap('source "$1"; main')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Name the operator account", result.stderr)

    def test_bootstrap_refuses_non_root_before_installing(self):
        result = run_bootstrap('source "$1"; id() { echo 1000; }; main', "operator")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Run as root", result.stderr)

    def test_host_steps_run_in_order_with_the_operator(self):
        script = '''source "$1"
          id() { echo 0; }
          install_packages() { echo "packages:$OPERATOR"; }
          configure_firewall() { echo firewall; }
          configure_time() { echo time; }
          mount_backup() { echo backup; }
          install_slice() { echo slice; }
          create_workspace() { echo workspace; }
          install_tunnel() { echo tunnel; }
          docker() { echo "Docker version test"; }
          cloudflared() { echo "cloudflared version test"; }
          main'''
        result = run_bootstrap(script, "operator")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines()[:7], [
            "packages:operator", "firewall", "time", "backup", "slice", "workspace", "tunnel",
        ])


if __name__ == "__main__":
    unittest.main()
