import { summarizeFrontierDesign } from "./frontier";
import type { HarnessRpcRequests } from "./provider";
import { PROCESS_INTERVAL_MS } from "@bibliothecadao/eternum/automation";
import type { LayerRoundTripEvidence } from "./layer-round-trip";
import type { SeasonFinalizationEvidence } from "./season-lifecycle";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HarnessAccount } from "./account-factory";
import {
  createRpcMetrics,
  type MeasuredRpcMethod,
  type RpcMetrics,
  type TrackedTransaction,
  type WorkloadResult,
} from "./driver";

interface BlockStats {
  blockProductionMs: MetricSummary;
  blocks: { busy: number; count: number; first: number | null; last: number | null };
  closeBlockMs: MetricSummary;
  dbWriteMs: { max: number | null };
  merklizationMs: { max: number | null };
  pair: "concurrency" | "hash-cache" | null;
  /** Required node series or block fields the window lacked; the read failed if any are listed. */
  missingRequired: string[];
  blockifier: Record<"transactions" | "validationAttempts" | "aborts" | "commitPhaseAborts", number | null>;
  hashCache: Record<string, { calls?: number | null; hits?: number | null; hitRate: number | null }>;
  l2GasPerBusyBlock: MetricSummary;
  executionAmplification: {
    attempts: number | null;
    committed: number | null;
    intervals: number;
    resets: number;
    attemptsPerCommitted: number | null;
  };
  mempool: {
    lastObservedReadyTransactions: number | null;
    lastObservedTransactions: number | null;
    maxReadyTransactions: number | null;
    maxTransactions: number | null;
    maxPreconfirmedStatuses: number | null;
    samples: number;
  };
  sierraGasPerBusyBlock: MetricSummary;
  slowestBlock: {
    batches: number | null;
    blockNumber: number;
    blockProductionMs: number;
    closeBlockMs: number;
    dbWriteMs: number;
    mempoolMaxReadyTransactions: number | null;
    mempoolMaxTransactions: number | null;
    merklizationMs: number;
    sierraGas: number | null;
    transactions: number;
  } | null;
  transactions: {
    addedToBlock: number;
    classesDeclared: number;
    contractsDeployed: number;
    executed: number;
    l2GasConsumed: number;
    rejected: number;
    reverted: number;
  };
  transactionsPerBusyBlock: { max: number | null; p50: number | null };
  window: { since: string; until: string };
}

interface MetricSummary {
  max: number | null;
  p50: number | null;
  p95: number | null;
}

interface HarnessEvidenceBeforeRun {
  gitDirty: boolean;
  gitRevision: string;
  hostStateStart: Record<string, unknown> | null;
  madaraImage: { digest: string; tag: string };
}

export interface HarnessEvidence extends HarnessEvidenceBeforeRun {
  blockStats: BlockStats | null;
  hostStateEnd: Record<string, unknown> | null;
}

export interface HarnessReportInput {
  functional?: boolean;
  accounts: HarnessAccount[];
  botCount: number;
  chainId: string;
  evidence: HarnessEvidence;
  games: Array<{ botCount: number; gameId: number; gameName: string }>;
  intervalSeconds: number;
  minimumThresholdActions: number;
  minutes: number;
  rpcUrl: string;
  setupTransactions: TrackedTransaction[];
  heraldUrl: string;
  workload: WorkloadResult;
  seasonFinalizations?: SeasonFinalizationEvidence[];
  layerRoundTrips?: LayerRoundTripEvidence[];
  transportRequests?: HarnessRpcRequests;
}

interface PercentileSummary {
  acceptedOnL2Ms: LatencyPercentiles;
  admissionToVisibleMs: LatencyPercentiles;
  preConfirmedMs: LatencyPercentiles;
  submitDelayMs: LatencyPercentiles;
  submitMs: LatencyPercentiles;
}

