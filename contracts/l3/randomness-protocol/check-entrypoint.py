#!/usr/bin/env python3
"""Compare compiled entrypoint ABIs without relying on source text or type namespaces."""

import json
from pathlib import Path
import sys


class Interface:
    def __init__(self, artifact):
        abi = json.loads(Path(artifact).read_text())['abi']
        self.items = json.loads(abi) if isinstance(abi, str) else abi
        self.types = {item['name']: item for item in self.items if item['type'] in {'struct', 'enum'}}

    def shape(self, name):
        item = self.types.get(name)
        if item is None:
            return name
        members = item.get('members', item.get('variants'))
        return {item['type']: [{'name': member['name'], 'type': self.shape(member['type'])} for member in members]}

    def function(self, name):
        functions = []
        for item in self.items:
            candidates = item.get('items', []) if item['type'] == 'interface' else [item]
            functions.extend(candidate for candidate in candidates if candidate['type'] == 'function' and candidate['name'] == name)
        if len(functions) != 1:
            return {'error': f'expected one {name} function, found {len(functions)}'}
        function = functions[0]
        return {'inputs': [{'name': argument['name'], 'type': self.shape(argument['type'])} for argument in function['inputs']],
                'outputs': [self.shape(argument['type']) for argument in function['outputs']],
                'state_mutability': function['state_mutability']}


def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: check-entrypoint.py NATIVE_SIERRA_ARTIFACT OUTPUT_JSON')
    expected_path = Path(__file__).resolve().parent / 'target/dev/eternum_randomness_protocol_RecordedExecutionStub.contract_class.json'
    expected = Interface(expected_path)
    native = Interface(sys.argv[1])
    comparisons = []
    for name in ('execute', 'get_admission', 'get_result'):
        required = expected.function(name)
        actual = native.function(name)
        comparisons.append({'function': name, 'matches': required == actual, 'required': required, 'actual': actual})
    report = {'scope': 'compiled ABI conformance only; behavioral and deployed gates remain required',
              'comparisons': comparisons}
    Path(sys.argv[2]).write_text(json.dumps(report, indent=2) + '\n')
    raise SystemExit(0 if all(item['matches'] for item in comparisons) else 1)


if __name__ == '__main__':
    main()
