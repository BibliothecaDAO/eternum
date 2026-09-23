import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { statusSubscription } from "./test-observations";
import type { HarnessProvider } from "./provider";
import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import { ActionPaths, ActionType, configManager, type GameActions } from "@bibliothecadao/eternum";
import type { Account } from "starknet";
import { mapWithConcurrency, type HarnessAccount } from "./account-factory";
import {
  chooseOutwardDirection,
  classifyWorkloadFailure,
  classifyWorkloadRevertReason,
  createRpcMetrics,
  neighbor,
  oppositeDirection,
  prioritizeExplorer,
  prepareHarnessBots,
  resolveActionKind,
  resolveWorkloadTicks,
  runWorkload,
  type HarnessBot,
  type TrackedTransaction,
} from "./driver";
import type { Coord, ExplorerRow, HarnessGame, ProductionState } from "./harness-game";
import {
  assessRosterRun,
  isThresholdBlockingFailure,
  latencyChecks,
  percentile,
  summarizeCompletedMix,
  summarizeFailureClasses,
  summarizePlayerProgress,
  summarizeRequestedMix,
  summarizeRevertReasons,
  summarizeRpcMetrics,
} from "./report";
import type { WorkerWorkloadSummary } from "./report";
import { createHarnessProvider, parseHarnessArgs } from "./run";
import { BlockTag } from "starknet";
import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { waitForGameWorkers } from "./run";

