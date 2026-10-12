import unittest
import io
import json
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
                patch.object(revision, 'require_landing_run', side_effect=revision.RevisionRefused('successful validation push') if gate else None) as run:
            result = revision.deployment_revision(environment)
            if environment == 'dev':
                run.assert_not_called()
            else:
                run.assert_called_once_with(result)
            return result

    def test_dev_accepts_a_pushed_branch_without_landing_validation(self):
        self.assertEqual(self.check(), 'a' * 40)

    def test_pushed_commit_is_accepted_despite_uncommitted_workspace_files(self):
        self.assertEqual(self.check(dirty=" M file"), "a" * 40)

    def test_unpushed_commit_is_refused(self):
        with self.assertRaisesRegex(revision.RevisionRefused, "Push this checkout"):
            self.check(refs="")

    def test_production_requires_next_and_the_existing_push_gate(self):
        with self.assertRaisesRegex(revision.RevisionRefused, 'on origin/next'):
            self.check('production')
        with self.assertRaisesRegex(revision.RevisionRefused, 'successful validation push'):
            self.check('production', refs='refs/remotes/origin/next', gate=1)
        self.assertEqual(self.check('production', refs='refs/remotes/origin/next'), 'a' * 40)


class LandingValidationTest(unittest.TestCase):
    def test_only_green_push_on_next_at_the_exact_commit_passes(self):
        head = 'a' * 40
        valid = {'head_sha': head, 'event': 'push', 'head_branch': 'next', 'conclusion': 'success', 'id': 42}
        cases = ({}, {'event': 'pull_request'}, {'head_branch': 'fix'}, {'head_sha': 'b' * 40},
                 {'conclusion': 'failure'}, {'conclusion': None}, {'conclusion': 'cancelled'})
        for changes in cases:
            with self.subTest(changes=changes), patch.object(revision, 'urlopen', return_value=io.BytesIO(
                    json.dumps({'workflow_runs': [{**valid, **changes}]}).encode())) as request:
                if changes:
                    message = 'gh run rerun 42' if changes.get('conclusion') == 'cancelled' else 'successful validation push'
                    with self.assertRaisesRegex(revision.RevisionRefused, message):
                        revision.require_landing_run(head)
                else:
                    revision.require_landing_run(head)
                self.assertIn('head_sha=' + head, request.call_args.args[0].full_url)
                self.assertIsNone(request.call_args.args[0].get_header('Authorization'))

    def test_unavailable_validation_never_passes(self):
        with patch.object(revision, 'urlopen', side_effect=OSError('unavailable')):
            with self.assertRaisesRegex(revision.RevisionRefused, 'status is unavailable'):
                revision.require_landing_run('a' * 40)
