import { describe, expect, it } from "bun:test";
import { BiomeType } from "../../../packages/types/src/constants/hex";
import { mapWithConcurrency } from "./account-factory";
import {
  RECEIPT_POLL_INTERVAL_MS,
  chooseOutwardDirection,
  classifyWorkloadFailure,
  classifyWorkloadRevertReason,
  createRpcMetrics,
  hasExplorerWithStamina,
  millisecondsUntilNextArmyTick,
  neighbor,
  oppositeDirection,
  parseStructureIds,
  prioritizeExplorer,
  resolveActionKind,
  resolveExplorerActionStaminaCost,
  resolveWorkloadTicks,
  runWorkload,
  type HarnessBot,
} from "./driver";
import {
  isThresholdBlockingFailure,
  percentile,
  summarizeCompletedMix,
  summarizeRequestedMix,
  summarizeRevertReasons,
  summarizeRpcMetrics,
} from "./report";
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

  it("starts once each bot has one explorer action of stamina", () => {
    expect(hasExplorerWithStamina([{ stamina: 29, staminaUpdatedTick: 10 }], 10, 30)).toBe(false);
    expect(hasExplorerWithStamina([{ stamina: 0, staminaUpdatedTick: 10 }], 11, 30)).toBe(true);
    expect(
      hasExplorerWithStamina(
        [
          { stamina: 0, staminaUpdatedTick: 10 },
          { stamina: 30, staminaUpdatedTick: 10 },
        ],
        10,
        30,
      ),
    ).toBe(true);
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

  it("separates game-rule exhaustion from harness pathing", () => {
    expect(classifyWorkloadFailure(new Error("No explorer has 30 stamina for explore"))).toBe("game_rule_limit");
    expect(classifyWorkloadFailure(new Error("one of the tiles in path is occupied"))).toBe("harness_pathing");
    expect(classifyWorkloadFailure(new Error("indexed production event without a labor or wood output delta"))).toBe(
      "chain_or_driver",
    );
    expect(classifyWorkloadFailure(new Error("Torii query timed out"))).toBe("chain_or_driver");
  });

  it("records an action RPC failure instead of rejecting the workload", async () => {
    let blockReads = 0;
    const provider = {
      async getBlock() {
        blockReads += 1;
        if (blockReads === 1) return { timestamp: 60 };
        throw new Error("The socket connection was closed unexpectedly");
      },
    };
    const workload = await runWorkload({
      bots: [readyHarnessBot()],
      intervalSeconds: 1,
      minutes: 0.001,
      provider: provider as never,
      systems: { blitzRealm: "0x1", production: "0x2", troopManagement: "0x3", troopMovement: "0x4" },
      toriiSqlUrl: "http://127.0.0.1:1/sql",
    });

    expect(workload.actions).toHaveLength(1);
    expect(workload.actions[0]).toMatchObject({
      failureClass: "chain_or_driver",
      outcome: "driver_failed",
      rpc: { getBlock: { calls: 1 } },
    });
  });

  it("classifies revert reasons without treating human tile contention as a threshold failure", () => {
    expect(classifyWorkloadRevertReason("one of the tiles in path is occupied")).toBe("tile_contention");
    expect(classifyWorkloadRevertReason("insufficient stamina")).toBe("stamina");
    expect(classifyWorkloadRevertReason("not enough labor")).toBe("labor");
    expect(classifyWorkloadRevertReason("unexpected revert")).toBe("other");

    const contention = { outcome: "reverted", revertReason: "tile_contention" } as const;
    const stamina = { outcome: "reverted", revertReason: "stamina" } as const;
    expect(isThresholdBlockingFailure(contention)).toBe(false);
    expect(isThresholdBlockingFailure(stamina)).toBe(true);
    expect(summarizeRevertReasons([contention, stamina])).toEqual({
      tileContention: 1,
      stamina: 1,
      labor: 0,
      other: 0,
    });
  });

  it("uses the game-configured stamina cost for each explorer action", () => {
    expect(resolveExplorerActionStaminaCost("explore", BiomeType.Scorched, 0)).toBe(30);
    expect(resolveExplorerActionStaminaCost("move", BiomeType.DeepOcean, 0)).toBe(10);
    expect(resolveExplorerActionStaminaCost("move", BiomeType.Beach, 0)).toBe(20);
    expect(resolveExplorerActionStaminaCost("move", BiomeType.Scorched, 0)).toBe(30);
    expect(resolveExplorerActionStaminaCost("move", BiomeType.Taiga, 1)).toBe(30);
    expect(resolveExplorerActionStaminaCost("move", BiomeType.Tundra, 1)).toBe(10);
  });

  it("keeps every cadence boundary inside a probe window", () => {
    expect(resolveWorkloadTicks(1, 8)).toBe(8);
    expect(resolveWorkloadTicks(10, 15)).toBe(40);
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
    const rows = [blockRow(10, 1, 10), mempoolRow(7, 5), blockRow(11, 3, 30), mempoolRow(2, 1)];
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
      mempool: { samples: 2, maxTransactions: 7, maxReadyTransactions: 5, lastObservedTransactions: 2 },
      sierraGasPerBusyBlock: { p50: 100, p95: 300, max: 300 },
      slowestBlock: {
        blockNumber: 11,
        blockProductionMs: 30,
        transactions: 3,
        sierraGas: 300,
        mempoolMaxTransactions: 7,
      },
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

  it("parameterizes concurrent games in one process", () => {
    expect(parseHarnessArgs(["--games", "4"])).toMatchObject({ bots: 96, games: 4, intervalSeconds: 15 });
    expect(() => parseHarnessArgs(["--games", "2", "--game-id", "9"])).toThrow(
      "--game-id can only be used with --games 1",
    );
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

function readyHarnessBot(): HarnessBot {
  return {
    account: {},
    address: "0x1",
    botId: 1,
    explorers: [
      {
        atFrontier: true,
        blockedDirections: new Map(),
        coord: { x: 1, y: 1 },
        explorerId: "1",
        lastUsedAt: -1,
        modelEventId: "event-1",
        outwardDirection: 0,
        pathDirections: [],
        stamina: 30,
        staminaUpdatedTick: 1,
        structureId: "1",
        troopType: 0,
      },
    ],
    gameId: 1,
    nextProductionStructure: 0,
    structures: [{ coord: { x: 0, y: 0 }, direction: 0, structureId: "1" }],
  } as HarnessBot;
}

function blockRow(blockNumber: number, transactions: number, blockProductionMs: number) {
  return {
    message: "close_block_complete",
    block_number: blockNumber,
    txs_executed: transactions,
    txs_added_to_block: transactions,
    txs_reverted: 0,
    txs_rejected: 0,
    classes_declared: 0,
    deployed_contracts: 0,
    l2_gas_consumed: 100,
    bouncer_sierra_gas: transactions * 100,
    batches_executed: 1,
    block_production_ms: blockProductionMs,
    close_block_total_ms: blockProductionMs + 1,
    merklization_ms: 2,
    db_write_ms: 1,
  };
}

function mempoolRow(transactions: number, ready: number) {
  return {
    message: `Inserted 1 transaction to the mempool [${transactions}/10000 transaction(s), ${transactions} account(s), ${ready} ready]`,
  };
}
