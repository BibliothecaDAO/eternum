import { describe, expect, it } from "bun:test";
import { mapWithConcurrency } from "./account-factory";
import {
  RECEIPT_POLL_INTERVAL_MS,
  chooseOutwardDirection,
  createRpcMetrics,
  millisecondsUntilNextArmyTick,
  neighbor,
  oppositeDirection,
  parseStructureIds,
  prioritizeExplorer,
  resolveActionKind,
} from "./driver";
import { percentile, summarizeCompletedMix, summarizeRequestedMix, summarizeRpcMetrics } from "./report";
import { parseHarnessArgs } from "./run";
import { ToriiObserver } from "./torii-observer";

describe("Madara harness workload", () => {
  it("separates the requested mix from completed outcomes", () => {
    const actions = [
      { kind: "move", outcome: "completed" },
      { kind: "explore", outcome: "reverted" },
      { kind: "produce", outcome: "completed" },
    ] as const;
    expect(summarizeRequestedMix(actions)).toEqual({ move: 1, explore: 1, produce: 1 });
    expect(summarizeCompletedMix(actions)).toEqual({ move: 1, explore: 0, produce: 1 });
  });

  it("requests the 50/30/20 acceptance pattern", () => {
    expect(Array.from({ length: 40 }, (_, tick) => resolveActionKind(tick))).toEqual([
      ...Array.from({ length: 4 }, () => [
        "explore",
        "explore",
        "explore",
        "move",
        "move",
        "produce",
        "move",
        "move",
        "produce",
        "move",
      ]).flat(),
    ]);
  });

  it("polls receipts below the previous 250 ms measurement floor", () => {
    expect(RECEIPT_POLL_INTERVAL_MS).toBe(50);
  });

  it("parses the Torii settlement encodings seen across versions", () => {
    expect(parseStructureIds("[2,5,8]")).toEqual(["2", "5", "8"]);
    expect(parseStructureIds("0x2, 0x5, 8")).toEqual(["2", "5", "8"]);
  });

  it("keeps the first route step pointed away from map center", () => {
    expect(chooseOutwardDirection({ x: 110, y: 100 }, { x: 100, y: 100 })).toBe(0);
    expect(neighbor({ x: 110, y: 100 }, 0)).toEqual({ x: 111, y: 100 });
    expect(oppositeDirection(0)).toBe(3);
    expect(oppositeDirection(5)).toBe(2);
  });

  it("waits through the next complete army tick", () => {
    expect(millisecondsUntilNextArmyTick(Date.UTC(2026, 7, 25, 12, 0, 0))).toBe(61_000);
    expect(millisecondsUntilNextArmyTick(Date.UTC(2026, 7, 25, 12, 0, 59))).toBe(2_000);
  });

  it("keeps an explorer at the frontier throughout the acceptance workload", () => {
    const explorers = [0, 1, 2].map((id) => ({ atFrontier: true, id, lastUsedAt: -1 }));

    for (let tick = 0; tick < 40; tick += 1) {
      const kind = resolveActionKind(tick);
      if (kind === "produce") continue;

      const candidates = kind === "explore" ? explorers.filter(({ atFrontier }) => atFrontier) : explorers;
      const selected = prioritizeExplorer(candidates, kind);
      expect(selected, `tick ${tick.toString()} ${kind}`).toBeDefined();
      selected!.lastUsedAt = tick;
      if (kind === "move") selected!.atFrontier = !selected!.atFrontier;
    }
  });
});

describe("Madara harness reporting", () => {
  it("uses nearest-rank percentiles", () => {
    expect(percentile([5, 1, 4, 2, 3], 50)).toBe(3);
    expect(percentile([5, 1, 4, 2, 3], 95)).toBe(5);
    expect(percentile([], 95)).toBeNull();
  });

  it("totals the measured driver RPC methods", () => {
    const transaction = createRpcMetrics();
    transaction.estimateInvokeFee = { calls: 1, wallMs: 12.345 };
    transaction.getTransactionStatus = { calls: 3, wallMs: 7.891 };
    const overhead = createRpcMetrics();
    overhead.getBlock = { calls: 2, wallMs: 4.567 };

    expect(summarizeRpcMetrics([transaction], overhead)).toEqual({
      methods: {
        estimateInvokeFee: { calls: 1, wallMs: 12.35 },
        getBlock: { calls: 2, wallMs: 4.57 },
        getTransactionStatus: { calls: 3, wallMs: 7.89 },
      },
      total: { calls: 6, wallMs: 24.81 },
    });
  });

  it("parses block statistics as structured nearest-rank evidence", async () => {
    const rows = [blockRow(10, 1, 10), blockRow(11, 3, 30)];
    const process = Bun.spawn(["python3", `${import.meta.dir}/../scripts/block-stats.py`, "--json"], {
      stdin: new Blob([rows.map((row) => JSON.stringify(row)).join("\n")]),
      stdout: "pipe",
    });
    const output = await new Response(process.stdout).json();
    expect(await process.exited).toBe(0);
    expect(output).toMatchObject({
      blocks: { count: 2, busy: 2, first: 10, last: 11 },
      transactions: { executed: 4, reverted: 0, rejected: 0 },
      transactionsPerBusyBlock: { p50: 1, max: 3 },
      blockProductionMs: { p50: 10, p95: 30, max: 30 },
    });
  });
});

