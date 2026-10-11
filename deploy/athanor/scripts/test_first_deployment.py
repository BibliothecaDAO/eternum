import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('first_box', Path(__file__).parents[2] / 'first/box-deploy.py')
first = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(first)


class FirstDeploymentTest(unittest.TestCase):
    def test_existing_shard_is_drained_stopped_then_retired_without_removing_volumes(self):
        actions = []
        config = {'guardian_url': 'https://identity.test/api/guardian', 'public_herald_url': 'https://herald.test', 'chain_id': 'NEW'}

        def service(url, payload=None):
            if payload:
                actions.append(payload['status'])
                return payload
            return {'shards': [{'url': 'https://herald.test', 'status': 'active', 'chainId': '0x123'}]}

        def run(command, **kwargs):
            self.assertNotIn('--volumes', command)
            self.assertEqual(command[-1], 'down')
            actions.append('stop')

        with patch.object(first, 'occupying_projects', return_value=['/old-shard']), patch.object(first, 'service_json', side_effect=service), patch.object(first.subprocess, 'run', side_effect=run):
            first.retire_previous(config, Path('/new-shard'))
        self.assertEqual(actions, ['draining', 'stop', 'retired'])

    def test_current_project_is_not_stopped_and_an_unrelated_container_is_refused(self):
        containers = json.dumps({'ID': 'abc', 'Ports': '127.0.0.1:8080->8080/tcp'})
        detail = json.dumps([{'Config': {'Labels': {'com.docker.compose.project.working_dir': '/new-shard'}}}])
        with patch.object(first.subprocess, 'check_output', side_effect=[containers, detail]):
            self.assertEqual(first.occupying_projects(Path('/new-shard')), [])
        with patch.object(first.subprocess, 'check_output', side_effect=[containers, '[{"Config":{"Labels":{}}}]']):
            with self.assertRaisesRegex(ValueError, 'not stopped'):
                first.occupying_projects(Path('/new-shard'))

    def test_resume_after_old_compose_stopped_still_retires_its_directory_entry(self):
        config = {'guardian_url': 'https://identity.test/api/guardian', 'public_herald_url': 'https://herald.test', 'chain_id': 'NEW'}
        with patch.object(first, 'occupying_projects', return_value=[]), patch.object(first, 'service_json', side_effect=[{'shards':[{'url':'https://herald.test','chainId':'0x123','status':'draining'}]}, {}]) as request:
            first.retire_previous(config, Path('/new-shard'))
        self.assertEqual(request.call_args.args[1]['status'], 'retired')

    def test_current_chain_is_not_retired_on_rerun(self):
        config = {'guardian_url': 'https://identity.test/api/guardian', 'public_herald_url': 'https://herald.test', 'chain_id': 'NEW'}
        with patch.object(first, 'occupying_projects', return_value=[]), patch.object(first, 'service_json', return_value={'shards':[{'url':'https://herald.test','chainId':hex(int.from_bytes(b'NEW','big')),'status':'active'}]}) as request:
            first.retire_previous(config, Path('/new-shard'))
        self.assertEqual(request.call_count, 1)
