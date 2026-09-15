#!/usr/bin/env python3
"""Build native Herald from a pinned archive without changing its checkout."""

import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
from build_tools import digest, read, run


def prepare_source(repository, revision, source):
    paths = ['apps/herald', 'packages/core/src', 'packages/types/src', 'pnpm-lock.yaml']
    archive = subprocess.check_output(['git', 'archive', revision, *paths], cwd=repository)
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        bundle.extractall(source, filter='data')
    if (source / 'pnpm-lock.yaml').read_bytes() != (repository / 'pnpm-lock.yaml').read_bytes():
        raise SystemExit('installed dependency lock differs from the pinned native revision')
    (source / 'node_modules').symlink_to(repository / 'node_modules', target_is_directory=True)
    (source / 'apps/herald/node_modules').symlink_to(repository / 'apps/herald/node_modules', target_is_directory=True)
    (source / 'revision.json').write_text(json.dumps({'revision': revision}) + '\n')
    # Use the public core exports consumed by Herald, without building the browser entrypoints.
    (source / 'herald-game-sync.ts').write_text('\n'.join([
        'export { hasGameEnded } from "./packages/core/src/sync/game-lifecycle";',
        'export { calculateUnregisteredShareholderPoints } from "./packages/core/src/sync/shareholder-points";',
        'export { createEmptyActivityBreakdown, readPointsRegistration } from "./packages/core/src/sync/leaderboard-activity";',
        'export { parseStoryHistoryCursor, endOfStoryBlock } from "./packages/core/src/sync/story-history-cursor";', '',
    ]))
    aliases = {
        '@bibliothecadao/eternum/game-sync-models': [str(source / 'packages/core/src/sync/model-manifest.ts')],
        '@bibliothecadao/eternum/game-sync': [str(source / 'herald-game-sync.ts')],
        '@bibliothecadao/types': [str(source / 'packages/types/src/types/common.ts')],
    }
    (source / 'herald-build-tsconfig.json').write_text(json.dumps({'compilerOptions': {'paths': aliases}}, indent=2) + '\n')


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: build-herald.py NATIVE_REVISION MADARA_RELEASE OUTPUT_DIRECTORY')
    release = Path(__file__).resolve().parent
    repository = release.parents[2]
    revision = read(['git', 'rev-parse', '--verify', f'{sys.argv[1]}^{{commit}}'], repository)
    madara_release = Path(sys.argv[2]).resolve()
    image = json.loads((madara_release / 'manifest.json').read_text())['image']
    if not image.startswith('127.0.0.1:15000/madara-rand@sha256:'):
        raise SystemExit('expected the local patched node digest')
    output = Path(sys.argv[3]).resolve()
    output.mkdir(parents=True, exist_ok=False)
    source = output / 'source'
    source.mkdir()
    prepare_source(repository, revision, source)
    command = ['bun', 'build', '--tsconfig-override', 'herald-build-tsconfig.json', 'apps/herald/src/server.ts',
               '--compile', f'--metafile={output / "modules.json"}', '--outfile', str(output / 'herald')]
    run(command, output / 'compile.log', source)
    tag = f'127.0.0.1:15000/randomness-herald:{revision}'
    run(['docker', 'build', '-f', str(release / 'Herald.Dockerfile'), '--build-arg', f'MADARA_IMAGE={image}',
         '-t', tag, str(output)], output / 'image-build.log', repository)
    run(['docker', 'push', tag], output / 'image-push.log', repository)
    digests = json.loads(read(['docker', 'image', 'inspect', tag]))[0]['RepoDigests']
    image_digest = next(value for value in digests if value.startswith('127.0.0.1:15000/randomness-herald@sha256:'))
    manifest = {'schema': 1, 'scope': 'isolated native Herald build', 'native_revision': revision,
                'madara_image': image, 'image': image_digest, 'bun_version': read(['bun', '--version']), 'command': command,
                'binary_sha256': digest(output / 'herald'),
                'module_graph_sha256': digest(output / 'modules.json'),
                'dependency_lock_sha256': digest(repository / 'pnpm-lock.yaml'),
                'native_source_lock_sha256': digest(source / 'pnpm-lock.yaml')}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'image.env').write_text(f'HERALD_IMAGE={image_digest}\n')
    print(json.dumps({'manifest': str(output / 'manifest.json'), 'image': image_digest}))


if __name__ == '__main__':
    main()
