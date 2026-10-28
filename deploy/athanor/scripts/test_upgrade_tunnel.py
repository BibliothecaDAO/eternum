from pathlib import Path
import subprocess
import unittest

UPGRADE = Path(__file__).resolve().parents[1] / "host/upgrade-tunnel.sh"

# The box, faked: the package installs NEW, the main connector runs MAIN with MAIN_CONNECTIONS registered, and a
# restart loads the package with all four connections unless RESTART_FAILS. Every host action prints one "call:"
# line, so a test reads the order of actions.
FAKE_BOX = '''
id() { echo 0; }
sleep() { :; }
dpkg-query() { echo "$INSTALLED"; }
apt-get() { echo "call: apt-get $*"; [ "$1" = install ] && INSTALLED=$NEW; return 0; }
systemd-run() { echo "call: systemd-run $2"; REPLICA_UP=1; }
systemctl() {
  case "$1" in
    is-active) [ "$3" = cloudflared-replica ] && [ -n "$REPLICA_UP" ] ;;
    restart) echo "call: restart $2"; if [ -n "$RESTART_FAILS" ]; then MAIN=; else MAIN=$INSTALLED MAIN_CONNECTIONS=4; fi ;;
    stop) echo "call: stop $2"; REPLICA_UP= ;;
  esac
}
curl() {
  local url=${!#} version=$MAIN connections=$MAIN_CONNECTIONS
  case "$url" in *20242*) version=${REPLICA_UP:+$INSTALLED} connections=4 ;; esac
  [ -n "$version" ] || return 7
  case "$url" in
    */ready) echo "{\\"status\\":200,\\"readyConnections\\":$connections}" ;;
    */metrics) echo "build_info{goversion=\\"go\\",version=\\"$version\\"} 1" ;;
  esac
}
'''


def run_upgrade(main, new, replica_up="", restart_fails="", main_connections=4):
    script = f'''source "$1"
{FAKE_BOX}
INSTALLED={main}; NEW={new}; MAIN={main}; MAIN_CONNECTIONS={main_connections}; REPLICA_UP={replica_up}
RESTART_FAILS={restart_fails}; READY_SECONDS=0
main'''
    result = subprocess.run(["bash", "-c", script, "upgrade-test", str(UPGRADE)], capture_output=True, text=True)
    calls = [line.removeprefix("call: ") for line in result.stdout.splitlines() if line.startswith("call: ")]
    return result, calls


class UpgradeTunnelTests(unittest.TestCase):
    def test_hands_traffic_to_a_replica_while_the_main_connector_restarts(self):
        result, calls = run_upgrade("2026.10.0", "2026.10.4")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls, [
            "apt-get update -q", "apt-get install -y -q cloudflared",
            "systemd-run cloudflared-replica", "restart cloudflared.service", "stop cloudflared-replica",
        ])
        self.assertIn("after: running 2026.10.4, installed 2026.10.4", result.stdout)

    def test_a_second_run_restarts_nothing(self):
        result, calls = run_upgrade("2026.10.4", "2026.10.4")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls, ["apt-get update -q", "apt-get install -y -q cloudflared"])

    def test_a_run_after_a_crash_stops_the_leftover_replica(self):
        result, calls = run_upgrade("2026.10.4", "2026.10.4", replica_up="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[-1], "stop cloudflared-replica")
        self.assertNotIn("restart cloudflared.service", calls)

    def test_a_run_after_a_crash_restarts_a_main_connector_without_connections_before_stopping_the_replica(self):
        result, calls = run_upgrade("2026.10.4", "2026.10.4", replica_up="1", main_connections=0)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls[2:], ["restart cloudflared.service", "stop cloudflared-replica"])

    def test_keeps_the_replica_serving_when_a_main_connector_without_connections_does_not_come_back(self):
        result, calls = run_upgrade("2026.10.4", "2026.10.4", replica_up="1", main_connections=0, restart_fails="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("stop cloudflared-replica", calls)

    def test_refuses_a_stale_package_before_touching_the_tunnel(self):
        result, calls = run_upgrade("2026.10.0", "2026.10.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cloudflared 2026.10.0 is older than 2026.10.2", result.stderr)
        self.assertEqual(calls, ["apt-get update -q", "apt-get install -y -q cloudflared"])

    def test_keeps_the_replica_serving_when_the_main_connector_does_not_come_back(self):
        result, calls = run_upgrade("2026.10.0", "2026.10.4", restart_fails="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("cloudflared on 127.0.0.1:20241 not ready on 2026.10.4", result.stderr)
        self.assertNotIn("stop cloudflared-replica", calls)


if __name__ == "__main__":
    unittest.main()
