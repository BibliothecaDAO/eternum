#!/usr/bin/env python3
"""Join explorer deliveries to node stages and apply the frozen comparison budget."""

import hashlib
import json
import math
from pathlib import Path
import sys
from datetime import datetime
from importlib.util import spec_from_file_location, module_from_spec

spec = spec_from_file_location('telemetry', Path(__file__).with_name('check-telemetry.py'))
telemetry = module_from_spec(spec)
spec.loader.exec_module(telemetry)


def percentiles(values):
    if not values or any(not math.isfinite(value) or value < 0 for value in values):
        raise RuntimeError('missing or invalid measurement')
    ordered = sorted(values)
    return {f'p{percentile}': ordered[math.ceil(len(ordered) * percentile / 100) - 1] for percentile in (50, 95, 99)}


def matching(entries, key, value):
    return [entry for entry in entries if int(entry.get(key, '0'), 16) == int(value, 16)]


def summarize(plan, placement, directory):
    result = json.loads((directory / f'{placement}.json').read_text())
    if result['planSha256'] != hashlib.sha256((directory / 'plan.json').read_bytes()).hexdigest():
        raise RuntimeError('run used a different frozen manifest')
    node = telemetry.records(directory / f'{placement}-node.log')
    worker = node if placement == 'embedded' else telemetry.records(directory / f'{placement}-worker.log') if placement == 'sidecar' else []
    rows = [sample for sample in result['samples'] if not sample['warmup']]
    if len(rows) != plan['samples']:
        raise RuntimeError('sample count differs from frozen workload')
    enriched = []
    failures = [sample for sample in rows if sample.get('error')]
    for sample in rows:
        if sample.get('error'):
            continue
        transaction = sample['transaction']
        execution = matching(node, 'transaction', transaction)
        stages = {
            'execution': telemetry.require_stage(execution, 'execution_batch_member', ['batch_count', 'batch_execution_ms', 'amortized_execution_ms', 'l2_gas']),
            'preconfirmed_persistence': telemetry.require_stage(execution, 'preconfirmed_persistence', ['batch_count', 'batch_persistence_ms', 'event_count']),
        }
        if placement != 'baseline':
            actions = matching(worker, 'action', sample['action'])
            stages.update({
                'journal': telemetry.require_stage(actions, 'randomness_journal', ['reservation_ms', 'sampling_ms', 'commit_ms', 'witness_ms']),
                'admission_checks': telemetry.require_stage(actions, 'randomness_admission_checks', ['checks_ms']),
                'admission': telemetry.require_stage(actions, 'randomness_admission', ['queue_ms', 'admission_ms']),
                'submission': telemetry.require_stage(actions, 'randomness_submission', ['submission_ms']),
                'submission_checks': telemetry.require_stage(execution, 'randomness_submission_checks', ['checks_ms']),
                'result_persistence': telemetry.require_stage(actions, 'randomness_result_persistence', ['persistence_ms']),
            })
        persistence = next(entry for entry in execution if entry.get('message') == 'preconfirmed_persistence')
        persisted_ms = datetime.fromisoformat(persistence['timestamp'].replace('Z', '+00:00')).timestamp() * 1000
        delivery_ms = sample['delivery']['epochMs']
        if delivery_ms < persisted_ms - 1:
            raise RuntimeError('delivery precedes node persistence timestamp')
        enriched.append({'index': sample['index'], 'layer': sample['layer'], 'transaction': transaction,
                         'rowLatencyMs': delivery_ms - sample['submittedMs'],
                         'heraldDeliveryMs': max(0, delivery_ms - persisted_ms),
                         'scheduleDelayMs': sample['submittedMs'] - sample['scheduledMs'], 'stages': stages})
    ordered_deliveries = sorted((sample for sample in rows if sample.get('delivery')), key=lambda sample: sample['delivery']['epochMs'])
    orders = [int(sample['order'], 16) for sample in ordered_deliveries if sample.get('order')]
    violations = sum(right <= left for left, right in zip(orders, orders[1:]))
    wall_ms = max(sample['delivery']['epochMs'] for sample in rows if sample.get('delivery')) - min(sample['submittedMs'] for sample in rows)
    stages = {name: {field: percentiles([row['stages'][name][field] for row in enriched]) for field in fields}
              for name, fields in enriched[0]['stages'].items()}
    summary = {
        'samples': len(rows), 'failedActions': len(failures), 'trafficFailures': sum(bool(row.get('error')) for row in result['trafficResults']),
        'ticketOrderViolations': violations, 'throughputActionsPerSecond': len(enriched) * 1000 / wall_ms,
        'rowLatencyMs': percentiles([row['rowLatencyMs'] for row in enriched]),
        'heraldDeliveryMs': percentiles([row['heraldDeliveryMs'] for row in enriched]),
        'scheduleDelayMs': percentiles([max(0, row['scheduleDelayMs']) for row in enriched]),
        'stages': stages,
        'singletonExecutionSamples': sum(row['stages']['execution']['batch_count'] == 1 for row in enriched),
        'executionBasis': plan['executionBasis'],
        'eventVolume': sum(len(row.get('receipt', {}).get('events', [])) for row in rows),
        'layerCounts': {layer: sum(row['layer'] == layer for row in enriched) for layer in ('surface', 'ethereal')},
        'discoveryCounts': {},
    }
    for sample in rows:
        for row in sample.get('delivery', {}).get('message', {}).get('set', []):
            if row['model'] == 'Structure':
                category = str(row['value']['category'])
                summary['discoveryCounts'][category] = summary['discoveryCounts'].get(category, 0) + 1
    return {'summary': summary, 'actions': enriched, 'failures': failures}


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: analyze-explore-run.py RUN_DIRECTORY')
    directory = Path(sys.argv[1]).resolve()
    plan = json.loads((directory / 'plan.json').read_text())
    runs = {placement: summarize(plan, placement, directory) for placement in ('baseline', 'embedded', 'sidecar')}
    baseline = runs['baseline']['summary']
    budget = plan['budget']
    checks = {}
    for placement in ('embedded', 'sidecar'):
        summary = runs[placement]['summary']
        checks[placement] = {
            'p95RegressionMs': summary['rowLatencyMs']['p95'] - baseline['rowLatencyMs']['p95'],
            'p99RegressionMs': summary['rowLatencyMs']['p99'] - baseline['rowLatencyMs']['p99'],
            'throughputRatio': summary['throughputActionsPerSecond'] / baseline['throughputActionsPerSecond'],
            'additionalFailedActions': max(0, summary['failedActions'] - baseline['failedActions']),
            'ticketOrderViolations': summary['ticketOrderViolations'],
        }
        check = checks[placement]
        check['passed'] = (check['p95RegressionMs'] <= budget['p95RegressionMs'] and
                           check['p99RegressionMs'] <= budget['p99RegressionMs'] and
                           check['throughputRatio'] >= budget['minimumThroughputRatio'] and
                           check['additionalFailedActions'] == 0 and check['ticketOrderViolations'] == 0 and
                           summary['trafficFailures'] == 0 and baseline['trafficFailures'] == 0)
    report = {'schema': 1, 'scope': 'single-host measurement; no cross-host network or host-loss claim',
              'planSha256': hashlib.sha256((directory / 'plan.json').read_bytes()).hexdigest(),
              'runs': runs, 'budget': budget, 'checks': checks, 'passed': all(check['passed'] for check in checks.values())}
    with (directory / 'report.json').open('x') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'checks': checks, 'passed': report['passed']}))


if __name__ == '__main__':
    main()
