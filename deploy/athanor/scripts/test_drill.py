import calendar
import unittest

from drill import duplicates_and_gaps, in_flight_outcomes


def execution(game, actor, nonce, order, consumed=1, status=1):
    return (1, [game, actor, nonce, consumed, order, status, 0])


class DrillTests(unittest.TestCase):
    def test_a_clean_chain_passes_and_every_double_or_gap_is_named(self):
        clean = [execution(1, 10, 0, 1), execution(1, 11, 0, 2), execution(2, 10, 0, 1)]
        self.assertEqual(duplicates_and_gaps(clean), [])
        # A rejected ticket consumes its nonce too; an unconsumed one may be retried under the same nonce.
        retried = [execution(1, 10, 0, 1, consumed=0, status=2), execution(1, 10, 0, 2)]
        self.assertEqual(duplicates_and_gaps(retried), [])
        doubled = clean + [execution(1, 12, 0, 2), execution(1, 10, 0, 3), execution(2, 10, 1, 3)]
        self.assertEqual(duplicates_and_gaps(doubled), [
            "game 1 order 2 recorded twice",
            "game 1 actor 0xa nonce 0 consumed twice",
            "game 2 is missing orders [2]",
        ])

    def test_only_tickets_open_across_the_signal_count_as_in_flight(self):
        actions = [
            {"submitStartedAt": "2026-09-24T12:00:01.000Z", "submittedAt": "2026-09-24T12:00:02.000Z",
             "outcome": "completed"},
            {"submitStartedAt": "2026-09-24T12:00:09.000Z", "submittedAt": "2026-09-24T12:00:15.000Z",
             "outcome": "completed"},
            {"submitStartedAt": "2026-09-24T12:00:09.500Z", "outcome": "submit_failed", "error": "outcome unknown"},
            {"submitStartedAt": "2026-09-24T12:00:11.000Z", "submittedAt": "2026-09-24T12:00:12.000Z",
             "outcome": "completed"},
        ]
        signalled_ms = calendar.timegm((2026, 9, 24, 12, 0, 10)) * 1000
        self.assertEqual(in_flight_outcomes(actions, signalled_ms), {
            "inFlight": 2, "recoveredAndRecorded": 1, "lost": 1, "lostReasons": ["outcome unknown"],
        })


if __name__ == "__main__":
    unittest.main()
