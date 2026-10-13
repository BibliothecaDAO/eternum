import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import shard


class BuildImagesTest(unittest.TestCase):
    def test_build_uses_committed_sources_locked_cairo_and_local_image_ids(self):
        commands = []
        digest = 'sha256:' + '1' * 64
        def run(args, **kwargs):
            commands.append(args)
            if args[:2] == ['git', 'archive']:
                kwargs['stdout'].write(b'committed source')
            else:
                self.assertEqual(kwargs['stdin'].read(), b'committed source')
                Path(args[args.index('--iidfile') + 1]).write_text(digest)
        with tempfile.TemporaryDirectory() as temporary, \
                patch.object(shard.Path, 'home', return_value=Path(temporary)), \
                patch.object(shard, 'read', return_value='a' * 40), \
                patch.object(shard.fcntl, 'flock') as lock, \
                patch.object(shard.subprocess, 'run', side_effect=run), \
                patch.object(shard.subprocess, 'check_output', return_value=json.dumps({'classes': {'account': '0x1'}})) as facts:
            result = shard.build_images()
            lock.assert_called_once()
            self.assertEqual(lock.call_args.args[1], shard.fcntl.LOCK_EX)
            self.assertTrue((Path(temporary) / 'cairo-suite/.lock').exists())
        self.assertEqual(result['commit'], 'a' * 40)
        self.assertEqual(result['images'], dict.fromkeys(('init', 'herald', 'metrics'), digest))
        self.assertNotIn('tag', result)
        self.assertIn('@sha256:', result['node'])
        self.assertEqual([cmd for cmd in commands if cmd[:2] == ['git', 'archive']], [
            ['git', 'archive', 'HEAD'], ['git', 'archive', 'HEAD'],
            ['git', 'archive', 'HEAD:deploy/athanor/metrics']])
        for build in commands[1::2]:
            self.assertIn('--load', build)
            self.assertIn('SHARD_REVISION=' + 'a' * 40, build)
            self.assertNotIn('--push', build)
        self.assertIn('/release/release-facts.json', facts.call_args.args[0])

    def test_cairo_layers_precede_application_source_and_pin_the_compiler(self):
        dockerfile = (shard.ROOT / 'deploy/shard/Dockerfile').read_text()
        contracts = dockerfile.split(' AS contracts\n', 1)[1].split('FROM contracts AS build', 1)[0]
        self.assertNotIn('COPY . .', contracts)
        builds = [line for line in contracts.splitlines() if 'scarb" build' in line]
        self.assertEqual(len(builds), 3)
        self.assertTrue(all('taskset -c 8-11' in line for line in builds))
