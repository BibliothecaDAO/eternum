#!/usr/bin/env python3
"""Verify release files and retained measurement/recovery archives without extracting them."""

import hashlib
import json
from pathlib import Path
import tarfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify_archive(directory, inventory):
    path = directory / inventory['archive']
    if digest(path.read_bytes()) != inventory['sha256']:
        raise RuntimeError(f'archive checksum mismatch: {path}')
    with tarfile.open(path) as archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)) or set(names) != set(inventory['files']):
            raise RuntimeError(f'archive members differ: {path}')
        for member in members:
            if not member.isfile() or digest(archive.extractfile(member).read()) != inventory['files'][member.name]:
                raise RuntimeError(f'archived file differs: {path}:{member.name}')
    return len(members)


def main():
    release = Path(__file__).resolve().parent / 'release'
    index = json.loads((release / 'gates/index.json').read_text())
    for name, expected in index['artifacts'].items():
        path = (release / 'gates' / name).resolve()
        if not path.is_relative_to(release) or digest(path.read_bytes()) != expected:
            raise RuntimeError(f'release file differs: {name}')
    archives, files = 0, 0
    for path in sorted((release / 'native').rglob('artifacts.json')):
        inventory = json.loads(path.read_text())
        for archive in (inventory, *([inventory['sourceArchive']] if 'sourceArchive' in inventory else [])):
            files += verify_archive(path.parent, archive)
            archives += 1
    print(json.dumps({'releaseFilesVerified': len(index['artifacts']), 'archivesVerified': archives, 'archivedFilesVerified': files}))


if __name__ == '__main__':
    main()