describe("Madara harness Torii observer", () => {
  it("batches concurrent transaction and explorer observations", async () => {
    let requests = 0;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        requests += 1;
        const query = new URL(request.url).searchParams.get("query") ?? "";
        if (query.includes("FROM transactions")) {
          return Response.json([
            { transaction_hash: "0x1", source: "transactions" },
            { transaction_hash: "0x1", source: "events" },
            { transaction_hash: "0x2", source: "transactions" },
            { transaction_hash: "0x2", source: "events" },
          ]);
        }
        return Response.json([explorerRow("11", "event-11"), explorerRow("12", "event-12")]);
      },
    });

    try {
      const observer = new ToriiObserver(`http://127.0.0.1:${server.port}`, 5);
      const observations = await Promise.all([
        observer.waitForTransaction("0x1", 1_000),
        observer.waitForTransaction("0x2", 1_000),
        observer.waitForExplorer(7, "11", "previous-11", 1_000),
        observer.waitForExplorer(7, "12", "previous-12", 1_000),
      ]);

      expect(observations[0]).toMatchObject({
        eventIndexedAt: expect.any(Number),
        transactionIndexedAt: expect.any(Number),
      });
      expect(observations[1]).toMatchObject({
        eventIndexedAt: expect.any(Number),
        transactionIndexedAt: expect.any(Number),
      });
      expect(observations[2]).toMatchObject({ explorerId: "11", eventId: "event-11" });
      expect(observations[3]).toMatchObject({ explorerId: "12", eventId: "event-12" });
      expect(requests).toBe(2);
    } finally {
      server.stop(true);
    }
  });

  it("observes a production labor or wood-output delta", async () => {
    let resourceReads = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        resourceReads += 1;
        return Response.json([
          resourceRow("11", resourceReads === 1 ? "event-1" : "event-2", "100", resourceReads === 1 ? "4" : "9"),
        ]);
      },
    });

    try {
      const observer = new ToriiObserver(`http://127.0.0.1:${server.port}`, 5);
      const before = await observer.readResource(7, "11");
      const after = await observer.waitForResource(7, "11", before, 1_000);
      expect(after).toMatchObject({ structureId: "11", laborBalance: 100n, woodOutput: 9n });
    } finally {
      server.stop(true);
    }
  });

  it("rejects an indexed production event with no resource delta", async () => {
    let resourceReads = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        resourceReads += 1;
        return Response.json([resourceRow("11", resourceReads === 1 ? "event-1" : "event-2", "100", "4")]);
      },
    });

    try {
      const observer = new ToriiObserver(`http://127.0.0.1:${server.port}`, 5);
      const before = await observer.readResource(7, "11");
      await expect(observer.waitForResource(7, "11", before, 1_000)).rejects.toThrow(
        "without a labor or wood output delta",
      );
    } finally {
      server.stop(true);
    }
  });
});

describe("Madara harness CLI and concurrency", () => {
  it("parses an explicit smoke-run configuration", () => {
    expect(
      parseHarnessArgs(["--bots", "4", "--minutes", "0.5", "--interval-seconds", "5", "--game-id", "9"]),
    ).toMatchObject({ bots: 4, minutes: 0.5, intervalSeconds: 5, gameId: 9, gameName: "game-9" });
  });

  it("preserves input order while bounding concurrent work", async () => {
    let active = 0;
    let maximumActive = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Bun.sleep(2);
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([2, 4, 6, 8]);
    expect(maximumActive).toBe(2);
  });
});

function explorerRow(explorerId: string, eventId: string) {
  return {
    event_id: eventId,
    explorer_id: explorerId,
    owner: explorerId,
    stamina: "120",
    stamina_tick: "1",
    x: 1,
    y: 2,
  };
}

function resourceRow(structureId: string, eventId: string, laborBalance: string, woodOutput: string) {
  return {
    event_id: eventId,
    labor_balance: laborBalance,
    structure_id: structureId,
    wood_output: woodOutput,
  };
}

function blockRow(blockNumber: number, transactions: number, blockProductionMs: number) {
  return {
    message: "close_block_complete",
    block_number: blockNumber,
    txs_executed: transactions,
    txs_reverted: 0,
    txs_rejected: 0,
    classes_declared: 0,
    deployed_contracts: 0,
    l2_gas_consumed: 100,
    block_production_ms: blockProductionMs,
    close_block_total_ms: blockProductionMs + 1,
    merklization_ms: 2,
    db_write_ms: 1,
  };
}