interface LatencyPercentiles {
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

const PRECONFIRMED_P95_LIMIT_MS = 1_000;
const ACCEPTED_ON_L2_P95_LIMIT_MS = 4_000;
export const HARNESS_OUTPUT_DIRECTORY = path.resolve(
  process.env.HARNESS_OUTPUT_DIRECTORY ?? path.resolve(import.meta.dir, "../.lab/runs"),
);
const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const BLOCK_STATS_SCRIPT = path.resolve(import.meta.dir, "../scripts/block-stats.sh");
const HOST_STATE_SCRIPT = path.resolve(import.meta.dir, "../scripts/host-state.sh");

export async function collectHarnessEvidenceBeforeRun(functional = false): Promise<HarnessEvidenceBeforeRun> {
  const [gitRevision, gitStatus, madaraImage, hostStateStart] = await Promise.all([
    runCommand(["git", "rev-parse", "HEAD"]),
    runCommand(["git", "status", "--porcelain"]),
    readMadaraImage(),
    functional ? null : captureHostState(),
  ]);
  return {
    gitDirty: gitStatus.trim().length > 0,
    gitRevision: gitRevision.trim(),
    hostStateStart,
    madaraImage,
  };
}

export async function finishHarnessEvidence(
  before: HarnessEvidenceBeforeRun,
  workloadStartedAt: string,
  workloadEndedAt: string,
  functional = false,
): Promise<HarnessEvidence> {
  const [blockStats, hostStateEnd] = await Promise.all([
    functional ? null : captureBlockStats(workloadStartedAt, workloadEndedAt),
    functional ? null : captureHostState(),
  ]);
  return { ...before, blockStats, hostStateEnd };
}

export async function writeHarnessReport(input: HarnessReportInput): Promise<{ passed: boolean; path: string }> {
  const analysis = analyzeHarnessResult(input);
  const createdAt = new Date().toISOString();
  const runId = `${createdAt.replace(/[-:.]/g, "")}-g${input.games.map(({ gameId }) => gameId).join("-")}`;
  const outputPath = path.join(HARNESS_OUTPUT_DIRECTORY, `${runId}.json`);
  const manifest = buildHarnessManifest(input, analysis, runId, createdAt);

  await mkdir(HARNESS_OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { passed: analysis.passed, path: outputPath };
}

function analyzeHarnessResult(input: HarnessReportInput) {
  const actions = input.workload.actions;
  const completedActions = actions.filter((action) => action.outcome === "completed");
  const reverts = actions.filter((action) => action.outcome === "reverted" || action.outcome === "rejected");
  const failedActions = actions.filter((action) => action.outcome !== "completed");
  const blockingFailures = failedActions.filter(isThresholdBlockingFailure);
  const blockingReverts = reverts.filter(isThresholdBlockingFailure);
  const tileContentionReverts = reverts.filter((action) => action.revertReason === "tile_contention");
  const thresholdEligibleActions = completedActions.length + tileContentionReverts.length;
  const setupFailures = input.setupTransactions.filter((transaction) => transaction.outcome !== "completed");
  const percentiles = summarizePercentiles(completedActions);
  const requestedMix = summarizeRequestedMix(actions);
  const actualMix = summarizeCompletedMix(actions);
  const failureClasses = summarizeFailureClasses(failedActions);
  const revertReasons = summarizeRevertReasons(reverts);
  const rpc = summarizeRpcLoad(input.setupTransactions, actions, input.workload.overheadRpc);

  const checks = {
    ...(input.functional
      ? {}
      : latencyChecks(percentiles)),
    thresholdEligibleActions: thresholdEligibleActions >= input.minimumThresholdActions,
    setup: setupFailures.length === 0,
    frontierTokenCap:
      !input.workload.frontier ||
      input.workload.frontier.players.every((player) =>
        player.days.every(
          (day) =>
            player.chests.filter(
              (chest) =>
                chest.epoch === Math.floor(day.startedAt / input.workload.frontier!.epochSeconds) &&
                chest.kind === "Token",
            ).length <= input.workload.frontier!.tokenCap,
        ),
      ),

    frontierRollovers:
      !input.workload.frontier ||
      input.workload.frontier.players.every(
        (player) =>
          player.rollovers.filter((rollover) => rollover.currentArmies.length > 0).length >= 3 &&
          player.rollovers.every((rollover) =>
            rollover.currentArmies.every((id) => !rollover.previousArmies.includes(id)),
          ),
      ),

    playerProgress:
      input.workload.profile !== "build-order" ||
      summarizePlayerProgress(
        input.accounts.map(({ botId }) => botId),
        actions,
      ).every((player) => player.progressed),
    layerRoundTrips: input.layerRoundTrips?.every((result) => result.status === "passed") ?? true,
    seasonsClosed: input.seasonFinalizations?.every((result) => result.status === "closed") ?? true,
    zeroBlockingFailures: blockingFailures.length === 0,
    zeroBlockingReverts: blockingReverts.length === 0,
  };

  return {
    actions,
    actualMix,
    blockingFailures,
    blockingReverts,
    checks,
    completedActions,
    failedActions,
    failureClasses,
    passed: Object.values(checks).every(Boolean),
    percentiles,
    requestedMix,
    revertReasons,
    reverts,
    rpc,
    setupFailures,
    thresholdEligibleActions,
    tileContentionReverts,
  };
}

function buildHarnessManifest(
  input: HarnessReportInput,
  analysis: ReturnType<typeof analyzeHarnessResult>,
  runId: string,
  createdAt: string,
) {
  return {
    schemaVersion: 7,
    runId,
    createdAt,
    passed: analysis.passed,
    chain: {
      chainId: input.chainId,
      rpcUrl: input.rpcUrl,
      heraldUrl: input.heraldUrl,
      madaraImage: input.evidence.madaraImage,
    },
    source: {
      gitRevision: input.evidence.gitRevision,
      gitDirty: input.evidence.gitDirty,
    },
    game: {
      count: input.games.length,
      executionModel: "single_process",
      instances: input.games,
    },
    seasonFinalizations: input.seasonFinalizations ?? [],
    layerRoundTrips: input.layerRoundTrips ?? [],
    workload: {
      profile: input.workload.profile ?? "cadence",
      functional: input.functional ?? false,
      frontier: input.workload.frontier,
      designGates: input.workload.frontier ? summarizeFrontierDesign(input.workload.frontier) : undefined,
      automationIntervalMs: input.workload.profile === "build-order" ? PROCESS_INTERVAL_MS : null,
      perPlayer: summarizePlayerProgress(
        input.accounts.map(({ botId }) => botId),
        analysis.actions,
      ),
      bots: input.botCount,
      minutes: input.minutes,
      intervalSeconds: input.intervalSeconds,
      receiptObservation: "shared-node-subscription",
      requestedMix: analysis.requestedMix,
      actualMix: analysis.actualMix,
      ticks: input.workload.ticks,
      plannedActions: input.workload.plannedActions,
      minimumThresholdActions: input.minimumThresholdActions,
      completedActions: analysis.completedActions.length,
      thresholdEligibleActions: analysis.thresholdEligibleActions,
      failedActions: analysis.failedActions.length,
      blockingFailures: analysis.blockingFailures.length,
      failureClasses: analysis.failureClasses,
      reverts: analysis.reverts.length,
      blockingReverts: analysis.blockingReverts.length,
      revertReasons: analysis.revertReasons,
      readiness: {
        condition:
          input.workload.profile === "frontier"
            ? "season_ready_for_open_entry"
            : "every_explorer_at_configured_stamina_capacity",
        waitMs: input.workload.readinessWaitMs,
      },
      startedAt: input.workload.startedAt,
      endedAt: input.workload.endedAt,
      percentiles: input.functional ? null : analysis.percentiles,
      measuredRpc: input.functional
        ? null
        : {
            scope:
              "estimateInvokeFee, getBlock, getTransactionReceipt, and getTransactionStatus calls made by the harness driver",
            ...analysis.rpc,
            transport: input.transportRequests
              ? summarizeTransportRequests(input.transportRequests, input.workload.actions.length)
              : null,
          },
      perGame: input.games.map((game) => summarizeGameWorkload(game, analysis.actions, input.functional)),
      actions: analysis.actions,
    },
    setup: {
      deployedAccounts: input.accounts.map(({ address, botId, deployedInMs, gameId, owner }) => ({
        address,
        botId,
        deployedInMs,
        gameId,
        owner,
      })),
      transactions: [...input.setupTransactions].sort(
        (left, right) => left.gameId - right.gameId || left.botId - right.botId,
      ),
      failures: analysis.setupFailures.length,
    },
    thresholds: {
      limits: input.functional
        ? null
        : {
            acceptedOnL2P95Ms: ACCEPTED_ON_L2_P95_LIMIT_MS,
            preConfirmedP95Ms: PRECONFIRMED_P95_LIMIT_MS,
            minimumThresholdActions: input.minimumThresholdActions,
          },
      checks: analysis.checks,
    },
    evidence: {
      hostStateStart: input.evidence.hostStateStart,
      hostStateEnd: input.evidence.hostStateEnd,
      blockStats: input.evidence.blockStats,
    },
  };
}

function summarizeGameWorkload(
  game: HarnessReportInput["games"][number],
  actions: readonly TrackedTransaction[],
  functional = false,
) {
  const gameActions = actions.filter((action) => action.gameId === game.gameId);
  const completed = gameActions.filter((action) => action.outcome === "completed");
  const failed = gameActions.filter((action) => action.outcome !== "completed");
  const reverts = gameActions.filter((action) => action.outcome === "reverted" || action.outcome === "rejected");
  return {
    ...game,
    plannedActions: gameActions.length,
    completedActions: completed.length,
    failedActions: failed.length,
    blockingFailures: failed.filter(isThresholdBlockingFailure).length,
    failureClasses: summarizeFailureClasses(failed),
    reverts: reverts.length,
    blockingReverts: reverts.filter(isThresholdBlockingFailure).length,
    revertReasons: summarizeRevertReasons(reverts),
    percentiles: functional ? null : summarizePercentiles(completed),
  };
}

function summarizeFailureClasses(actions: readonly TrackedTransaction[]) {
  const counts = { gameRuleLimit: 0, harnessPathing: 0, chainOrDriver: 0 };
  for (const action of actions) {
    if (action.failureClass === "game_rule_limit") counts.gameRuleLimit += 1;
    else if (action.failureClass === "harness_pathing") counts.harnessPathing += 1;
    else counts.chainOrDriver += 1;
  }
  return counts;
}

export function summarizeRevertReasons(actions: readonly Pick<TrackedTransaction, "revertReason">[]) {
  const counts = { tileContention: 0, stamina: 0, labor: 0, other: 0 };
  for (const action of actions) {
    if (action.revertReason === "tile_contention") counts.tileContention += 1;
    else if (action.revertReason === "stamina") counts.stamina += 1;
    else if (action.revertReason === "labor") counts.labor += 1;
    else counts.other += 1;
  }
  return counts;
}

export function isThresholdBlockingFailure(action: Pick<TrackedTransaction, "outcome" | "revertReason">): boolean {
  if (action.outcome === "completed") return false;
  const isRevert = action.outcome === "reverted" || action.outcome === "rejected";
  return !isRevert || action.revertReason !== "tile_contention";
}

export function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  if (percentileValue < 0 || percentileValue > 100) {
    throw new Error(`Percentile must be between 0 and 100, received ${percentileValue}`);
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index]!;
}

export function summarizeRequestedMix(actions: readonly Pick<TrackedTransaction, "kind">[]): Record<string, number> {
  return summarizeKinds(actions);
}

export function summarizeCompletedMix(
  actions: readonly Pick<TrackedTransaction, "kind" | "outcome">[],
): Record<string, number> {
  return summarizeKinds(actions.filter(({ outcome }) => outcome === "completed"));
}

export function summarizeRpcMetrics(metrics: readonly RpcMetrics[], overhead: RpcMetrics) {
  const methods = createRpcMetrics();
  for (const rpc of [...metrics, overhead]) {
    for (const method of Object.keys(methods) as MeasuredRpcMethod[]) {
      methods[method].calls += rpc[method].calls;
      methods[method].wallMs += rpc[method].wallMs;
    }
  }
  for (const method of Object.keys(methods) as MeasuredRpcMethod[]) {
    methods[method].wallMs = roundMilliseconds(methods[method].wallMs);
  }
  return {
    methods,
    total: {
      calls: Object.values(methods).reduce((sum, method) => sum + method.calls, 0),
      wallMs: roundMilliseconds(Object.values(methods).reduce((sum, method) => sum + method.wallMs, 0)),
    },
  };
}

function summarizeRpcLoad(
  setupTransactions: readonly TrackedTransaction[],
  actions: readonly TrackedTransaction[],
  overhead: RpcMetrics,
) {
  const noOverhead = createRpcMetrics();
  const workload = summarizeRpcMetrics(
    actions.map(({ rpc }) => rpc),
    noOverhead,
  );
  return {
    workload: {
      actions: actions.length,
      callsPerAction: actions.length === 0 ? 0 : roundMilliseconds(workload.total.calls / actions.length),
      ...workload,
    },
    setup: summarizeRpcMetrics(
      setupTransactions.map(({ rpc }) => rpc),
      noOverhead,
    ),
    overhead: summarizeRpcMetrics([], overhead),
    run: summarizeRpcMetrics(
      [...setupTransactions, ...actions].map(({ rpc }) => rpc),
      overhead,
    ),
  };
}

function summarizeKinds(actions: readonly Pick<TrackedTransaction, "kind">[]): Record<string, number> {
  const counts: Record<string, number> = { move: 0, explore: 0, produce: 0 };
  for (const action of actions) {
    counts[action.kind] = (counts[action.kind] ?? 0) + 1;
  }
  return counts;
}

export function summarizePlayerProgress(botIds: number[], actions: readonly TrackedTransaction[]) {
  return botIds.map((botId) => {
    const playerActions = actions.filter((action) => action.botId === botId);
    const completed: Record<string, number> = {};
    let lastCompletedAt: string | null = null;
    for (const action of playerActions) {
      if (action.outcome !== "completed") continue;
      completed[action.kind] = (completed[action.kind] ?? 0) + 1;
      if (action.acceptedOnL2At && (!lastCompletedAt || action.acceptedOnL2At > lastCompletedAt)) {
        lastCompletedAt = action.acceptedOnL2At;
      }
    }
    const built = Object.keys(completed).some((kind) => kind.startsWith("build-") || kind === "upgrade");
    return {
      botId,
      completed,
      progressed: built && (completed.explore ?? 0) > 0 && (completed["automate-production"] ?? 0) > 0,
      failed: playerActions.filter((action) => action.outcome !== "completed").length,
      lastCompletedAt,
    };
  });
}

function summarizePercentiles(actions: TrackedTransaction[]): PercentileSummary {
  return {
    acceptedOnL2Ms: latencyPercentiles(actions, "acceptedOnL2Ms"),
    admissionToVisibleMs: latencyPercentiles(actions, "admissionToVisibleMs"),
    preConfirmedMs: latencyPercentiles(actions, "preConfirmedMs"),
    submitDelayMs: latencyPercentiles(actions, "submitDelayMs"),
    submitMs: latencyPercentiles(actions, "submitMs"),
  };
}

function latencyPercentiles(
  actions: TrackedTransaction[],
  field: "acceptedOnL2Ms" | "admissionToVisibleMs" | "preConfirmedMs" | "submitDelayMs" | "submitMs",
): LatencyPercentiles {
  const values = actions.flatMap((action) => (action[field] === undefined ? [] : [action[field]]));
  return { p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99) };
}

