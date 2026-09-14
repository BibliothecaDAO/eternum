#!/usr/bin/env python3
"""Audit resolved node dependencies and vendored package manifests."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tomllib


def forbidden(name):
    normalized = name.lower().replace('_', '-').removeprefix('@')
    return (normalized in {'stark-vrf', 'cartridge-vrf', 'controller', 'cartridge/server', 'cartridge/controller'}
            or normalized.startswith(('stark-vrf-', 'cartridge-vrf-', 'cartridge-controller', 'cartridge-server')))


def manifests(root):
    for directory, children, files in os.walk(root):
        children[:] = [name for name in children if name not in {'.git', 'target', 'node_modules', '.snfoundry_cache'}]
        for name in files:
            if name in {'Cargo.toml', 'Scarb.toml', 'package.json'}:
                yield Path(directory) / name


def declared_names(path):
    if path.suffix == '.json':
        data = json.loads(path.read_text())
        yield data.get('name', '')
        for key in ('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'):
            yield from data.get(key, {})
    else:
        yield from toml_names(tomllib.loads(path.read_text()))


def toml_names(table):
    for key, value in table.items():
        if not isinstance(value, dict):
            continue
        if key == 'package':
            yield value.get('name', '')
        if key in {'dependencies', 'dev-dependencies', 'build-dependencies'}:
            for name, dependency in value.items():
                yield name
                if isinstance(dependency, dict):
                    yield dependency.get('package', '')
        else:
            yield from toml_names(value)


def vendored_paths(root):
    for directory, children, files in os.walk(root):
        children[:] = [name for name in children if name not in {'.git', 'target', 'node_modules', '.snfoundry_cache'}]
        for name in [*children, *files]:
            path = (Path(directory) / name).relative_to(root)
            components = [*path.parts[:-1], Path(path.name).stem]
            if any(component.lower() != 'controller' and forbidden(component) for component in components) or any(
                forbidden('/'.join(components[index:index + 2])) for index in range(len(components) - 1)
            ):
                yield str(path)


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: check-dependencies.py MADARA_REPOSITORY OUTPUT_JSON')
    madara = Path(sys.argv[1]).resolve()
    metadata = json.loads(subprocess.check_output([
        'cargo', 'metadata', '--format-version', '1', '--locked', '--filter-platform',
        'x86_64-unknown-linux-gnu', '--features', 'madara/sequencer-randomness',
    ], cwd=madara))
    nodes = {node['id']: node for node in metadata['resolve']['nodes']}
    packages = {package['id']: package for package in metadata['packages']}
    pending = [key for key, package in packages.items() if package['name'] in {'madara', 'mc-sequencer-randomness'}]
    closure = set()
    while pending:
        key = pending.pop()
        if key in closure:
            continue
        closure.add(key)
        pending.extend(nodes[key]['dependencies'])
    dependencies = [{'name': packages[key]['name'], 'version': packages[key]['version'],
                     'source': packages[key]['source'], 'features': nodes[key]['features']}
                    for key in sorted(closure)]
    violations = [{'package': item['name'], 'source': item['source']} for item in dependencies if forbidden(item['name'])]
    protocol = Path(__file__).resolve().parents[2] / 'contracts/l3/randomness-protocol'
    inspected = []
    for root in (madara, protocol):
        violations.extend({'vendored_path': path} for path in vendored_paths(root))
        for path in sorted(manifests(root)):
            inspected.append(str(path.relative_to(root)))
            violations.extend({'package': name, 'manifest': str(path.relative_to(root))}
                              for name in declared_names(path) if forbidden(name))
    workspace_lock = tomllib.loads((madara / 'Cargo.lock').read_text())
    native_version = next(package['version'] for package in workspace_lock['package'] if package['name'] == 'cairo-native')
    tool_locks = list((Path.home() / '.cargo/registry/src').glob(f'*/starknet-native-compile-{native_version}/Cargo.lock'))
    if len(tool_locks) != 1:
        raise SystemExit('build the pinned native compiler before auditing its dependencies')
    build_tool = tomllib.loads(tool_locks[0].read_text())['package']
    violations.extend({'package': package['name'], 'build_tool': 'starknet-native-compile'}
                      for package in build_tool if forbidden(package['name']))
    report = {'schema': 1, 'scope': 'enabled node and sidecar dependency closure; source, workspace, target and vendored manifests and paths',
              'dependencies': dependencies, 'build_tool': {'name': 'starknet-native-compile', 'version': native_version, 'dependencies': build_tool},
              'manifests': inspected, 'violations': violations}
    Path(sys.argv[2]).write_text(json.dumps(report, indent=2) + '\n')
    raise SystemExit(bool(violations))


if __name__ == '__main__':
    main()
