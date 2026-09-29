"""Replace the Docker stats receiver with read-only cgroup v2 CPU samples."""

import json
from pathlib import Path
import re
import signal
import subprocess
import sys
import time


INTERVAL_SECONDS = 10
CGROUP_ROOT = Path('/host-cgroup')
OUTPUT = Path('/data/container-metrics.jsonl')
# Preserve the Docker receiver's cumulative metric names and nanosecond units.
COUNTERS = (
    ('usage_usec', 'container.cpu.usage.total', 'ns', 1000),
    ('user_usec', 'container.cpu.usage.usermode', 'ns', 1000),
    ('system_usec', 'container.cpu.usage.kernelmode', 'ns', 1000),
    ('nr_periods', 'container.cpu.throttling_data.periods', '{periods}', 1),
    ('nr_throttled', 'container.cpu.throttling_data.throttled_periods', '{periods}', 1),
    ('throttled_usec', 'container.cpu.throttling_data.throttled_time', 'ns', 1000),
)


def main():
    if not (CGROUP_ROOT / 'cgroup.controllers').is_file():
        raise SystemExit('mount the host cgroup v2 tree read-only at /host-cgroup')
    previous = {}
    collector = subprocess.Popen(['/otelcol-contrib', *sys.argv[1:]])
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda received, _frame: collector.send_signal(received))
    deadline = time.monotonic()
    try:
        while collector.poll() is None:
            previous = append_samples(CGROUP_ROOT, OUTPUT, previous)
            deadline += INTERVAL_SECONDS
            try:
                return collector.wait(timeout=max(0, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                pass
        return collector.returncode
    finally:
        if collector.poll() is None:
            collector.terminate()
            try:
                collector.wait(timeout=10)
            except subprocess.TimeoutExpired:
                collector.kill()
                collector.wait()


def append_samples(root, output, previous):
    now = time.time_ns()
    elapsed_clock = time.monotonic_ns()
    current = {}
    with output.open('a') as stream:
        for path in root.rglob('cpu.stat'):
            identity = container_identity(path.parent, root)
            if identity is None:
                continue
            try:
                counters = dict((key, int(value)) for key, value in
                                (line.split() for line in path.read_text().splitlines()))
            except FileNotFoundError:
                # A container can stop between directory discovery and reading its counters.
                continue
            key = identity['container.id']
            sample = cpu_sample(identity, counters, now, elapsed_clock, previous.get(key))
            stream.write(json.dumps(sample, separators=(',', ':')) + '\n')
            current[key] = (elapsed_clock, counters['usage_usec'])
    return current


def container_identity(directory, root):
    match = re.fullmatch(r'(?:docker-)?([a-f0-9]{64})(?:\.scope)?', directory.name)
    if match is None:
        return None
    return {'container.id': match[1], 'container.name': directory.name,
            'cgroup.path': str(directory.relative_to(root))}


def cpu_sample(identity, counters, now, elapsed_clock, previous):
    metrics = []
    for field, name, unit, scale in COUNTERS:
        if field not in counters:
            continue  # Bandwidth counters do not exist when the CPU controller is disabled.
        point = {'timeUnixNano': str(now), 'asInt': str(counters[field] * scale)}
        metrics.append({'name': name, 'unit': unit, 'sum': {
            'aggregationTemporality': 2, 'isMonotonic': True, 'dataPoints': [point],
        }})
    if previous is not None:
        then, usage = previous
        delta = counters['usage_usec'] - usage
        if elapsed_clock > then and delta >= 0:
            metrics.append({'name': 'container.cpu.utilization', 'unit': '1', 'gauge': {'dataPoints': [{
                'timeUnixNano': str(now), 'asDouble': delta * 1000 / (elapsed_clock - then) * 100,
            }]}})
    attributes = [{'key': key, 'value': {'stringValue': value}} for key, value in identity.items()]
    return {'resourceMetrics': [{'resource': {'attributes': attributes}, 'scopeMetrics': [{
        'scope': {'name': 'shard.cgroup_cpu'}, 'metrics': metrics,
    }]}]}


if __name__ == '__main__':
    sys.exit(main())