/** A run is judged only on its own samples: a latency with no samples fails its budget, never passes as zero. */
export function latencyChecks(percentiles: Pick<PercentileSummary, "acceptedOnL2Ms" | "preConfirmedMs">) {
  return {
    acceptedOnL2P95: passesLatency(percentiles.acceptedOnL2Ms.p95, ACCEPTED_ON_L2_P95_LIMIT_MS),
    preConfirmedP95: passesLatency(percentiles.preConfirmedMs.p95, PRECONFIRMED_P95_LIMIT_MS),
  };
}

function passesLatency(value: number | null, limit: number): boolean {
  return value !== null && value <= limit;
}

// Block stats are a secondary per-block metric parsed from Madara's docker logs. A run that completes its workload
// must still produce a report even when they are unavailable (e.g. docker log rotation, or a --since/--until window
// that spans a container restart), so treat their absence as null, never as a run failure.
async function captureBlockStats(since: string, until: string): Promise<BlockStats | null> {
  try {
    const output = await runCommand([BLOCK_STATS_SCRIPT, "--since", since, "--until", until, "--json"]);
    const summary = JSON.parse(output) as Omit<BlockStats, "window">;
    if (summary.blocks.count === 0) {
      console.warn(`Block stats: no closed blocks in the Madara log window ${since}..${until}; recording null.`);
      return null;
    }
    return { ...summary, window: { since, until } };
  } catch (error) {
    console.warn(
      `Block stats unavailable (${since}..${until}): ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function readMadaraImage(): Promise<HarnessEvidence["madaraImage"]> {
  const output = await runCommand([
    "docker",
    "inspect",
    "--format={{.Config.Image}}|{{.Image}}",
    process.env.MADARA_CONTAINER ?? `${process.env.COMPOSE_PROJECT_NAME ?? "athanor-local"}-madara-1`,
  ]);
  const [tag, digest] = output.trim().split("|");
  if (!tag || !digest) throw new Error(`Could not parse Madara image metadata: ${output}`);
  return { tag, digest };
}

async function captureHostState(): Promise<Record<string, unknown>> {
  const output = await runCommand([HOST_STATE_SCRIPT]);
  const parsed = JSON.parse(output) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("host-state.sh did not return a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 100) / 100;
}

async function runCommand(command: string[]): Promise<string> {
  const process = Bun.spawn(command, {
    cwd: REPOSITORY_ROOT,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed (${exitCode}): ${stderr.trim()}`);
  }
  return stdout.trim();
}

function summarizeTransportRequests(requests: HarnessRpcRequests, actions: number) {
  const calls =
    Object.values(requests.http).reduce((sum, count) => sum + count, 0) +
    Object.values(requests.websocket).reduce((sum, count) => sum + count, 0);
  return { ...requests, calls, callsPerAction: actions > 0 ? roundMilliseconds(calls / actions) : null };
}
