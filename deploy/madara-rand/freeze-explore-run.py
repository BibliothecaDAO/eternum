#!/usr/bin/env python3
"""Freeze the comparison inputs before collecting any explore measurements."""

import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
from datetime import datetime, timezone


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if len(sys.argv) != 7:
        raise SystemExit('usage: freeze-explore-run.py BASELINE_FIXTURE EMBEDDED_FIXTURE SIDECAR_FIXTURE NODE_RELEASE HERALD_RELEASE OUTPUT')
    baseline, embedded, sidecar, node, herald, output = (Path(value).resolve() for value in sys.argv[1:])
    if subprocess.check_output(['git', 'status', '--porcelain'], text=True).strip():
        raise SystemExit('commit the runner before freezing its measurement inputs')
    fixtures = dict(zip(('baseline', 'embedded', 'sidecar'), (baseline, embedded, sidecar)))
    geometry = None
    for path in fixtures.values():
        fixture = json.loads(path.read_text())
        if len(fixture['explorers']) != 288:
            raise SystemExit('each deployment needs 32 warmup and 256 untouched explorers')
        layers = fixture.get('layers', fixture.get('provision', {}).get('layers'))
        if layers != ['surface', 'ethereal'] * 144:
            raise SystemExit('all placements require the same alternating layers')
        coordinates = fixture.get('geometry')
        if not isinstance(coordinates, list) or len(coordinates) != 288:
            raise SystemExit('each deployment must record its prepared realm, explorer and access-spire coordinates')
        if geometry is not None and coordinates != geometry:
            raise SystemExit('the prepared coordinates differ between placements')
        geometry = coordinates
    manifest = {
        'schema': 1, 'scope': 'single-host deployed explore comparison',
        'frozenAt': datetime.now(timezone.utc).isoformat(),
        'sourceRevision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
        'gitDirty': False, 'preparationRestSeconds': 65, 'warmup': 32, 'samples': 256, 'intervalMs': 250,
        'trafficOffsetMs': 125, 'jitterMs': [0, 37, -29, 53, -47, 19, -11, 61],
        'competingTraffic': 'one STRK self-transfer per explore from the same independent genesis account',
        'preconfirmedCadenceMs': 250, 'nodeBinary': 'same enabled madara binary for baseline, embedded and sidecar; baseline stops the idle sidecar',
        'runtimeSources': {str(path): sha256(path) for path in sorted(Path('deploy/madara-rand').rglob('*'))
                           if path.is_file() and 'release' not in path.parts and path.suffix in ('.ts', '.py', '.yml')},
        'workload': 'one eastward unexplored move per fresh explorer; alternating surface and Ethereal; original preset 1 pools and weights',
        'discoveryFixtures': 'same coordinates, grants, access spires, troop type and tier; independent draws, no outcome selection or pool changes',
        'baselineRandomness': 'unchanged Dojo zero-provider transaction-hash placeholder',
        'nativeRandomness': 'OS roots assigned once by the replicated accepted-ticket protocol',
        'sampleExclusions': 'exactly the first 32 scheduled warmup actions; retain every later failure and timeout',
        'budget': {'p95RegressionMs': 25, 'p99RegressionMs': 50, 'minimumThroughputRatio': 0.95, 'additionalFailedActions': 0, 'ticketOrderViolations': 0},
        'executionBasis': 'batch wall time and batch size recorded per transaction; singleton batches are direct action timings, larger batches are explicitly amortized',
        'fixtures': {name: {'path': str(path), 'sha256': sha256(path)} for name, path in fixtures.items()},
        'releases': {name: json.loads((path / 'manifest.json').read_text()) for name, path in (('node', node), ('herald', herald))},
        'host': {'platform': platform.platform(), 'cpus': os.cpu_count(), 'cpuinfo': Path('/proc/cpuinfo').read_text().split('\n\n')[0], 'memory': Path('/proc/meminfo').read_text()},
    }
    with output.open('x') as stream:
        stream.write(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'manifest': str(output), 'sha256': sha256(output)}))


if __name__ == '__main__':
    main()
