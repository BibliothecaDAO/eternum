import unittest
from types import SimpleNamespace
from unittest.mock import patch

import revision


class RevisionTest(unittest.TestCase):
    def check(self, environment='dev', dirty='', refs='refs/remotes/origin/fix', gate=0):
        def read(*args):
            if args[:2] == ('git', 'status'):
                return dirty
            if args[:2] == ('git', 'rev-parse'):
                return 'a' * 40
            if args[:2] == ('git', 'for-each-ref'):
                return refs
            return ''
        with patch.object(revision, 'read', side_effect=read), \
                patch.object(revision.subprocess, 'run', return_value=SimpleNamespace(returncode=gate)) as run:
            result = revision.deployment_revision(environment)
            if environment == 'dev':
                run.assert_not_called()
            else:
                self.assertEqual(run.call_args.args[0], ['bash', '.github/scripts/landing-run.sh'])
                self.assertEqual(run.call_args.kwargs['env']['SHA'], result)
            return result

    def test_dev_accepts_a_pushed_branch_without_landing_validation(self):
        self.assertEqual(self.check(), 'a' * 40)

    def test_dirty_and_unpushed_checkouts_are_refused(self):
        for args, message in (({'dirty': ' M file'}, 'clean checkout'), ({'refs': ''}, 'Push this checkout')):
            with self.subTest(args=args), self.assertRaisesRegex(revision.RevisionRefused, message):
                self.check(**args)

    def test_production_requires_next_and_the_existing_push_gate(self):
        with self.assertRaisesRegex(revision.RevisionRefused, 'on origin/next'):
            self.check('production')
        with self.assertRaisesRegex(revision.RevisionRefused, 'successful validation push'):
            self.check('production', refs='refs/remotes/origin/next', gate=1)
        self.assertEqual(self.check('production', refs='refs/remotes/origin/next'), 'a' * 40)
