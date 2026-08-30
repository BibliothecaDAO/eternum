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
import { createHarnessProvider, parseHarnessArgs } from "./run";
import {
  parseLedgerBotIdentities,
  rankPlayersByRegisteredPoints,
  toHarnessGameplayIdentities,
} from "./ledger-mode";
import { BlockTag } from "starknet";
import { HeraldObserver } from "./herald-observer";

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
    const actions = Array.from({ length: 80 }, (_, tick) => ({ kind: resolveActionKind(tick) }));

    expect(actions.slice(0, 3).map(({ kind }) => kind)).toEqual(["explore", "explore", "explore"]);
    expect(actions.slice(3).some(({ kind }, index, rest) => kind === "explore" && rest[index + 1]?.kind === kind)).toBe(
      false,
    );
    expect(summarizeRequestedMix(actions.slice(0, 40))).toEqual({ explore: 12, move: 20, produce: 8 });
    expect(summarizeRequestedMix(actions)).toEqual({ explore: 24, move: 40, produce: 16 });
  });

  it("polls receipts below the previous 250 ms measurement floor", () => {
    expect(RECEIPT_POLL_INTERVAL_MS).toBe(50);
  });

  it("reads implicit account nonces from the pre-confirmed block", () => {
    expect(createHarnessProvider("http://rpc.test").channel.blockIdentifier).toBe(BlockTag.PRE_CONFIRMED);
  });

  it("parses historical settlement encodings", () => {
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
    expect(classifyWorkloadFailure(new Error("one of the tiles in path is not explored"))).toBe("harness_pathing");
    expect(classifyWorkloadFailure(new Error("production completed without a labor or wood output delta"))).toBe(
      "chain_or_driver",
    );
    expect(classifyWorkloadFailure(new Error("Herald snapshot timed out"))).toBe("chain_or_driver");
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
      systems: {
        blitzRealm: "0x1",
        prizeDistribution: "0x5",
        production: "0x2",
        troopManagement: "0x3",
        troopMovement: "0x4",
      },
      heraldUrl: "http://127.0.0.1:1",
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
        getTransactionReceipt: { calls: 0, wallMs: 0 },
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

describe("Madara harness Herald observer", () => {
  it("waits for the confirmed fold to contain every setup row", async () => {
    let reads = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        reads += 1;
        return heraldSnapshot("Structure", reads === 1 ? [] : [{ entity_id: "11" }]);
      },
    });

    try {
      const observer = new HeraldObserver(`http://127.0.0.1:${server.port}`, "madara", 5);
      const rows = await observer.waitForModelRows(
        7,
        ["Structure"],
        (models) => models.get("Structure")?.length === 1,
        1_000,
      );

      expect(rows.get("Structure")).toEqual([{ entity_id: "11" }]);
      expect(reads).toBe(2);
    } finally {
      server.stop(true);
    }
  });

  it("coalesces concurrent explorer snapshot reads", async () => {
    let requests = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        requests += 1;
        return heraldSnapshot("ExplorerTroops", [explorerRow("11", 1), explorerRow("12", 1)]);
      },
    });

    try {
      const observer = new HeraldObserver(`http://127.0.0.1:${server.port}`, "madara", 5);
      const observations = await Promise.all([
        observer.waitForExplorer(7, "11", { x: 0, y: 2, stamina: 120, staminaUpdatedTick: 1 }, 12, 1_000),
        observer.waitForExplorer(7, "12", { x: 0, y: 2, stamina: 120, staminaUpdatedTick: 1 }, 12, 1_000),
      ]);

      expect(observations[0]).toMatchObject({ explorerId: "11", x: 1 });
      expect(observations[1]).toMatchObject({ explorerId: "12", x: 1 });
      expect(requests).toBe(1);
    } finally {
      server.stop(true);
    }
  });

  it("waits for Herald to fold the transaction's accepted block", async () => {
    let requests = 0;
    const server = Bun.serve({
      port: 0,
      fetch() {
        requests += 1;
        return heraldSnapshot("ExplorerTroops", [explorerRow("11", requests)], requests === 1 ? 11 : 12);
      },
    });

    try {
      const observer = new HeraldObserver(`http://127.0.0.1:${server.port}`, "madara", 5);
      const explorer = await observer.waitForExplorer(
        7,
        "11",
        { x: 0, y: 2, stamina: 120, staminaUpdatedTick: 1 },
        12,
        1_000,
      );

      expect(explorer.x).toBe(2);
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
        return heraldSnapshot("Resource", [resourceRow("11", "100", resourceReads === 1 ? "4" : "9")]);
      },
    });

    try {
      const observer = new HeraldObserver(`http://127.0.0.1:${server.port}`, "madara", 5);
      const before = await observer.readResource(7, "11");
      const after = await observer.waitForResource(7, "11", before, 12, 1_000);
      expect(after).toMatchObject({ structureId: "11", laborBalance: 100n, woodOutput: 9n });
    } finally {
      server.stop(true);
    }
  });

  it("rejects a production action with no resource delta", async () => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return heraldSnapshot("Resource", [resourceRow("11", "100", "4")]);
      },
    });

    try {
      const observer = new HeraldObserver(`http://127.0.0.1:${server.port}`, "madara", 5);
      const before = await observer.readResource(7, "11");
      await expect(observer.waitForResource(7, "11", before, 12, 20)).rejects.toThrow(
        "did not show a labor or wood",
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

  it("requires an exact persistent identity roster in ledger mode", () => {
    expect(() => parseHarnessArgs(["--ledger"])).toThrow("--ledger-accounts is required with --ledger");
    expect(() => parseHarnessArgs(["--ledger", "--ledger-accounts", "bots.json", "--games", "2"])).toThrow(
      "--ledger supports one game per run",
    );
    expect(
      parseHarnessArgs([
        "--ledger",
        "--ledger-accounts",
        "bots.json",
        "--bots",
        "2",
        "--ledger-start-delay-seconds",
        "600",
      ]),
    ).toMatchObject({
      bots: 2,
      ledger: true,
      ledgerAccountsPath: "bots.json",
      ledgerStartDelaySeconds: 600,
    });
  });

  it("maps validated mainnet owners to persistent gameplay keys without exposing mainnet keys", () => {
    const identities = parseLedgerBotIdentities(
      [
        { mainnetAddress: "0x1", mainnetPrivateKey: "0x11", gameplayPrivateKey: "0x21" },
        {
          mainnetAddress: "0x2",
          mainnetPrivateKey: "0x12",
          gameplayPrivateKey: "0x22",
          sword: true,
        },
      ],
      2,
    );

    expect(identities.map(({ sword, shield }) => ({ sword, shield }))).toEqual([
      { sword: false, shield: false },
      { sword: true, shield: false },
    ]);
    expect(identities[0]!.mainnetAddress.endsWith("1")).toBe(true);
    expect(identities[1]!.mainnetAddress.endsWith("2")).toBe(true);
    expect(toHarnessGameplayIdentities(identities)).toEqual([
      { owner: identities[0]!.mainnetAddress, privateKey: "0x21" },
      { owner: identities[1]!.mainnetAddress, privateKey: "0x22" },
    ]);
    expect(() => parseLedgerBotIdentities([identities[0]], 2)).toThrow("Expected 2 ledger bot identities");
  });

  it("submits the full roster by points with deterministic tie ordering", () => {
    const players = rankPlayersByRegisteredPoints(
      [{ player: "0x3" }, { player: "0x1" }, { player: "0x2" }, { player: "0x1" }],
      [
        { address: "0x1", registered_points: "50" },
        { address: "0x2", registered_points: "100" },
        { address: "0x3", registered_points: "100" },
      ],
    );

    expect(players.map((address) => BigInt(address))).toEqual([2n, 3n, 1n]);
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

function heraldSnapshot(model: string, values: Array<Record<string, unknown>>, confirmedBlock = 12) {
  return Response.json({
    confirmed_block: confirmedBlock,
    game_id: "7",
    models: [{ model, rows: values.map((value, index) => ({ key: `0x${index + 1}`, value })) }],
  });
}

function explorerRow(explorerId: string, x: number) {
  return {
    explorer_id: explorerId,
    owner: explorerId,
    troops: { stamina: { amount: "120", updated_tick: "1" } },
    coord: { x, y: 2 },
  };
}

function resourceRow(structureId: string, laborBalance: string, woodOutput: string) {
  return {
    entity_id: structureId,
    LABOR_BALANCE: laborBalance,
    WOOD_PRODUCTION: { output_amount_left: woodOutput },
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
