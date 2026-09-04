#!/usr/bin/env python3
"""Summarize Madara ``close_block_complete`` JSON log lines from stdin."""

import argparse
import json
import math
import re
import sys


MEMPOOL_SUMMARY = re.compile(
    r"\[(?P<transactions>\d+)/(?P<capacity>\d+) transaction\(s\), "
    r"(?P<accounts>\d+) account\(s\), (?P<ready>\d+) ready\]"
)


def percentile(values, percentile_value):
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil((percentile_value / 100) * len(ordered)) - 1)
    return ordered[index]


def read_log():
    rows = []
    mempool_samples = []
    for line in sys.stdin:
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("message") == "close_block_complete":
            rows.append(row)
        mempool_match = MEMPOOL_SUMMARY.search(str(row.get("message", "")))
        if mempool_match:
            mempool_samples.append(
                {key: int(value) for key, value in mempool_match.groupdict().items()}
            )
    return rows, mempool_samples


def metric(values, include_p50=True, include_p95=True):
    result = {"max": max(values) if values else None}
    if include_p50:
        result["p50"] = percentile(values, 50)
    if include_p95:
        result["p95"] = percentile(values, 95)
    return result


def summarize_mempool(samples):
    if not samples:
        return {
            "samples": 0,
            "capacity": None,
            "maxTransactions": None,
            "maxReadyTransactions": None,
            "lastObservedTransactions": None,
            "lastObservedReadyTransactions": None,
        }
    return {
        "samples": len(samples),
        "capacity": max(sample["capacity"] for sample in samples),
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


def summarize(rows, mempool_samples):
    busy = [row for row in rows if row["txs_executed"] > 0]
    mempool = summarize_mempool(mempool_samples)
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
    args = parser.parse_args()
    rows, mempool_samples = read_log()
    summary = summarize(rows, mempool_samples)
    if args.json:
        print(json.dumps(summary, separators=(",", ":")))
        return
    if summary["blocks"]["count"] == 0:
        print("no closed blocks in range")
        return
    print_text(summary)


if __name__ == "__main__":
    main()
