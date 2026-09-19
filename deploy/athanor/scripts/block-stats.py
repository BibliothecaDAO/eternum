#!/usr/bin/env python3
"""Summarize structured block logs and the node's OTLP metric export."""

import argparse
from datetime import datetime, timezone
import json
import math
import re
import sys


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
    """Read the collector's OTLP JSON file, retaining the node's metric identities."""
    samples = []
    if path is None:
        return []
    since, until = time_bound(since), time_bound(until)
    with open(path) as stream:
        for line in stream:
            for resource in json.loads(line).get("resourceMetrics", []):
                sample = read_node_sample(resource, since, until)
                if sample:
                    samples.append(sample)
    return sorted(samples, key=lambda sample: sample["timestamp"])


def read_node_sample(resource, since, until):
    names = {
        "mempool_current_size": "transactions",
        "mempool_ready_transactions": "ready",
        "blockifier_execution_attempts_total": "attempts",
        "blockifier_committed_transactions_total": "committed",
    }
    sample = {}
    for scope in resource.get("scopeMetrics", []):
        for metric in scope.get("metrics", []):
            name = names.get(metric["name"])
            if name is None:
                continue
            points = metric.get("gauge", metric.get("sum", {})).get("dataPoints", [])
            for point in points:
                timestamp = int(point["timeUnixNano"])
                if ((since is not None and timestamp < since)
                        or (until is not None and timestamp > until)):
                    continue
                sample["timestamp"] = max(sample.get("timestamp", 0), timestamp)
                if name in sample:
                    raise ValueError("Metrics input contains multiple node series")
                sample[name] = int(point["asInt"])
                if name in ("attempts", "committed"):
                    sample[f"{name}_start"] = point["startTimeUnixNano"]
    return sample


def execution_amplification(samples):
    previous = None
    attempts = committed = intervals = resets = 0
    for sample in samples:
        if not all(key in sample for key in ("attempts", "committed")):
            continue
        if previous is not None:
            if any(
                sample[f"{key}_start"] != previous[f"{key}_start"]
                or sample[key] < previous[key]
                for key in ("attempts", "committed")
            ):
                resets += 1
            else:
                attempts += sample["attempts"] - previous["attempts"]
                committed += sample["committed"] - previous["committed"]
                intervals += 1
        previous = sample
    return {
        "intervals": intervals,
        "resets": resets,
        "attempts": attempts if intervals else None,
        "committed": committed if intervals else None,
        "attemptsPerCommitted": attempts / committed if committed else None,
    }


def metric(values, include_p50=True, include_p95=True):
    result = {"max": max(values) if values else None}
    if include_p50:
        result["p50"] = percentile(values, 50)
    if include_p95:
        result["p95"] = percentile(values, 95)
    return result


def summarize_mempool(samples):
    samples = [sample for sample in samples if "transactions" in sample and "ready" in sample]
    if not samples:
        return {
            "samples": 0,
            "maxTransactions": None,
            "maxReadyTransactions": None,
            "lastObservedTransactions": None,
            "lastObservedReadyTransactions": None,
        }
    return {
        "samples": len(samples),
        "maxTransactions": max(sample["transactions"] for sample in samples),
        "maxReadyTransactions": max(sample["ready"] for sample in samples),
        "lastObservedTransactions": samples[-1]["transactions"],
        "lastObservedReadyTransactions": samples[-1]["ready"],
    }


def summarize_slowest_block(rows, mempool):
    if not rows:
        return None
    row = max(rows, key=lambda candidate: candidate["block_production_ms"])
    return {
        "blockNumber": row["block_number"],
        "blockProductionMs": row["block_production_ms"],
        "closeBlockMs": row["close_block_total_ms"],
        "transactions": row["txs_executed"],
        "batches": row.get("batches_executed"),
        "sierraGas": row.get("bouncer_sierra_gas"),
        "merklizationMs": row["merklization_ms"],
        "dbWriteMs": row["db_write_ms"],
        "mempoolMaxTransactions": mempool["maxTransactions"],
        "mempoolMaxReadyTransactions": mempool["maxReadyTransactions"],
    }


def summarize(rows, node_metrics):
    busy = [row for row in rows if row["txs_executed"] > 0]
    mempool = summarize_mempool(node_metrics)
    summary = {
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
            "l2GasConsumed": sum(row["l2_gas_consumed"] for row in rows),
        },
        "transactionsPerBusyBlock": metric(
            [row["txs_executed"] for row in busy], include_p95=False
        ),
        "sierraGasPerBusyBlock": metric(
            [row.get("bouncer_sierra_gas", 0) for row in busy]
        ),
        "blockProductionMs": metric([row["block_production_ms"] for row in rows]),
        "closeBlockMs": metric([row["close_block_total_ms"] for row in rows]),
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
        "executionAmplification": execution_amplification(node_metrics),
    }
    summary["slowestBlock"] = summarize_slowest_block(busy or rows, mempool)
    return summary


def print_text(summary):
    blocks = summary["blocks"]
    transactions = summary["transactions"]
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
    parser.add_argument("--since")
    parser.add_argument("--until")
    args = parser.parse_args()
    rows = read_log(args.since, args.until)
    node_metrics = read_metrics(args.metrics, args.since, args.until)
    summary = summarize(rows, node_metrics)
    if args.json:
        print(json.dumps(summary, separators=(",", ":")))
        return
    if summary["blocks"]["count"] == 0:
        print("no closed blocks in range")
        return
    print_text(summary)


if __name__ == "__main__":
    main()
