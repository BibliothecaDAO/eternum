#!/usr/bin/env python3
"""Summarize structured block logs and the node's OTLP metric export."""

import argparse
from collections import namedtuple
from datetime import datetime, timezone
import json
import math
import re
import sys

EVERY_RUN = "every run"
PAIRS = ("concurrency", "hash-cache")

# Every node series this script reads, named as Madara exports them at the campaign's revision (802086d), and when each
# is required. The campaign gate and the reader share this one declaration, so what is read and what is required cannot
# drift apart. A series required for a lever pair is required only when the run names that pair with --pair.
Series = namedtuple("Series", "name key kind required label", defaults=(None,))
NODE_SERIES = (
    Series("mempool_current_size", "transactions", "gauge", EVERY_RUN),
    Series("mempool_ready_transactions", "ready", "gauge", EVERY_RUN),
    Series("mempool_preconfirmed_transaction_statuses", "preconfirmedStatuses", "gauge", EVERY_RUN),
    Series("blockifier_execution_attempts_total", "attempts", "counter", EVERY_RUN),
    Series("blockifier_committed_transactions_total", "committed", "counter", EVERY_RUN),
    Series("blockifier_transactions_total", "transactions", "counter", "concurrency"),
    Series("blockifier_validation_attempts_total", "validationAttempts", "counter", "concurrency"),
    Series("blockifier_aborts_total", "aborts", "counter", "concurrency"),
    Series("blockifier_commit_phase_aborts_total", "commitPhaseAborts", "counter", "concurrency"),
    Series("exec_hash_cache_calls_total", "calls", "counter", "hash-cache", "kind"),
    Series("exec_hash_cache_hits_total", "hits", "counter", "hash-cache", "kind"),
    Series("exec_hash_cache_misses_total", "misses", "counter", "hash-cache", "kind"),
    Series("exec_hash_cache_capacity_clears_total", "capacityClears", "counter", "hash-cache", "kind"),
)
SERIES_BY_NAME = {series.name: series for series in NODE_SERIES}

# Close time and gas are read per block from the node's close_block_complete log; every closed block must carry them.
REQUIRED_BLOCK_FIELDS = ("close_end_to_end_ms", "l2_gas_consumed", "bouncer_sierra_gas")


def percentile(values, percentile_value):
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil((percentile_value / 100) * len(ordered)) - 1)
    return ordered[index]


def read_log(since=None, until=None):
    rows = []
    since, until = time_bound(since), time_bound(until)
    for line in sys.stdin:
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("message") == "close_block_complete":
            if since is not None or until is not None:
                timestamp = time_bound(row["timestamp"])
                if ((since is not None and timestamp < since)
                        or (until is not None and timestamp > until)):
                    continue
            rows.append(row)
    return rows


def time_bound(value):
    if value is None:
        return None
    relative = re.fullmatch(r"(\d+)(s|m|h)", value)
    if relative:
        seconds = int(relative[1]) * {"s": 1, "m": 60, "h": 3600}[relative[2]]
        return int((datetime.now(timezone.utc).timestamp() - seconds) * 1e9)
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1e9)


def read_metrics(path, since, until):
    """Read the collector's OTLP JSON file into points per series, keyed by metric name and label value."""
    points = {}
    if path is None:
        return points
    since, until = time_bound(since), time_bound(until)
    with open(path) as stream:
        for line in stream:
            for resource in json.loads(line).get("resourceMetrics", []):
                for scope in resource.get("scopeMetrics", []):
                    for metric in scope.get("metrics", []):
                        series = SERIES_BY_NAME.get(metric["name"])
                        if series is not None:
                            read_series_points(series, metric, since, until, points)
    for series_points in points.values():
        series_points.sort(key=lambda point: point["timestamp"])
    return points


def read_series_points(series, metric, since, until, points):
    for point in metric.get("gauge", metric.get("sum", {})).get("dataPoints", []):
        timestamp = int(point["timeUnixNano"])
        if (since is not None and timestamp < since) or (until is not None and timestamp > until):
            continue
        key = (series.name, label_of(point, series.label))
        if any(existing["timestamp"] == timestamp for existing in points.get(key, [])):
            raise ValueError("Metrics input contains multiple node series")
        points.setdefault(key, []).append(
            {"timestamp": timestamp, "value": int(point["asInt"]), "start": point.get("startTimeUnixNano")}
        )


def label_of(point, label):
    if label is None:
        return None
    for attribute in point.get("attributes", []):
        if attribute["key"] == label:
            return attribute["value"].get("stringValue")
    return None