const TEST_ENDPOINTS = { RPC_URL: "http://127.0.0.1:28310/rpc/v0_10_2", HERALD_URL: "http://127.0.0.1:28311" };
const savedEndpoints = { RPC_URL: process.env.RPC_URL, HERALD_URL: process.env.HERALD_URL };
beforeAll(() => Object.assign(process.env, TEST_ENDPOINTS));
afterAll(() => {
  for (const [name, value] of Object.entries(savedEndpoints)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Madara harness workload", () => {
  it("collects other game reports after a worker reports a failed coverage gate", async () => {
    const workers = [new EventEmitter(), new EventEmitter()];
    const reports: Parameters<typeof waitForGameWorkers>[1] = [];
    let complete = false;
    const waiting = waitForGameWorkers(workers as Worker[], reports).then(() => {
      complete = true;
    });
    workers[0].emit("message", { type: "result", passed: false, path: "failed.json", pid: 1, threadId: 1 });
    workers[0].emit("exit", 1);
    await Promise.resolve();
    expect(complete).toBe(false);
    workers[1].emit("message", { type: "result", passed: true, path: "passed.json", pid: 1, threadId: 2 });
    workers[1].emit("exit", 0);
    await waiting;
    expect(reports.map(({ passed }) => passed)).toEqual([false, true]);
  });

  it("fails if a worker exits without writing its report", async () => {
    const worker = new EventEmitter();
    const waiting = waitForGameWorkers([worker as Worker], []);
    worker.emit("exit", 0);
    await expect(waiting).rejects.toThrow("without a matching result");
  });

  it("preserves a worker's setup failure in the roster result", async () => {
    const worker = new EventEmitter();
    const waiting = waitForGameWorkers([worker as Worker], []);
    worker.emit("message", { type: "failure", error: "Game 1 has ended" });
    worker.emit("exit", 1);
    await expect(waiting).rejects.toThrow("Game 1 has ended");
  });

  it.each([false, true])("creates only missing explorers when preparing the roster (resumed=%s)", async (resumed) => {
    const { game, actions } = fakeWorld();
    const settle = spyOn(game, "settle");
    const existing = new Map<number, number[]>(resumed ? [[1, [11, 21]]] : []);
    const create = mock(async ({ structureId }: { structureId: number }) => {
      existing.set(structureId, [structureId + 10]);
    });
    actions.createExplorerArmy = create;
    game.settlementStructureIds = () => [1, 2, 3];
    game.structureCoord = (id) => ({ x: id, y: 0 });
    game.startingTroopType = (id) => {
      if (existing.has(id)) throw new Error("Existing explorers do not need a new troop balance");
      return "Knight";
    };
    game.explorersOf = (id) => existing.get(id) ?? [];
    game.explorer = (id) => ({ coord: { x: id - 10, y: 0 }, staminaAmount: 120n, staminaUpdatedTick: 1n });
    game.armyPathIndexes = () =>
      ({
        structureHexes: new Map(),
        armyHexes: new Map(),
        chestHexes: new Map(),
        exploredHexes: new Map([1, 2, 3, 11].map((x) => [x, new Map([[0, {}]])])),
      }) as ReturnType<HarnessGame["armyPathIndexes"]>;
    const setupTransactions: TrackedTransaction[] = [];
    const bots = await prepareHarnessBots({
      gameType: "blitz",
      game,
      accounts: [{ botId: 1, address: "0x1", account: { address: "0x1" } }] as HarnessAccount[],
      provider: confirmingProvider(),
      setupTransactions,
    });
    expect(settle).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(resumed ? 2 : 3);
    expect(setupTransactions.map(({ kind, outcome }) => [kind, outcome])).toEqual(
      Array.from({ length: resumed ? 2 : 3 }, () => ["create-explorer", "completed"]),
    );
    expect(bots[0].explorers.map(({ explorerId }) => explorerId)).toEqual(resumed ? [11, 21, 12, 13] : [11, 12, 13]);
  });

  it("selects Eternum and rejects deferred ledger options", () => {
    expect(parseHarnessArgs([]).gameType).toBe("blitz");
    expect(parseHarnessArgs(["--game-type", "eternum"]).gameType).toBe("eternum");
    expect(parseHarnessArgs(["--game-type", "eternum"])).toMatchObject({ presetId: 3, functional: false });
    expect(parseHarnessArgs(["--preset", "4", "--workload", "burst"])).toMatchObject({
      presetId: 4,
      workload: "burst",
    });
    expect(() => parseHarnessArgs(["--preset", "9"])).toThrow("Unsupported native preset 9");
    expect(parseHarnessArgs(["--game-type", "frontier", "--bots", "1"])).toMatchObject({
      presetId: 1,
      functional: false,
    });
    // The design run plays the accelerated fixture preset; it never edits Frontier's own preset 1.
    expect(parseHarnessArgs(["--game-type", "frontier", "--bots", "2", "--functional"])).toMatchObject({
      presetId: 101,
      functional: true,
    });
    expect(() => parseHarnessArgs(["--game-type", "frontier", "--bots", "1", "--functional"])).toThrow(
      "both player profiles",
    );
    expect(() => parseHarnessArgs(["--game-type", "frontier", "--workload", "burst"])).toThrow(
      "Frontier requires the frontier workload",
    );
    expect(parseHarnessArgs(["--slot", "cap-96", "--launch-url", "https://staging.example"])).toMatchObject({
      slot: { name: "cap-96", launchUrl: "https://staging.example", closesInSeconds: 120 },
    });
    expect(() => parseHarnessArgs(["--slot", "cap-96", "--launch-url", "https://x", "--games", "4"])).toThrow(
      "omit --games",
    );
    expect(() => parseHarnessArgs(["--launch-url", "https://x"])).toThrow("require --slot");
    expect(() => parseHarnessArgs(["--game-type", "unknown"])).toThrow("--game-type must be blitz, eternum or frontier");
    expect(() => parseHarnessArgs(["--game-type", "eternum", "--ledger"])).toThrow(
      "Unsupported harness option --ledger",
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

  it("reads implicit account nonces from the pre-confirmed block", () => {
    expect(createHarnessProvider("http://rpc.test").channel.blockIdentifier).toBe(BlockTag.PRE_CONFIRMED);
  });

  it("keeps the first route step pointed away from map center", () => {
    expect(chooseOutwardDirection({ x: 110, y: 100 }, { x: 100, y: 100 })).toBe(0);
    expect(neighbor({ x: 110, y: 100 }, 0)).toEqual({ x: 111, y: 100 });
    expect(oppositeDirection(0)).toBe(3);
    expect(oppositeDirection(5)).toBe(2);
  });

  it("rotates among all explorers instead of reserving a remembered frontier", () => {
    const explorers = [0, 1, 2].map((id) => ({ id, lastUsedAt: -1 }));
    const selectedIds: number[] = [];
    for (let tick = 0; tick < 6; tick += 1) {
      const selected = prioritizeExplorer(explorers)!;
      selectedIds.push(selected.id);
      selected.lastUsedAt = tick;
    }
    expect(selectedIds).toEqual([0, 1, 2, 0, 1, 2]);
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

  it("reports a game rule refusing a move apart from chain or driver failures", () => {
    const rejected = new Error("Herald confirmation failed: Native action rejected: GAMEPLAY_REJECTED");
    expect(classifyWorkloadFailure(rejected)).toBe("gameplay_rejection");
    expect(classifyWorkloadFailure(new Error("Native action rejected: COMMAND_DISABLED"))).toBe("gameplay_rejection");
    expect(classifyWorkloadFailure(new Error("Native action rejected: INVALID_ACTOR"))).toBe("chain_or_driver");
    expect(
      summarizeFailureClasses([
        { failureClass: "gameplay_rejection" },
        { failureClass: "gameplay_rejection" },
        { failureClass: "chain_or_driver" },
      ]),
    ).toEqual({ gameRuleLimit: 0, harnessPathing: 0, gameplayRejection: 2, chainOrDriver: 1 });
  });

  it("records a lost Herald clock without fetching a block per action", async () => {
    let clockReads = 0;
    spyOn(configManager, "getMapCenter").mockReturnValue(0);
    const world = fakeWorld();
    world.game.currentTicks = () => {
      if (++clockReads === 1) return { armies: 1, default: 60 };
      throw new Error("Herald clock unavailable");
    };
    const workload = await runWorkload({
      bots: [readyHarnessBot(world)],
      game: world.game,
      intervalSeconds: 1,
      minutes: 0.001,
      provider: confirmingProvider(),
    });
    expect(workload.actions).toHaveLength(1);
    expect(workload.actions[0]).toMatchObject({
      failureClass: "chain_or_driver",
      outcome: "driver_failed",
      rpc: { getBlock: { calls: 0 } },
    });
  });

  it("runs Smart production once per minute alongside fresh build orders and exploration", async () => {
    spyOn(configManager, "getMapCenter").mockReturnValue(0);
    let now = 1_000_000;
    spyOn(Date, "now").mockImplementation(() => now);
    const world = fakeWorld();
    const productionAt: number[] = [];
    let buildings = 0;
    const workload = await runWorkload({
      bots: [readyHarnessBot(world)],
      game: world.game,
      intervalSeconds: 0.01,
      minutes: 0.001,
      provider: confirmingProvider(),
      buildOrder: {
        automate: () => {
          productionAt.push(now);
          return { kind: "automate-production", run: async () => {} };
        },
        build: () => {
          const expected = buildings;
          return {
            kind: "build-wheat",
            run: async () => {
              expect(buildings).toBe(expected);
              buildings += 1;
              now += 30_000;
            },
          };
        },
        explorers: () => [1],
      },
    });
    expect(productionAt).toEqual([1_000_000, 1_060_000, 1_120_000]);
    expect(buildings).toBe(6);
    expect(workload.actions.filter((action) => action.kind === "explore")).toHaveLength(3);
    expect(workload.actions.filter((action) => action.outcome !== "completed")).toEqual([]);
    expect(workload.profile).toBe("build-order");
    expect(summarizeCompletedMix(workload.actions)).toEqual({
      "build-wheat": 6,
      "automate-production": 3,
      explore: 3,
      move: 2,
      produce: 0,
    });
    expect(summarizePlayerProgress([1, 2], workload.actions)).toMatchObject([
      {
        botId: 1,
        completed: { "build-wheat": 6, "automate-production": 3, explore: 3, move: 2 },
        failed: 0,
        progressed: true,
      },
      { botId: 2, completed: {}, failed: 0, lastCompletedAt: null, progressed: false },
    ]);
  });

  it("does not fabricate successful build actions when production or recommendations are unavailable", async () => {
    spyOn(configManager, "getMapCenter").mockReturnValue(0);
    const world = fakeWorld();
    const workload = await runWorkload({
      bots: [readyHarnessBot(world)],
      game: world.game,
      intervalSeconds: 1,
      minutes: 0.001,
      provider: confirmingProvider(),
      buildOrder: { automate: () => undefined, build: () => undefined, explorers: () => [1] },
    });
    expect(workload.actions.map((action) => action.kind)).toEqual(["explore"]);
    expect(summarizePlayerProgress([1], workload.actions)[0]?.progressed).toBe(false);
  });

  it("waits for setup stamina to regenerate before measuring the workload", async () => {
    spyOn(configManager, "getMapCenter").mockReturnValue(0);
    const world = fakeWorld();
    const bot = readyHarnessBot(world);
    let reads = 0;
    world.game.explorerStamina = () => (++reads === 1 ? 119 : 120);
    const workload = await runWorkload({
      bots: [bot],
      game: world.game,
      intervalSeconds: 1,
      minutes: 0.001,
      provider: confirmingProvider(),
    });
    expect(workload.readinessWaitMs).toBeGreaterThanOrEqual(1_000);
    expect(workload.actions).toHaveLength(1);
    expect(workload.actions[0].outcome).toBe("completed");
  });

  it("plays every explorer step through the bot's client actions and reads the result from the shared store", async () => {
    spyOn(configManager, "getMapCenter").mockReturnValue(0);
    const world = fakeWorld();
    const bot = readyHarnessBot(world);
    const workload = await runWorkload({
      bots: [bot],
      game: world.game,
      intervalSeconds: 0.01,
      minutes: 0.001,
      provider: confirmingProvider(),
    });

    expect(workload.actions.map(({ error }) => error)).toEqual(Array(6).fill(undefined));
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
    expect(bot.explorers[0]).toMatchObject({ lastDirection: 0 });
    expect(world.game.explorer(1)?.coord).toEqual({ x: 4, y: 1 });
  });

  it("takes another legal neighbour when the preferred return tile is blocked", async () => {
    spyOn(configManager, "getMapCenter").mockReturnValue(0);
    const world = fakeWorld();
    const pathsFromStore = world.actions.armyPaths;
    world.actions.armyPaths = (input) => {
      const paths = pathsFromStore(input);
      const from = world.game.explorer(input.explorerId)!.coord;
      if (from.x === 4 && from.y === 1) {
        const blocked = neighbor(from, 3);
        paths.getPaths().delete(ActionPaths.posKey({ col: blocked.x, row: blocked.y }));
        const alternative = neighbor(from, 1);
        paths.set(ActionPaths.posKey({ col: alternative.x, row: alternative.y }), [
          { hex: { col: from.x, row: from.y }, actionType: ActionType.Move },
          { hex: { col: alternative.x, row: alternative.y }, actionType: ActionType.Move },
        ]);
      }
      return paths;
    };
    const workload = await runWorkload({
      bots: [readyHarnessBot(world)],
      game: world.game,
      intervalSeconds: 0.01,
      minutes: 0.001,
      provider: confirmingProvider(),
    });
    expect(workload.actions.filter((action) => action.outcome !== "completed")).toEqual([]);
    expect(world.moves[3]?.path.at(-1)?.hex).toEqual({ col: 4, row: 2 });
  });

  it("moves a fresh explorer with no remembered exploration route", async () => {
    spyOn(configManager, "getMapCenter").mockReturnValue(0);
    const world = fakeWorld([2, { coord: { x: 10, y: 10 }, staminaAmount: 120n, staminaUpdatedTick: 1n }]);
    const bot = readyHarnessBot(world);
    bot.explorers.push({ ...bot.explorers[0]!, explorerId: 2 });
    const pathsFromStore = world.actions.armyPaths;
    world.actions.armyPaths = (input) => {
      const paths = pathsFromStore(input);
      for (const [key, path] of paths.getPaths()) {
        if (input.explorerId === 2) {
          path.at(-1)!.actionType = ActionType.Move;
        } else if (ActionPaths.getActionType(path) === ActionType.Move) {
          paths.getPaths().delete(key);
        }
      }
      return paths;
    };
    const workload = await runWorkload({
      bots: [bot],
      game: world.game,
      intervalSeconds: 0.01,
      minutes: 0.001,
      provider: confirmingProvider(),
    });
    expect(workload.actions.filter((action) => action.outcome !== "completed")).toEqual([]);
    expect(
      world.moves
        .filter((move) => ActionPaths.getActionType(move.path) === ActionType.Move)
        .map((move) => move.explorerId),
    ).toEqual([2, 2]);
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
  it("fails a bar when the run has no samples for it", () => {
    expect(latencyChecks(40, null)).toEqual({ admissionToVisibleP95: true, heraldConfirmedLagP95: false });
    expect(latencyChecks(null, 40)).toEqual({ admissionToVisibleP95: false, heraldConfirmedLagP95: true });
  });

  it("asserts the action threshold and the latency bars over every worker of a roster run", () => {
    const worker = (
      thresholdEligibleActions: number,
      admissionToVisibleMs: number[],
      heraldConfirmedLagMs: number[] = admissionToVisibleMs.map((value) => value + 100),
      firstSubmitAt: string | null = "2026-09-23T00:00:00.000Z",
    ): WorkerWorkloadSummary => ({
      gameId: 1,
      startedAt: "2026-09-23T00:00:00.000Z",
      endedAt: "2026-09-23T00:10:00.000Z",
      plannedActions: 40,
      thresholdEligibleActions,
      firstSubmitAt,
      admissionToVisibleMs,
      heraldConfirmedLagMs,
    });
    // One bot short of its own plan does not fail the run while the total clears the bar.
    const passing = assessRosterRun({
      functional: false,
      workers: [worker(40, [120, 250]), worker(30, [90, 200], [300, 500], "2026-09-23T00:00:00.250Z")],
      minimumThresholdActions: 70,
    });
    expect(passing.checks).toEqual({
      thresholdEligibleActions: true,
      admissionToVisibleP95: true,
      heraldConfirmedLagP95: true,
    });
    expect(passing).toMatchObject({
      passed: true,
      plannedActions: 80,
      thresholdEligibleActions: 70,
      releaseSpreadMs: 250,
    });
    expect(passing.percentiles?.admissionToVisibleMs.p95).toBe(250);
    expect(passing.percentiles?.heraldConfirmedLagMs.p95).toBe(500);

    expect(
      assessRosterRun({
        functional: false,
        workers: [worker(40, [200]), worker(29, [251], [501])],
        minimumThresholdActions: 70,
      }).checks,
    ).toEqual({ thresholdEligibleActions: false, admissionToVisibleP95: false, heraldConfirmedLagP95: false });
    // A run with no measured lag cannot pass the Herald bar by default.
    expect(
      assessRosterRun({ functional: false, workers: [worker(40, [1], [])], minimumThresholdActions: 40 })
        .checks.heraldConfirmedLagP95,
    ).toBe(false);
    expect(
      assessRosterRun({ functional: true, workers: [worker(40, [])], minimumThresholdActions: 40 }),
    ).toMatchObject({ passed: true, checks: { thresholdEligibleActions: true }, percentiles: null });
  });

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
    const output = await readBlockStats(
      [blockRow(10, 1, 10), blockRow(11, 3, 30)],
      [metricsRow(1, 7, 5, 100, 90), metricsRow(2, 2, 1, 120, 100)],
    );
    expect(output).toMatchObject({
      executionAmplification: { attempts: 20, committed: 10, attemptsPerCommitted: 2, resets: 0 },
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
  it("filters the workload window by embedded block timestamps", async () => {
    const output = await readBlockStats(
      [
        { ...blockRow(10, 1, 10), timestamp: "2026-09-19T00:00:00Z" },
        { ...blockRow(11, 3, 30), timestamp: "2026-09-19T00:00:02Z" },
        { ...blockRow(12, 9, 90), timestamp: "2026-09-19T00:00:04Z" },
      ],
      [metricsRow(Date.parse("2026-09-19T00:00:02Z") * 1_000_000, 0, 0, 1, 1)],
      ["--since", "2026-09-19T00:00:01Z", "--until", "2026-09-19T00:00:03Z"],
    );
    expect(output.blocks).toEqual({ count: 1, busy: 1, first: 11, last: 11 });
    expect(output.transactions.executed).toBe(3);
  });
  it("separates counter resets and never divides lifetime totals or an empty interval", async () => {
    const reset = await readBlockStats(
      [],
      [
        metricsRow(1, 0, 0, 100, 90),
        metricsRow(2, 0, 0, 105, 95),
        metricsRow(3, 0, 0, 2, 1, 2),
        metricsRow(4, 0, 0, 8, 3, 2),
      ],
    );
    expect(reset.executionAmplification).toEqual({
      intervals: 2,
      resets: 1,
      attempts: 11,
      committed: 7,
      attemptsPerCommitted: 11 / 7,
    });
    const idle = await readBlockStats([], [metricsRow(1, 0, 0, 100, 90), metricsRow(2, 0, 0, 100, 90)]);
    expect(idle.executionAmplification.attemptsPerCommitted).toBeNull();
  });
  it("fails the read when a required series or block field is missing, and requires a pair's counters only for it", async () => {
    const withoutMempool = [metricsRow(1, 0, 0, 1, 1)].map((row) => ({
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: row.resourceMetrics[0]!.scopeMetrics[0]!.metrics.filter(
                ({ name }) => name !== "mempool_ready_transactions",
              ),
            },
          ],
        },
      ],
    }));
    const noMempool = await runBlockStats([blockRow(10, 1, 10)], withoutMempool);
    expect(noMempool.exitCode).toBe(1);
    expect(noMempool.output.missingRequired).toEqual(["mempool_ready_transactions"]);

    const { bouncer_sierra_gas: _gas, ...gasless } = blockRow(10, 1, 10);
    const noGas = await runBlockStats([gasless], [metricsRow(1, 0, 0, 1, 1)]);
    expect(noGas.output.missingRequired).toEqual(["bouncer_sierra_gas"]);

    const serial = await runBlockStats([blockRow(10, 1, 10)], [metricsRow(1, 0, 0, 1, 1)], ["--pair", "concurrency"]);
    expect(serial.exitCode).toBe(1);
    expect(serial.output.missingRequired).toEqual([
      "blockifier_transactions_total",
      "blockifier_validation_attempts_total",
      "blockifier_aborts_total",
      "blockifier_commit_phase_aborts_total",
    ]);
  });
  it("summarizes the gateway's admission over the window, with an unknown p95 past the last bound", async () => {
    const bucketsWith = (entries: Record<number, number>) =>
      Array.from({ length: QUEUE_WAIT_BOUNDS.length + 1 }, (_, index) => entries[index] ?? 0);
    const scrape = (time: number, gateway: GatewayScrape) => metricsRow(time, 0, 0, 1, 1, 1, gateway);
    const before = { depth: 2, accepted: 10, executed: 0, transactions: 0, wait: { count: 0, sum: 0, buckets: bucketsWith({}) } };
    const after = {
      depth: 6,
      accepted: 40,
      executed: 30,
      transactions: 3,
      wait: { count: 30, sum: 1.5, buckets: bucketsWith({ 3: 20, 4: 9, 5: 1 }) },
    };
    const output = await readBlockStats([blockRow(10, 1, 10)], [scrape(0, before), scrape(5_000_000_000, after)]);
    expect(output.admission).toEqual({
      queueDepth: { max: 6, p50: 2, p95: 6 },
      acceptedTicketsPerSecond: 6,
      ticketsPerTransaction: 10,
      queueWaitMs: { count: 30, meanMs: 50, p95UpperBoundMs: 100 },
    });

    const slow = { ...after, wait: { count: 30, sum: 1_200, buckets: bucketsWith({ 12: 30 }) } };
    const stalled = await readBlockStats([blockRow(10, 1, 10)], [scrape(0, before), scrape(5_000_000_000, slow)]);
    expect(stalled.admission.queueWaitMs).toEqual({ count: 30, meanMs: 40_000, p95UpperBoundMs: null });
  });
  it("reads a pair's counters as window deltas, per cache kind for the hash cache", async () => {
    const counters = (time: number, calls: number, hits: number, transactions: number) => ({
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                ...metricsRow(time, 0, 0, 10 + transactions, 10 + transactions).resourceMetrics[0]!.scopeMetrics[0]!
                  .metrics,
                ...["blockifier_transactions_total", "blockifier_validation_attempts_total", "blockifier_aborts_total"]
                  .concat("blockifier_commit_phase_aborts_total")
                  .map((name) => counterMetric(name, time, name === "blockifier_transactions_total" ? transactions : 0)),
                counterMetric("exec_hash_cache_calls_total", time, calls, "pedersen_pair"),
                counterMetric("exec_hash_cache_hits_total", time, hits, "pedersen_pair"),
                counterMetric("exec_hash_cache_misses_total", time, calls - hits, "pedersen_pair"),
                counterMetric("exec_hash_cache_capacity_clears_total", time, 0, "pedersen_pair"),
              ],
            },
          ],
        },
      ],
    });
    const output = await readBlockStats([blockRow(10, 1, 10)], [counters(1, 100, 60, 5), counters(2, 140, 90, 9)], [
      "--pair",
      "hash-cache",
    ]);
    expect(output.missingRequired).toEqual([]);
    expect(output.blockifier).toEqual({ transactions: 4, validationAttempts: 0, aborts: 0, commitPhaseAborts: 0 });
    expect(output.hashCache).toEqual({
      pedersen_pair: { calls: 40, hits: 30, misses: 10, capacityClears: 0, hitRate: 0.75 },
    });
  });
});

describe("Madara harness CLI and concurrency", () => {
  it("requires the shard's endpoints instead of falling back to a lab port", () => {
    delete process.env.RPC_URL;
    delete process.env.HERALD_URL;
    try {
      expect(() => parseHarnessArgs([])).toThrow("--rpc-url or RPC_URL is required");
      expect(() => parseHarnessArgs(["--rpc-url", TEST_ENDPOINTS.RPC_URL])).toThrow(
        "--herald-url or HERALD_URL is required",
      );
      expect(
        parseHarnessArgs(["--rpc-url", TEST_ENDPOINTS.RPC_URL, "--herald-url", TEST_ENDPOINTS.HERALD_URL]),
      ).toMatchObject({ rpcUrl: TEST_ENDPOINTS.RPC_URL, heraldUrl: TEST_ENDPOINTS.HERALD_URL });
    } finally {
      Object.assign(process.env, TEST_ENDPOINTS);
    }
  });

  it("parses an explicit smoke-run configuration", () => {
    expect(
      parseHarnessArgs([
        "--game-type",
        "eternum",
        "--bots",
        "4",
        "--minutes",
        "0.5",
        "--interval-seconds",
        "5",
        "--game-id",
        "9",
      ]),
    ).toMatchObject({ bots: 4, minutes: 0.5, intervalSeconds: 5, gameId: 9, gameName: "game-9" });
  });

  it("sizes concurrent Regular rosters without relaxing the player cap", () => {
    expect(parseHarnessArgs([])).toMatchObject({
      bots: 96,
      intervalSeconds: 15,
      workload: "build-order",
      setupConcurrency: 6,
    });
    expect(parseHarnessArgs(["--workload", "cadence"]).workload).toBe("cadence");
    expect(() => parseHarnessArgs(["--workload", "unknown"])).toThrow("--workload");
    expect(parseHarnessArgs(["--games", "16"])).toMatchObject({ games: 16, accountsPerGame: 24, bots: 384 });
    expect(parseHarnessArgs(["--games", "2", "--accounts-per-game", "3"])).toMatchObject({
      games: 2,
      accountsPerGame: 3,
      bots: 6,
    });
    expect(() => parseHarnessArgs(["--games", "2", "--accounts-per-game", "25"])).toThrow("at most 24");
    expect(() => parseHarnessArgs(["--bots", "96", "--games", "2"])).toThrow("Use --games");
    expect(() => parseHarnessArgs(["--game-type", "eternum", "--games", "2"])).toThrow("Regular Blitz");
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

function readyHarnessBot(world: FakeWorld): HarnessBot {
  return {
    account: { address: "0x1" } as Account,
    actions: world.actions,
    address: "0x1",
    botId: 1,
    explorers: [
      {
        explorerId: 1,
        lastUsedAt: -1,
        outwardDirection: 0,
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

/** One explorer at (1, 1) with full stamina on an unexplored map; every action lands in the shared store as it is submitted. */
function fakeWorld(extraExplorer?: [number, ExplorerRow]): FakeWorld {
  const explorers = new Map<number, ExplorerRow>([
    [1, { coord: { x: 1, y: 1 }, staminaAmount: 120n, staminaUpdatedTick: 1n }],
  ]);
  if (extraExplorer) explorers.set(...extraExplorer);
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
      explorers.set(explorerId, {
        ...current,
        coord: { x: step.col, y: step.row },
        staminaAmount: current.staminaAmount - 10n,
      });
      explored.add(key({ x: step.col, y: step.row }));
      changed();
    },
  } as unknown as GameActions;

  const game: HarnessGame = {
    gameId: 1,
    actionsFor: () => actions,
    currentTicks: () => ({ armies: 1, default: 60 }),
    mapCenter: () => ({ x: 0, y: 0 }),
    settlementStructureIds: () => undefined,
    waitUntilPlaying: async () => {},
    structureCoord: () => undefined,
    startingTroopType: () => undefined,
    explorersOf: () => [],
    explorer: (explorerId) => explorers.get(explorerId),
    explorerStamina: (explorerId) => Number(explorers.get(explorerId)!.staminaAmount),
    explorerMaxStamina: () => 120,
    minimumStaminaFor: (kind) => (kind === "explore" ? 30 : 10),
    production: (structureId) => production.get(structureId),
    armyPathIndexes: () => ({
      structureHexes: new Map(),
      armyHexes: new Map(),
      exploredHexes: new Map(),
      chestHexes: new Map(),
    }),
    settle: async () => {},
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

/** Every hash is accepted on L2 in block 5 as soon as it is observed. */
function confirmingProvider(): HarnessProvider {
  return {
    getBlock: async () => ({ timestamp: 60 }),
    subscribeTransactionStatus: async () =>
      statusSubscription({ finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" }),
  } as unknown as HarnessProvider;
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
    close_end_to_end_ms: blockProductionMs + 1,
    merklization_ms: 2,
    db_write_ms: 1,
  };
}

/** The gateway's admission series as the pinned collector exports them: double sums and a per-bucket histogram. */
const QUEUE_WAIT_BOUNDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];
interface GatewayScrape {
  depth: number;
  accepted: number;
  executed: number;
  transactions: number;
  wait: { count: number; sum: number; buckets: number[] };
}
const IDLE_GATEWAY: GatewayScrape = {
  depth: 0,
  accepted: 0,
  executed: 0,
  transactions: 0,
  wait: { count: 0, sum: 0, buckets: Array(QUEUE_WAIT_BOUNDS.length + 1).fill(0) },
};

function gatewayMetrics(time: number, start: number, gateway: GatewayScrape) {
  const point = { timeUnixNano: String(time), startTimeUnixNano: String(start) };
  const sum = (name: string, value: number) => ({ name, sum: { dataPoints: [{ ...point, asDouble: value }] } });
  return [
    { name: "gateway_admission_queue_depth", gauge: { dataPoints: [{ ...point, asDouble: gateway.depth }] } },
    sum("gateway_admission_accepted_tickets", gateway.accepted),
    sum("gateway_executed_tickets", gateway.executed),
    sum("gateway_ticket_transactions", gateway.transactions),
    {
      name: "gateway_admission_queue_wait_seconds",
      histogram: {
        dataPoints: [
          {
            ...point,
            count: String(gateway.wait.count),
            sum: gateway.wait.sum,
            bucketCounts: gateway.wait.buckets.map(String),
            explicitBounds: QUEUE_WAIT_BOUNDS,
          },
        ],
      },
    },
  ];
}

function metricsRow(
  time: number,
  transactions: number,
  ready: number,
  attempts: number,
  committed: number,
  start = 1,
  gateway: GatewayScrape = IDLE_GATEWAY,
) {
  const metric = (name: string, value: number, counter = false) => ({
    name,
    [counter ? "sum" : "gauge"]: {
      dataPoints: [{ asInt: String(value), timeUnixNano: String(time), startTimeUnixNano: String(start) }],
    },
  });
  return {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              metric("mempool_current_size", transactions),
              metric("mempool_ready_transactions", ready),
              metric("mempool_preconfirmed_transaction_statuses", 0),
              metric("blockifier_execution_attempts_total", attempts, true),
              metric("blockifier_committed_transactions_total", committed, true),
              ...gatewayMetrics(time, start, gateway),
            ],
          },
        ],
      },
    ],
  };
}

function counterMetric(name: string, time: number, value: number, kind?: string) {
  return {
    name,
    sum: {
      dataPoints: [
        {
          asInt: String(value),
          timeUnixNano: String(time),
          startTimeUnixNano: "1",
          ...(kind ? { attributes: [{ key: "kind", value: { stringValue: kind } }] } : {}),
        },
      ],
    },
  };
}

async function runBlockStats(rows: unknown[], metrics: unknown[], options: string[] = []) {
  const directory = await mkdtemp(join(tmpdir(), "node-metrics-"));
  try {
    const metricsPath = join(directory, "metrics.jsonl");
    await writeFile(metricsPath, metrics.map((row) => JSON.stringify(row)).join("\n"));
    const child = Bun.spawn(
      ["python3", `${import.meta.dir}/../scripts/block-stats.py`, "--json", "--metrics", metricsPath, ...options],
      {
        stdin: new Blob([rows.map((row) => JSON.stringify(row)).join("\n")]),
        stdout: "pipe",
      },
    );
    const output = await new Response(child.stdout).json();
    return { output, exitCode: await child.exited };
  } finally {
    await rm(directory, { recursive: true });
  }
}

async function readBlockStats(rows: unknown[], metrics: unknown[], options: string[] = []) {
  const { output, exitCode } = await runBlockStats(rows, metrics, options);
  expect(exitCode).toBe(0);
  return output;
}

afterEach(() => mock.restore());
