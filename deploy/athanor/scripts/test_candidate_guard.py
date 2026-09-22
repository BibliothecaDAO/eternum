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

    def test_latency_requires_two_consecutive_nonempty_windows_per_stream(self):
        streaks = {}
        windows = [
            ([], []),
            ([{"kind": "confirmed", "count": 30, "p95Ms": 251}], []),
            ([], []),
            ([{"kind": "confirmed", "count": 30, "p95Ms": 250}], []),
            ([{"kind": "confirmed", "count": 30, "p95Ms": 251},
              {"kind": "preconfirmed", "count": 2, "p95Ms": 51}], []),
            ([{"kind": "confirmed", "count": 0, "p95Ms": 0}], []),
            ([{"kind": "confirmed", "count": 30, "p95Ms": 251}], ["live confirmed p95"]),
            ([{"kind": "confirmed", "count": 30, "p95Ms": 250},
              {"kind": "preconfirmed", "count": 2, "p95Ms": 51}], ["live preconfirmed p95"]),
        ]
        for digests, expected in windows:
            with self.subTest(digests=digests):
                self.assertEqual(budget_failures(self.budget, self.health, digests, 20, 200, streaks), expected)

    def test_lag_health_and_disk_exceedance_requires_two_windows_and_resets(self):
        streaks = {}
        unhealthy = {"lag_blocks": 4, "health_ms": 501}
        self.assertEqual(budget_failures(self.budget, unhealthy, [], 9, 99, streaks), [])
        self.assertEqual(budget_failures(self.budget, unhealthy, [], 9, 99, streaks), [
            "live Herald lag", "live health response latency", "candidate disk reserve", "host disk reserve",
        ])
        self.assertEqual(budget_failures(self.budget, self.health, [], 20, 200, streaks), [])
        self.assertEqual(budget_failures(self.budget, unhealthy, [], 9, 99, streaks), [])

    def test_pause_targets_only_candidate_slice(self):
        with patch("candidate_guard.subprocess.run") as run:
            pause_candidate(["live Herald lag"])
        run.assert_called_once_with(["systemctl", "freeze", "athanor.slice"], check=True, timeout=10)


if __name__ == "__main__":
    unittest.main()