def counter_delta(points):
    """The counter's growth over the window, without counting across a reset (a new start time or a lower value)."""
    delta = intervals = resets = 0
    for previous, current in zip(points, points[1:]):
        if current["start"] != previous["start"] or current["value"] < previous["value"]:
            resets += 1
            continue
        delta += current["value"] - previous["value"]
        intervals += 1
    return {"delta": delta if intervals else None, "intervals": intervals, "resets": resets}


def missing_series(points, pair):
    required = {EVERY_RUN, pair}
    present = {name for name, _ in points}
    return [series.name for series in NODE_SERIES if series.required in required and series.name not in present]


def missing_block_fields(rows):
    return sorted({field for row in rows for field in REQUIRED_BLOCK_FIELDS if field not in row})


def execution_amplification(points):
    attempts = counter_delta(points.get(("blockifier_execution_attempts_total", None), []))
    committed = counter_delta(points.get(("blockifier_committed_transactions_total", None), []))
    return {
        "intervals": attempts["intervals"],
        "resets": attempts["resets"],
        "attempts": attempts["delta"],
        "committed": committed["delta"],
        "attemptsPerCommitted": (
            attempts["delta"] / committed["delta"] if attempts["delta"] is not None and committed["delta"] else None
        ),
    }


def gauge_values(points, name):
    return [point["value"] for point in points.get((name, None), [])]


def summarize_mempool(points):
    transactions = gauge_values(points, "mempool_current_size")
    ready = gauge_values(points, "mempool_ready_transactions")
    preconfirmed = gauge_values(points, "mempool_preconfirmed_transaction_statuses")
    return {
        "samples": len(transactions),
        "maxTransactions": max(transactions) if transactions else None,
        "maxReadyTransactions": max(ready) if ready else None,
        "lastObservedTransactions": transactions[-1] if transactions else None,
        "lastObservedReadyTransactions": ready[-1] if ready else None,
        "maxPreconfirmedStatuses": max(preconfirmed) if preconfirmed else None,
    }


def summarize_blockifier(points):
    """The serial-versus-concurrent pair's counters, each its growth over the window, or null where not exported."""
    return {
        series.key: counter_delta(points.get((series.name, None), []))["delta"]
        for series in NODE_SERIES
        if series.required == "concurrency"
    }


def summarize_hash_cache(points):
    """The hash-cache pair's counters per cache kind, each its growth over the window."""
    caches = {}
    for series in NODE_SERIES:
        if series.required != "hash-cache":
            continue
        for (name, kind), series_points in points.items():
            if name == series.name:
                caches.setdefault(kind, {})[series.key] = counter_delta(series_points)["delta"]
    for cache in caches.values():
        calls, hits = cache.get("calls"), cache.get("hits")
        cache["hitRate"] = hits / calls if calls and hits is not None else None
    return caches


def metric(values, include_p50=True, include_p95=True):
    result = {"max": max(values) if values else None}
    if include_p50:
        result["p50"] = percentile(values, 50)
    if include_p95:
        result["p95"] = percentile(values, 95)
    return result


def summarize_slowest_block(rows, mempool):
    if not rows:
        return None
    row = max(rows, key=lambda candidate: candidate["block_production_ms"])
    return {
        "blockNumber": row["block_number"],
        "blockProductionMs": row["block_production_ms"],
        "closeBlockMs": row["close_end_to_end_ms"],
        "transactions": row["txs_executed"],
        "batches": row.get("batches_executed"),
        "sierraGas": row["bouncer_sierra_gas"],
        "merklizationMs": row["merklization_ms"],
        "dbWriteMs": row["db_write_ms"],
        "mempoolMaxTransactions": mempool["maxTransactions"],
        "mempoolMaxReadyTransactions": mempool["maxReadyTransactions"],
    }


