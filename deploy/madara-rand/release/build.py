#!/usr/bin/env python3
"""Build the selected node revision with its upstream Dockerfile and build caches."""

import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile
from build_tools import digest, prepare_source, read, run


def prepare_contract_artifacts(source, output):
    version_file = (source / '.artifact-versions.yml').read_text()
    match = re.search(r'^current_version:\s*(\d+)\s*$', version_file, re.MULTILINE)
    if not match:
        raise SystemExit('missing upstream artifact version')
    repository = 'ghcr.io/madara-alliance/artifacts'
    tag = f'{repository}:{match[1]}'
    run(['docker', 'pull', tag], output / 'artifacts.log')
    image = json.loads(read(['docker', 'image', 'inspect', tag]))[0]
    pinned = next(value for value in image['RepoDigests'] if value.startswith(f'{repository}@sha256:'))
    container = read(['docker', 'create', pinned, 'true'])
    archive = output / 'artifacts.tar.gz'
    try:
        run(['docker', 'cp', f'{container}:/artifacts.tar.gz', str(archive)], output / 'artifact-copy.log')
    finally:
        subprocess.run(['docker', 'rm', container], check=True, stdout=subprocess.DEVNULL)
    with tarfile.open(archive) as bundle:
        for member in bundle.getmembers():
            if not (source / member.name).resolve().is_relative_to(source / 'build-artifacts'):
                raise SystemExit(f'unexpected upstream artifact path: {member.name}')
        bundle.extractall(source, filter='data')
    return {'version': int(match[1]), 'image': pinned, 'archive_sha256': digest(archive)}


def build_image(source, output, revision, builder):
    tag = f'athanor-madara:{revision}'
    command = ['docker', 'buildx', 'build', '--builder', builder, '--load',
               '--file', str(source / 'madara/Dockerfile'), '--build-arg', 'CARGO_FEATURES=sequencer-randomness',
               '--metadata-file', str(output / 'build-metadata.json'), '--tag', tag, str(source)]
    run(command, output / 'build.log')
    image = json.loads(read(['docker', 'image', 'inspect', tag]))[0]['Id']
    container = read(['docker', 'create', image])
    compiler_lock = output / 'native-compiler-Cargo.lock'
    try:
        run(['docker', 'cp', f'{container}:/usr/share/madara/native-compiler-Cargo.lock', str(compiler_lock)],
            output / 'compiler-inventory.log')
    finally:
        subprocess.run(['docker', 'rm', container], check=True, stdout=subprocess.DEVNULL)
    return image, command


def main():
    if len(sys.argv) != 5:
        raise SystemExit('usage: build.py MADARA_REPOSITORY REVISION BUILDX_BUILDER OUTPUT_DIRECTORY')
    repository = Path(sys.argv[1]).resolve()
    revision = read(['git', 'rev-parse', '--verify', f'{sys.argv[2]}^{{commit}}'], repository)
    output = Path(sys.argv[4]).resolve()
    output.mkdir(parents=True, exist_ok=False)
    source = output / 'source'
    source.mkdir()
    prepare_source(repository, revision, source)
    artifacts = prepare_contract_artifacts(source, output)
    protocol = source / 'madara/crates/client/sequencer-randomness/src/protocol.rs'
    version = re.search(r'^pub const ENVELOPE_VERSION: u64 = (\d+);$', protocol.read_text(), re.MULTILINE)
    if not version:
        raise SystemExit('missing authoritative envelope version')
    image, command = build_image(source, output, revision, sys.argv[3])
    manifest = {'schema': 2, 'revision': revision, 'image': image, 'profile': 'release',
                'features': ['sequencer-randomness'], 'envelope_version': int(version[1]),
                'contract_artifacts': artifacts, 'command': command,
                'cargo_lock_sha256': digest(source / 'Cargo.lock'),
                'native_compiler_lock_sha256': digest(output / 'native-compiler-Cargo.lock')}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'image.env').write_text(f'MADARA_IMAGE={image}\n')
    print(json.dumps({'manifest': str(output / 'manifest.json'), 'image': image}))


if __name__ == '__main__':
    main()
