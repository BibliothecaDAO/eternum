import { describe, expect, it } from "bun:test";
import { ActionPaths, ActionType, type GameActions } from "@bibliothecadao/eternum";
import type { Account, RpcProvider } from "starknet";
import { mapWithConcurrency } from "./account-factory";
import {
  RECEIPT_POLL_INTERVAL_MS,
  chooseOutwardDirection,
  classifyWorkloadFailure,
  classifyWorkloadRevertReason,
  createRpcMetrics,
  neighbor,
  oppositeDirection,
  prioritizeExplorer,
  resolveActionKind,
  resolveWorkloadTicks,
  runWorkload,
  type HarnessBot,
} from "./driver";
import type { Coord, ExplorerRow, HarnessGame, ProductionState } from "./harness-game";
import {
  isThresholdBlockingFailure,
  percentile,
  summarizeCompletedMix,
  summarizeRequestedMix,
  summarizeRevertReasons,
  summarizeRpcMetrics,
} from "./report";
import { createHarnessProvider, parseHarnessArgs } from "./run";
import { parseLedgerBotIdentities, rankPlayersByRegisteredPoints, toHarnessGameplayIdentities } from "./ledger-mode";
import { BlockTag } from "starknet";
import { HeraldObserver, parseStructureIds } from "./herald-observer";

