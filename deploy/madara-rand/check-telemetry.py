#!/usr/bin/env python3
"""Check measured stages against one delivered conformance action."""

import hashlib
import json
import math
from pathlib import Path
import sys


def records(path):
    result = []
    for line in path.read_text().splitlines():
        if not line.startswith('{'):
            continue
        record = json.loads(line)
        result.append({**record, **record.get('fields', {})})
    return result


def require_stage(entries, name, fields, multiple=False):
    matching = [entry for entry in entries if entry.get('message') == name]
    if not matching or (not multiple and len(matching) != 1):
        raise RuntimeError(f'{name}: expected {"at least" if multiple else "exactly"} one stage, found {len(matching)}')
    stage = matching[0]
    for field in fields:
        value = stage[field]
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise RuntimeError(f'{name}: invalid measurement {field}')
    return {field: stage[field] for field in fields}


def main():
    if len(sys.argv) != 5:
        raise SystemExit('usage: check-telemetry.py DELIVERY_REPORT NODE_LOG WORKER_LOG OUTPUT_JSON')
    delivery_path, node_path, worker_path, output = (Path(value).resolve() for value in sys.argv[1:])
    delivery = json.loads(delivery_path.read_text())
    action = int(delivery['action'], 16)
    transaction = int(delivery['delivery']['message']['transaction_hash'], 16)
    node = records(node_path)
    worker = node if worker_path == node_path else records(worker_path)
    actions = [entry for entry in worker if int(entry.get('action', '0'), 16) == action]
    execution = [entry for entry in node if int(entry.get('transaction', '0'), 16) == transaction]
    stages = {
        'journal': require_stage(actions, 'randomness_journal', ['reservation_ms', 'sampling_ms', 'commit_ms', 'witness_ms']),
        'admission_checks': require_stage(actions, 'randomness_admission_checks', ['checks_ms']),
        'admission': require_stage(actions, 'randomness_admission', ['queue_ms', 'admission_ms'], multiple=True),
        'submission': require_stage(actions, 'randomness_submission', ['submission_ms']),
        'submission_checks': require_stage(execution, 'randomness_submission_checks', ['checks_ms']),
        'execution': require_stage(execution, 'execution_batch_member', ['batch_count', 'batch_execution_ms', 'amortized_execution_ms', 'l2_gas']),
        'preconfirmed_persistence': require_stage(execution, 'preconfirmed_persistence', ['batch_count', 'batch_persistence_ms']),
        'result_persistence': require_stage(actions, 'randomness_result_persistence', ['persistence_ms']),
    }
    row_latency = delivery['submission_to_preconfirmed_row_ms']
    if not math.isfinite(row_latency) or row_latency < 0:
        raise RuntimeError('invalid submission-to-row timing')
    report = {'schema': 1, 'scope': 'single-host instrumentation check; not explore or latency-budget evidence',
              'placement': delivery['placement'], 'action': delivery['action'], 'order': delivery['order'],
              'transaction': hex(transaction), 'stages': stages, 'submission_to_preconfirmed_row_ms': row_latency,
              'execution_basis': 'batch wall time; amortized per member, not individual transaction wall time',
              'artifacts': {str(path): hashlib.sha256(path.read_bytes()).hexdigest()
                            for path in {delivery_path, node_path, worker_path}}}
    with output.open('x') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(output), 'passed': True}))


if __name__ == '__main__':
    main()
