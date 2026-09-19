import unittest
from unittest.mock import patch

from candidate_guard import budget_failures, pause_candidate


class CandidateGuardTests(unittest.TestCase):
    def setUp(self):
        self.budget = {
            "max_lag_blocks": 3, "max_health_ms": 500,
            "digest_p95_ms": {"confirmed": 250, "preconfirmed": 50},
            "min_candidate_free_bytes": 10, "min_host_free_bytes": 100,
        }
        self.health = {"lag_blocks": 1, "health_ms": 12}

    def test_healthy_live_stack_keeps_candidate_running(self):
        self.assertEqual(budget_failures(self.budget, self.health, [], 20, 200), [])

    def test_live_latency_exceedance_stops_candidate(self):
        for kind, value in (("confirmed", 251), ("preconfirmed", 51)):
            with self.subTest(kind=kind):
                result = budget_failures(self.budget, self.health, [
                    {"kind": kind, "count": 1, "p95Ms": value},
                ], 20, 200)
                self.assertEqual(result, [f"live {kind} p95"])

    def test_empty_latency_digest_is_not_a_measurement(self):
        result = budget_failures(self.budget, self.health, [
            {"kind": "preconfirmed", "count": 0, "p95Ms": 999},
        ], 20, 200)
        self.assertEqual(result, [])

    def test_lag_health_and_disk_exceedance(self):
        result = budget_failures(self.budget, {"lag_blocks": 4, "health_ms": 501}, [], 9, 99)
        self.assertEqual(result, ["live Herald lag", "live health response latency",
                                  "candidate disk reserve", "host disk reserve"])

    def test_pause_targets_only_candidate_slice(self):
        with patch("candidate_guard.subprocess.run") as run:
            pause_candidate(["live Herald lag"])
        run.assert_called_once_with(["systemctl", "freeze", "athanor.slice"], check=True, timeout=10)


if __name__ == "__main__":
    unittest.main()
