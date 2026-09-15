"""Shared build commands and artifact digests."""

import hashlib
import subprocess


def read(command, directory=None):
    return subprocess.check_output(command, cwd=directory, text=True).strip()


def run(command, log, directory=None):
    with log.open('w') as stream:
        subprocess.run(command, cwd=directory, stdout=stream, stderr=subprocess.STDOUT, check=True)


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
