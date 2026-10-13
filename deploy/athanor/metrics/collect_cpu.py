"""Collect cgroup CPU samples and report sustained node commit degradation from the existing OTLP export."""

import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time


INTERVAL_SECONDS = 10
CGROUP_ROOT = Path('/host-cgroup')
OUTPUT = Path('/data/container-metrics.jsonl')
# The collector's own export rotates at 100 MB and keeps two older files (collector.json); these samples do the same,
# so a long-lived shard's metrics stay bounded.
ROTATE_BYTES = 100 * 2**20
BACKUPS = 2
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
    commit_alarm = CommitAlarm()
    collector = subprocess.Popen(['/otelcol-contrib', *sys.argv[1:]])
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda received, _frame: collector.send_signal(received))
    deadline = time.monotonic()
    try:
        while collector.poll() is None:
            previous = append_samples(CGROUP_ROOT, OUTPUT, previous)
            for event in commit_alarm.poll(Path('/data/metrics.jsonl')):
                print(json.dumps(event), flush=True)
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


class CommitAlarm:
    """Three fresh slow exports alarm; one healthy export recovers. A single flush is not sustained degradation."""

    def __init__(self):
        self.identity = None
        self.offset = 0
        self.skip_remainder = False
        self.timestamp = 0
        self.slow_samples = 0
        self.active = False
        self.last_seen = time.monotonic()
        self.missing = False

    def poll(self, path):
        events = self.read_exports(path)
        missing = time.monotonic() - self.last_seen >= 3 * INTERVAL_SECONDS
        if missing != self.missing:
            self.missing = missing
            if missing:
                self.slow_samples = 0
            events.append({'event': 'node_commit_metric_missing' if missing else 'node_commit_metric_restored'})
        return events

    def read_exports(self, path):
        events = []
        try:
            stream = path.open()
        except FileNotFoundError:
            return events
        with stream:
            stat = os.fstat(stream.fileno())
            identity = (stat.st_dev, stat.st_ino)
            if self.identity is None:
                self.offset = stat.st_size  # Do not replay yesterday's alarms after a collector restart.
                if self.offset:
                    stream.seek(self.offset - 1)
                    self.skip_remainder = stream.read(1) != '\n'
            elif self.identity != identity or stat.st_size < self.offset:
                self.offset = 0
                self.skip_remainder = False
            self.identity = identity
            stream.seek(self.offset)
            while line := stream.readline():
                if not line.endswith('\n'):
                    break  # The exporter may still be writing this record.
                self.offset = stream.tell()
                if self.skip_remainder:
                    self.skip_remainder = False
                    continue
                try:
                    samples = list(commit_samples(json.loads(line)))
                except (ValueError, TypeError, KeyError, AttributeError, OverflowError) as error:
                    events.append({'event': 'node_metric_record_invalid', 'error': type(error).__name__})
                    continue
                for timestamp, seconds in samples:
                    event = self.observe(timestamp, seconds)
                    if event is not None:
                        events.append(event)
        return events

    def observe(self, timestamp, seconds):
        if timestamp <= self.timestamp:
            return None
        self.timestamp = timestamp
        self.last_seen = time.monotonic()
        self.slow_samples = self.slow_samples + 1 if seconds > 0.020 else 0
        active = self.slow_samples >= 3 if not self.active else seconds > 0.020
        if active == self.active:
            return None
        self.active = active
        return {'event': 'node_commit_slow' if active else 'node_commit_recovered',
                'timeUnixNano': str(timestamp), 'commitMs': seconds * 1000, 'limitMs': 20}


def commit_samples(row):
    for resource in row.get('resourceMetrics', []):
        for scope in resource.get('scopeMetrics', []):
            for metric in scope.get('metrics', []):
                if metric.get('name') == 'close_commit_stage_last_seconds':
                    for point in metric.get('gauge', {}).get('dataPoints', []):
                        timestamp = int(point['timeUnixNano'])
                        seconds = float(point['asDouble'] if 'asDouble' in point else point['asInt'])
                        if timestamp <= 0 or not math.isfinite(seconds) or seconds < 0:
                            raise ValueError('Invalid commit metric point')
                        yield timestamp, seconds


def append_samples(root, output, previous):
    now = time.time_ns()
    elapsed_clock = time.monotonic_ns()
    current = {}
    rotate(output)
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


def rotate(output):
    """Moves a full sample file to .1, and .1 to .2, dropping the oldest."""
    if not output.exists() or output.stat().st_size < ROTATE_BYTES:
        return
    for generation in range(BACKUPS - 1, 0, -1):
        older = output.with_name(f'{output.name}.{generation}')
        if older.exists():
            older.replace(output.with_name(f'{output.name}.{generation + 1}'))
    output.replace(output.with_name(f'{output.name}.1'))


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
