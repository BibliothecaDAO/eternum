#!/usr/bin/env python3
"""Summarize Madara `close_block_complete` log lines read from stdin (see block-stats.sh)."""
import json
import sys


def percentile(values, p):
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round((p / 100) * (len(ordered) - 1))))
    return ordered[index]


def main():
    rows = [json.loads(line) for line in sys.stdin if line.strip()]
    if not rows:
        print("no closed blocks in range")
        return

    txs = sum(r["txs_executed"] for r in rows)
    reverted = sum(r["txs_reverted"] for r in rows)
    rejected = sum(r["txs_rejected"] for r in rows)
    gas = sum(r["l2_gas_consumed"] for r in rows)
    production = [r["block_production_ms"] for r in rows]
    close = [r["close_block_total_ms"] for r in rows]
    busy = [r for r in rows if r["txs_executed"] > 0]

    print(f"blocks             {len(rows)}  (busy: {len(busy)})")
    print(f"blocks range       #{rows[0]['block_number']} .. #{rows[-1]['block_number']}")
    print(f"txs executed       {txs}  reverted={reverted} rejected={rejected}")
    print(f"classes declared   {sum(r['classes_declared'] for r in rows)}")
    print(f"contracts deployed {sum(r['deployed_contracts'] for r in rows)}")
    print(f"l2 gas consumed    {gas}")
    if busy:
        per_block = [r["txs_executed"] for r in busy]
        print(f"txs/busy block     max={max(per_block)} p50={percentile(per_block, 50)}")
    print(
        f"block_production   p50={percentile(production, 50):.1f}ms "
        f"p95={percentile(production, 95):.1f}ms max={max(production):.1f}ms"
    )
    print(f"close_block        p50={percentile(close, 50):.2f}ms p95={percentile(close, 95):.2f}ms max={max(close):.2f}ms")
    print(
        f"merklization max   {max(r['merklization_ms'] for r in rows):.2f}ms   "
        f"db_write max {max(r['db_write_ms'] for r in rows):.2f}ms"
    )


if __name__ == "__main__":
    main()
