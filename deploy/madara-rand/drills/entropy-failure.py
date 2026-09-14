#!/usr/bin/env python3
"""Deny the OS entropy syscall and run the sampler's real failure test."""

import json
from pathlib import Path
import subprocess
import sys


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: entropy-failure.py MADARA_REPOSITORY OUTPUT_DIRECTORY')
    madara = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    image = 'madara-rand-build:llvm19'
    build = ['docker', 'run', '--rm', '--name', 'madara-rand-entropy-build',
             '--mount', f'type=bind,source={madara},target=/workspace',
             '--mount', f'type=bind,source={Path.home() / ".cargo/registry"},target=/usr/local/cargo/registry',
             '--mount', f'type=bind,source={Path.home() / ".cargo/git"},target=/usr/local/cargo/git',
             '--mount', 'type=volume,source=madara-rand-build-target,target=/workspace/target',
             '--mount', 'type=volume,source=madara-rand-rustup,target=/usr/local/rustup',
             '--workdir', '/workspace', '--env', 'CARGO_BUILD_JOBS=4', '--env', 'RUSTC_WRAPPER=', image,
             'cargo', 'test', '-p', 'mc-sequencer-randomness', '--lib', '--no-run', '--locked',
             '--message-format=json']
    with (output / 'build.jsonl').open('w') as log:
        subprocess.run(build, stdout=log, check=True)
    artifacts = [json.loads(line) for line in (output / 'build.jsonl').read_text().splitlines()]
    binaries = [item['executable'] for item in artifacts if item.get('reason') == 'compiler-artifact'
                and item.get('executable') and item['target']['name'] == 'mc_sequencer_randomness']
    if len(binaries) != 1:
        raise SystemExit('expected exactly one sampler test binary')
    fault = ['docker', 'run', '--rm', '--name', 'madara-rand-entropy-fault', '--security-opt',
             f'seccomp={Path(__file__).with_name("deny-getrandom.json")}',
             '--mount', 'type=volume,source=madara-rand-build-target,target=/workspace/target',
             image, binaries[0], '--exact', 'ticket::tests::syscall_failure_has_no_fallback',
             '--ignored', '--nocapture']
    with (output / 'fault.log').open('w') as log:
        subprocess.run(fault, stdout=log, stderr=subprocess.STDOUT, check=True)
    image_id = subprocess.check_output(['docker', 'image', 'inspect', image, '--format', '{{.Id}}'], text=True).strip()
    (output / 'report.json').write_text(json.dumps({
        'scope': 'initialized OS sampler with getrandom denied as ENOSYS; no fallback',
        'build_image_id': image_id, 'test': 'ticket::tests::syscall_failure_has_no_fallback',
        'build_command': build, 'fault_command': fault, 'exit_code': 0,
    }, indent=2) + '\n')


if __name__ == '__main__':
    main()