def summarize(rows, points, pair=None):
    missing = missing_series(points, pair) + missing_block_fields(rows)
    complete = [row for row in rows if all(field in row for field in REQUIRED_BLOCK_FIELDS)]
    busy = [row for row in complete if row["txs_executed"] > 0]
    mempool = summarize_mempool(points)
    summary = {
        "pair": pair,
        "missingRequired": missing,
        "blocks": {
            "count": len(rows),
            "busy": len(busy),
            "first": rows[0]["block_number"] if rows else None,
            "last": rows[-1]["block_number"] if rows else None,
        },
        "transactions": {
            "executed": sum(row["txs_executed"] for row in rows),
            "addedToBlock": sum(row.get("txs_added_to_block", 0) for row in rows),
            "reverted": sum(row["txs_reverted"] for row in rows),
            "rejected": sum(row["txs_rejected"] for row in rows),
            "classesDeclared": sum(row["classes_declared"] for row in rows),
            "contractsDeployed": sum(row["deployed_contracts"] for row in rows),
            "l2GasConsumed": sum(row["l2_gas_consumed"] for row in complete),
        },
        "transactionsPerBusyBlock": metric([row["txs_executed"] for row in busy], include_p95=False),
        "sierraGasPerBusyBlock": metric([row["bouncer_sierra_gas"] for row in busy]),
        "l2GasPerBusyBlock": metric([row["l2_gas_consumed"] for row in busy]),
        "blockProductionMs": metric([row["block_production_ms"] for row in rows]),
        "closeBlockMs": metric([row["close_end_to_end_ms"] for row in complete]),
        "merklizationMs": metric(
            [row["merklization_ms"] for row in rows],
            include_p50=False,
            include_p95=False,
        ),
        "dbWriteMs": metric(
            [row["db_write_ms"] for row in rows],
            include_p50=False,
            include_p95=False,
        ),
        "mempool": mempool,
        "executionAmplification": execution_amplification(points),
        "blockifier": summarize_blockifier(points),
        "hashCache": summarize_hash_cache(points),
    }
    summary["slowestBlock"] = summarize_slowest_block(busy or complete, mempool)
    return summary


def print_text(summary):
    blocks = summary["blocks"]
    transactions = summary["transactions"]
    if summary["missingRequired"]:
        print(f"missing required   {', '.join(summary['missingRequired'])}")
    print(f"blocks             {blocks['count']}  (busy: {blocks['busy']})")
    print(f"blocks range       #{blocks['first']} .. #{blocks['last']}")
    print(
        f"txs executed       {transactions['executed']}  "
        f"reverted={transactions['reverted']} rejected={transactions['rejected']}"
    )
    print(f"classes declared   {transactions['classesDeclared']}")
    print(f"contracts deployed {transactions['contractsDeployed']}")
    print(f"l2 gas consumed    {transactions['l2GasConsumed']}")
    per_block = summary["transactionsPerBusyBlock"]
    if per_block["max"] is not None:
        print(f"txs/busy block     max={per_block['max']} p50={per_block['p50']}")
    sierra = summary["sierraGasPerBusyBlock"]
    if sierra["max"] is not None:
        print(
            f"sierra/busy block  p50={sierra['p50']} p95={sierra['p95']} max={sierra['max']}"
        )
    production = summary["blockProductionMs"]
    close = summary["closeBlockMs"]
    print(
        f"block_production   p50={production['p50']:.1f}ms "
        f"p95={production['p95']:.1f}ms max={production['max']:.1f}ms"
    )
    if close["max"] is not None:
        print(
            f"close_block        p50={close['p50']:.2f}ms "
            f"p95={close['p95']:.2f}ms max={close['max']:.2f}ms"
        )
    print(
        f"merklization max   {summary['merklizationMs']['max']:.2f}ms   "
        f"db_write max {summary['dbWriteMs']['max']:.2f}ms"
    )
    wall = summary["slowestBlock"]
    mempool = summary["mempool"]
    if wall is not None:
        print(
            f"wall evidence      block=#{wall['blockNumber']} "
            f"block_production={wall['blockProductionMs']:.2f}ms txs={wall['transactions']} "
            f"batches={wall['batches']} sierra={wall['sierraGas']} "
            f"merklization={wall['merklizationMs']:.2f}ms "
            f"mempool_max={mempool['maxTransactions']} ready_max={mempool['maxReadyTransactions']}"
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--metrics", help="Single-node OTLP JSON metrics exported by the collector")
    parser.add_argument("--pair", choices=PAIRS, help="The lever pair this run measures; its counters become required")
    parser.add_argument("--since")
    parser.add_argument("--until")
    args = parser.parse_args()
    rows = read_log(args.since, args.until)
    points = read_metrics(args.metrics, args.since, args.until)
    summary = summarize(rows, points, args.pair)
    if args.json:
        print(json.dumps(summary, separators=(",", ":")))
    elif summary["blocks"]["count"] == 0:
        print("no closed blocks in range")
    else:
        print_text(summary)
    # A required series or block field that is missing fails the run: its absence is never reported as zero.
    if summary["missingRequired"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
