import unittest

from candidate_guard import over_budget, unmeasured_budgets


class LiveHealthTests(unittest.TestCase):
    def setUp(self):
        self.budget = {
            "max_lag_blocks": 3, "max_health_ms": 500,
            "digest_p95_ms": {"confirmed": 250, "preconfirmed": 50},
            "min_candidate_free_bytes": 10, "min_host_free_bytes": 100,
        }
        self.health = {"lag_blocks": 1, "health_ms": 12}

    def test_each_sample_lists_every_budget_it_exceeded(self):
        pre = lambda count, p95=0: {"kind": "preconfirmed", "count": count, "p95Ms": p95}
        confirmed = lambda count, p95=0: {"kind": "confirmed", "count": count, "p95Ms": p95}
        self.assertEqual(over_budget(self.budget, self.health, [pre(2, 10), confirmed(30, 250)], 20, 200), [])
        self.assertEqual(over_budget(self.budget, self.health, [pre(2, 51), confirmed(30, 251)], 20, 200),
                         ["live preconfirmed p95", "live confirmed p95"])
        self.assertEqual(over_budget(self.budget, self.health, [pre(0), confirmed(0)], 20, 200), [])
        self.assertEqual(over_budget(self.budget, {"lag_blocks": 4, "health_ms": 501}, [], 9, 99), [
            "live Herald lag", "live health response latency", "candidate disk reserve", "host disk reserve",
        ])

    def test_live_windows_without_preconfirmed_samples_are_unmeasured(self):
        empty = [{"kind": "preconfirmed", "count": 0}, {"kind": "confirmed", "count": 30, "p95Ms": 100}]
        self.assertEqual(over_budget(self.budget, self.health, empty, 20, 200), [])
        self.assertEqual(unmeasured_budgets(empty), ["live preconfirmed p95"])
        sampled = [{"kind": "preconfirmed", "count": 30, "p95Ms": 20}, {"kind": "confirmed", "count": 30, "p95Ms": 100}]
        self.assertEqual(unmeasured_budgets(sampled), [])
        self.assertEqual(unmeasured_budgets([]), [])


if __name__ == "__main__":
    unittest.main()
