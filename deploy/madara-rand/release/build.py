#!/usr/bin/env python3
"""Build both node configurations and publish only to the isolated local registry."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import tomllib

BASE = 'e67432177060197bb0fb03502f2d07d1194764f5'
FSYNC = '3e6e0f472dcaa83a332aea9e092d333d6be62df5'
ARTIFACT_IMAGE = 'ghcr.io/madara-alliance/artifacts@sha256:127fe7f8191e916715af2d1ae4043b18d9d2e85c455cc65759aad065d4326708'


def read(command, directory=None):
    return subprocess.check_output(command, cwd=directory, text=True).strip()


def run(command, log, directory=None):
    with log.open('w') as stream:
        subprocess.run(command, cwd=directory, stdout=stream, stderr=subprocess.STDOUT, check=True)


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def require_revision(madara, revision):
    if read(['git', 'rev-parse', 'HEAD'], madara) != revision or read(['git', 'diff', 'HEAD', '--'], madara):
        raise SystemExit('source revision changed or tracked changes are uncommitted')
    subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, revision], cwd=madara, check=True)
    subprocess.run(['git', 'merge-base', '--is-ancestor', FSYNC, revision], cwd=madara, check=True)


def compile_binaries(madara, output, builder):
    command = [
        'docker', 'run', '--rm', '--name', 'madara-rand-release-build',
        '--mount', f'type=bind,source={madara},target=/workspace',
        '--mount', f'type=bind,source={output},target=/release',
        '--mount', f'type=bind,source={Path.home() / ".cargo/registry"},target=/usr/local/cargo/registry',
        '--mount', f'type=bind,source={Path.home() / ".cargo/git"},target=/usr/local/cargo/git',
        '--mount', 'type=volume,source=madara-rand-build-target,target=/workspace/target',
        '--mount', 'type=volume,source=madara-rand-rustup,target=/usr/local/rustup',
        '--workdir', '/workspace', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'RUSTC_WRAPPER=',
        '--env', 'RUST_BUILD_DOCKER=1', '--env', 'GIT_CONFIG_COUNT=1',
        '--env', 'GIT_CONFIG_KEY_0=safe.directory', '--env', 'GIT_CONFIG_VALUE_0=/workspace', builder, 'bash', '-c',
        'cargo build --release -p madara --features sequencer-randomness --locked && '
        'cp target/release/madara /release/madara && '
        'cargo build --release -p madara --no-default-features --locked && '
        'cp target/release/madara /release/madara-baseline && '
        'cargo build --release -p mc-sequencer-randomness --bin randomness-sidecar --locked && '
        'cp target/release/randomness-sidecar /release/randomness-sidecar',
    ]
    run(command, output / 'compile.log')
    return command


def prepare_contract_artifacts(madara, output):
    run(['docker', 'pull', ARTIFACT_IMAGE], output / 'artifact-image.log')
    container = read(['docker', 'create', ARTIFACT_IMAGE, 'true'])
    try:
        with tempfile.TemporaryDirectory(prefix='randomness-artifacts-') as temporary:
            archive = Path(temporary) / 'artifacts.tar.gz'
            run(['docker', 'cp', f'{container}:/artifacts.tar.gz', str(archive)], output / 'artifact-copy.log')
            with tarfile.open(archive) as bundle:
                for member in bundle.getmembers():
                    if member.isdir():
                        continue
                    target = (madara / member.name).resolve()
                    if not member.isfile() or not target.is_relative_to(madara / 'build-artifacts'):
                        raise SystemExit('unexpected artifact archive member')
                    data = bundle.extractfile(member).read()
                    if target.exists() and target.read_bytes() != data:
                        raise SystemExit(f'contract artifact differs from pinned bundle: {member.name}')
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
            return {'image': ARTIFACT_IMAGE, 'archive_sha256': digest(archive)}
    finally:
        subprocess.run(['docker', 'rm', container], check=True, stdout=subprocess.DEVNULL)


def dependency_graphs(madara, output):
    graphs = {}
    for binary, package, features in (
        ('madara', 'madara', ['--features', 'sequencer-randomness']),
        ('madara-baseline', 'madara', ['--no-default-features']),
        ('randomness-sidecar', 'mc-sequencer-randomness', ['--no-default-features']),
    ):
        path = output / f'{binary}-dependencies.txt'
        run(['cargo', 'tree', '-p', package, '--locked', '--target', 'x86_64-unknown-linux-gnu',
             '--edges', 'normal,build', '--format', '{p} features=[{f}]', *features], path, madara)
        graphs[binary] = {'artifact': path.name, 'sha256': digest(path)}
    return graphs


def native_compiler_inventory(madara, output):
    packages = tomllib.loads((madara / 'Cargo.lock').read_text())['package']
    version = next(package['version'] for package in packages if package['name'] == 'cairo-native')
    matches = list((Path.home() / '.cargo/registry/src').glob(f'*/starknet-native-compile-{version}/Cargo.lock'))
    if len(matches) != 1:
        raise SystemExit('expected the pinned native compiler lockfile from its build')
    path = output / 'native-compiler-Cargo.lock'
    path.write_bytes(matches[0].read_bytes())
    return {'name': 'starknet-native-compile', 'version': version,
            'command': ['cargo', 'install', '--locked', 'starknet-native-compile', '--version', version],
            'dependencies': {'artifact': path.name, 'sha256': digest(path)}}


def publish_image(release, output, revision):
    run(['docker', 'compose', '-p', 'madara-rand', '-f', str(release / 'registry.yml'), 'up', '-d'],
        output / 'registry.log')
    tag = f'127.0.0.1:15000/madara-rand:{revision}'
    run(['docker', 'build', '-f', str(release / 'Dockerfile'), '-t', tag, str(output)], output / 'image-build.log')
    run(['docker', 'push', tag], output / 'image-push.log')
    image = json.loads(read(['docker', 'image', 'inspect', tag]))[0]
    digests = [entry for entry in image['RepoDigests'] if entry.startswith('127.0.0.1:15000/madara-rand@sha256:')]
    if len(digests) != 1:
        raise SystemExit('expected one local registry image digest')
    return digests[0]


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: build.py MADARA_REPOSITORY OUTPUT_DIRECTORY')
    madara = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    release = Path(__file__).resolve().parent
    revision = read(['git', 'rev-parse', 'HEAD'], madara)
    require_revision(madara, revision)
    builder = read(['docker', 'image', 'inspect', 'madara-rand-build:llvm19', '--format', '{{.Id}}'])
    artifacts = prepare_contract_artifacts(madara, output)
    command = compile_binaries(madara, output, builder)
    require_revision(madara, revision)
    dependencies = output / 'dependencies.json'
    run([sys.executable, str(release.parent / 'check-dependencies.py'), str(madara), str(dependencies)],
        output / 'dependencies.log')
    graphs = dependency_graphs(madara, output)
    native_compiler = native_compiler_inventory(madara, output)
    image = publish_image(release, output, revision)
    manifest = {
        'schema': 1, 'scope': 'local protocol review; no production approval',
        'base_commit': BASE, 'patch_revision': revision, 'fsync_fix': FSYNC,
        'fsync_upstream': 'a0b1d029cc2cf9433cd5ea8ff99ec85105ad5f9c',
        'envelope_version': 1, 'journal_version': 1, 'profile': 'release',
        'features': {'madara': ['sequencer-randomness'], 'madara-baseline': [], 'randomness-sidecar': []},
        'image': image, 'builder_image_id': builder, 'build_command': command,
        'contract_artifacts': artifacts,
        'binaries': {name: digest(output / name) for name in ('madara', 'madara-baseline', 'randomness-sidecar')},
        'resolved_dependencies': graphs, 'build_tool': native_compiler,
        'dependency_audit': {'artifact': dependencies.name, 'sha256': digest(dependencies)},
        'cargo_lock_sha256': digest(madara / 'Cargo.lock'),
    }
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (output / 'image.env').write_text(f'MADARA_IMAGE={image}\n')
    print(json.dumps({'manifest': str(output / 'manifest.json'), 'image': image}))


if __name__ == '__main__':
    main()
