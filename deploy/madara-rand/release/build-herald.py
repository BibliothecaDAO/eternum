#!/usr/bin/env python3
"""Build Herald's real workspace graph from one pinned source revision."""

import json
from pathlib import Path
import shutil
import sys
from build_tools import digest, prepare_source, read, run


def build_workspace(source, output):
    run(['pnpm', 'install', '--frozen-lockfile'], output / 'install.log', source)
    run(['pnpm', '--filter', '@bibliothecadao/herald...', 'run', 'build'], output / 'workspace-build.log', source)
    command = ['bun', 'build', 'apps/herald/src/server.ts', '--target=bun',
               f'--metafile={output / "modules.json"}', '--outfile', str(output / 'herald.js')]
    run(command, output / 'bundle.log', source)
    modules = json.loads((output / 'modules.json').read_text())
    for name in modules['inputs']:
        if not (source / name).resolve().is_relative_to(source.resolve()):
            raise SystemExit(f'bundle input escapes pinned checkout: {name}')
    return command


def build_image(source, output, revision, runtime):
    context = output / 'runtime'
    context.mkdir()
    shutil.copyfile(output / 'herald.js', context / 'herald.js')
    tag = f'athanor-herald:{revision}'
    dockerfile = source / 'deploy/madara-rand/release/Herald.Dockerfile'
    run(['docker', 'build', '-f', str(dockerfile), '--build-arg', f'BUN_IMAGE={runtime}',
         '-t', tag, str(context)], output / 'image-build.log', source)
    return json.loads(read(['docker', 'image', 'inspect', tag]))[0]['Id']


def main():
    if len(sys.argv) != 4:
        raise SystemExit('usage: build-herald.py NATIVE_REVISION BUN_RUNTIME_DIGEST OUTPUT_DIRECTORY')
    repository = Path(__file__).resolve().parents[3]
    revision = read(['git', 'rev-parse', '--verify', f'{sys.argv[1]}^{{commit}}'], repository)
    runtime = sys.argv[2]
    if '@sha256:' not in runtime:
        raise SystemExit('pin the Bun runtime image by digest')
    bun_version = read(['bun', '--version'])
    runtime_version = read(['docker', 'run', '--rm', '--network', 'none', '--entrypoint', 'bun', runtime, '--version'])
    if runtime_version != bun_version:
        raise SystemExit(f'Bun runtime {runtime_version} differs from build tool {bun_version}')
    output = Path(sys.argv[3]).resolve()
    output.mkdir(parents=True, exist_ok=False)
    source = output / 'source'
    source.mkdir()
    prepare_source(repository, revision, source)
    command = build_workspace(source, output)
    image = build_image(source, output, revision, runtime)
    manifest = {'schema': 2, 'native_revision': revision, 'image': image, 'runtime_image': runtime,
                'bun_version': bun_version, 'command': command,
                'bundle_sha256': digest(output / 'herald.js'),
                'module_graph_sha256': digest(output / 'modules.json'),
                'dependency_lock_sha256': digest(source / 'pnpm-lock.yaml')}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'image.env').write_text(f'HERALD_IMAGE={image}\n')
    print(json.dumps({'manifest': str(output / 'manifest.json'), 'image': image}))


if __name__ == '__main__':
    main()