describe("Madara harness workload", () => {
  it("selects Eternum and rejects incompatible ledger registration", () => {
    expect(parseHarnessArgs([]).gameType).toBe("blitz");
    expect(parseHarnessArgs(["--game-type", "eternum"]).gameType).toBe("eternum");
    expect(() => parseHarnessArgs(["--game-type", "unknown"])).toThrow("--game-type must be blitz or eternum");
    expect(() => parseHarnessArgs(["--game-type", "eternum", "--ledger"])).toThrow(
      "The ledger harness currently registers Blitz passes only",
    );
  });

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
    } as unknown as RpcProvider;
    const world = fakeWorld();
    const workload = await runWorkload({
      bots: [readyHarnessBot(world)],
      game: world.game,
      intervalSeconds: 1,
      minutes: 0.001,
      provider,
    });

    expect(workload.actions).toHaveLength(1);
    expect(workload.actions[0]).toMatchObject({
      failureClass: "chain_or_driver",
      outcome: "driver_failed",
      rpc: { getBlock: { calls: 1 } },
    });
  });

  it("plays every explorer step through the bot's client actions and reads the result from RECS", async () => {
    const world = fakeWorld();
    const bot = readyHarnessBot(world);
    const workload = await runWorkload({
      bots: [bot],
      game: world.game,
      intervalSeconds: 0.01,
      minutes: 0.001,
      provider: confirmingProvider(),
    });

    expect(workload.actions.map(({ kind, outcome }) => `${kind}:${outcome}`)).toEqual([
      "explore:completed",
      "explore:completed",
      "explore:completed",
      "move:completed",
      "produce:completed",
      "move:completed",
    ]);
    expect(world.moves.map((move) => ActionPaths.getActionType(move.path))).toEqual([
      ActionType.Explore,
      ActionType.Explore,
      ActionType.Explore,
      ActionType.Move,
      ActionType.Move,
    ]);
    expect(world.moves.every((move) => move.explorerId === 1 && move.path.length === 2)).toBe(true);
    expect(workload.actions[4]?.productionDelta).toMatchObject({ laborDelta: "-1", woodOutputDelta: "1" });
    expect(bot.explorers[0]).toMatchObject({ atFrontier: true, pathDirections: [0, 0, 0] });
    expect(world.game.explorer(1)?.coord).toEqual({ x: 4, y: 1 });
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
        observer.waitForExplorer(7, "11", { alt: false, x: 0, y: 2, stamina: 120, staminaUpdatedTick: 1 }, 12, 1_000),
        observer.waitForExplorer(7, "12", { alt: false, x: 0, y: 2, stamina: 120, staminaUpdatedTick: 1 }, 12, 1_000),
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
        { alt: false, x: 0, y: 2, stamina: 120, staminaUpdatedTick: 1 },
        12,
        1_000,
      );

      expect(explorer.x).toBe(2);
      expect(requests).toBe(2);
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

  it("holds one game per process", () => {
    expect(parseHarnessArgs([])).toMatchObject({ bots: 96, intervalSeconds: 15 });
    expect(() => parseHarnessArgs(["--games", "2"])).toThrow("one game per process");
  });

  it("requires an exact persistent identity roster in ledger mode", () => {
    expect(() => parseHarnessArgs(["--ledger"])).toThrow("--ledger-accounts is required with --ledger or --sweep-only");
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
    expect(
      parseHarnessArgs(["--sweep-only", ".lab/runs/recovery.json", "--ledger-accounts", "bots.json"]),
    ).toMatchObject({
      ledger: false,
      ledgerAccountsPath: "bots.json",
      sweepOnlyManifestPath: ".lab/runs/recovery.json",
    });
    expect(() =>
      parseHarnessArgs(["--ledger", "--sweep-only", "recovery.json", "--ledger-accounts", "bots.json"]),
    ).toThrow("--ledger and --sweep-only are separate modes");
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
    coord: { alt: false, x, y: 2 },
  };
}

function resourceRow(structureId: string, laborBalance: string, woodOutput: string) {
  return {
    entity_id: structureId,
    LABOR_BALANCE: laborBalance,
    WOOD_PRODUCTION: { output_amount_left: woodOutput },
  };
}

function readyHarnessBot(world: FakeWorld): HarnessBot {
  return {
    account: { address: "0x1" } as Account,
    actions: world.actions,
    address: "0x1",
    botId: 1,
    explorers: [
      {
        atFrontier: true,
        blockedDirections: new Map(),
        explorerId: 1,
        lastUsedAt: -1,
        outwardDirection: 0,
        pathDirections: [],
        structureId: 1,
      },
    ],
    gameId: 1,
    nextProductionStructure: 0,
    structures: [{ coord: { x: 0, y: 0 }, direction: 0, structureId: 1 }],
  } as unknown as HarnessBot;
}

interface FakeWorld {
  actions: GameActions;
  game: HarnessGame;
  moves: Array<{ explorerId: number; path: Array<{ hex: { col: number; row: number }; actionType: ActionType }> }>;
}

/** One explorer at (1, 1) with full stamina on an unexplored map; every action lands in "RECS" as it is submitted. */
function fakeWorld(): FakeWorld {
  const explorers = new Map<number, ExplorerRow>([
    [1, { coord: { x: 1, y: 1 }, staminaAmount: 120n, staminaUpdatedTick: 1n }],
  ]);
  const production = new Map<number, ProductionState>([[1, { laborBalance: 100n, woodOutput: 4n }]]);
  const explored = new Set<string>(["1:1"]);
  const listeners = new Set<() => void>();
  const moves: FakeWorld["moves"] = [];
  const key = (coord: Coord) => `${coord.x}:${coord.y}`;
  const changed = () => listeners.forEach((listener) => listener());
  let nextHash = 1;

  const actions = {
    armyPaths: ({ explorerId }: { explorerId: number }) => {
      const paths = new ActionPaths();
      const from = explorers.get(explorerId)!.coord;
      for (const direction of [0, 1, 2, 3, 4, 5]) {
        const target = neighbor(from, direction);
        paths.set(ActionPaths.posKey({ col: target.x, row: target.y }), [
          { hex: { col: from.x, row: from.y }, actionType: ActionType.Move },
          {
            hex: { col: target.x, row: target.y },
            actionType: explored.has(key(target)) ? ActionType.Move : ActionType.Explore,
          },
        ]);
      }
      return paths;
    },
    moveArmy: async ({ explorerId, path }: FakeWorld["moves"][number]) => {
      moves.push({ explorerId, path });
      const step = path.at(-1)!.hex;
      const current = explorers.get(explorerId)!;
      explorers.set(explorerId, { ...current, coord: { x: step.col, y: step.row }, staminaAmount: current.staminaAmount - 10n });
      explored.add(key({ x: step.col, y: step.row }));
      changed();
    },
  } as unknown as GameActions;

  const game: HarnessGame = {
    gameId: 1,
    actionsFor: () => actions,
    ticksAt: (timestamp) => ({ armies: Math.floor(timestamp / 60), default: timestamp }),
    mapCenter: () => ({ x: 0, y: 0 }),
    settlementStructureIds: () => undefined,
    structureCoord: () => undefined,
    startingTroopType: () => undefined,
    explorerOf: () => undefined,
    explorer: (explorerId) => explorers.get(explorerId),
    explorerStamina: (explorerId) => Number(explorers.get(explorerId)!.staminaAmount),
    minimumStaminaFor: (kind) => (kind === "explore" ? 30 : 10),
    production: (structureId) => production.get(structureId),
    armyPathIndexes: () => ({ structureHexes: new Map(), armyHexes: new Map(), exploredHexes: new Map(), chestHexes: new Map() }),
    produceWood: async (_signer, structureId) => {
      const current = production.get(structureId)!;
      production.set(structureId, { laborBalance: current.laborBalance - 1n, woodOutput: current.woodOutput + 1n });
      changed();
    },
    submit: async (_signer, act) => ({ transactionHash: `0x${(nextHash++).toString(16)}`, confirmed: act() }),
    waitFor: (read, timeoutMs, describe) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(check);
          reject(new Error(`${describe()} did not change`));
        }, timeoutMs);
        const check = () => {
          const value = read();
          if (value === undefined) return;
          clearTimeout(timer);
          listeners.delete(check);
          resolve(value);
        };
        listeners.add(check);
        check();
      }),
  };
  return { actions, game, moves };
}

/** Every hash is accepted on L2 in block 5 as soon as it is polled. */
function confirmingProvider(): RpcProvider {
  return {
    getBlock: async () => ({ timestamp: 60 }),
    getTransactionStatus: async () => ({ finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" }),
    getTransactionReceipt: async () => ({ block_number: 5 }),
  } as unknown as RpcProvider;
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
