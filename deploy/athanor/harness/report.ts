import { summarizeFrontierDesign, type FrontierEvidence } from "./frontier";
import type { HarnessRpcRequests } from "./provider";
import { PROCESS_INTERVAL_MS } from "@bibliothecadao/eternum/automation";
import type { LayerRoundTripEvidence } from "./layer-round-trip";
import type { SeasonFinalizationEvidence } from "./season-lifecycle";
import { collectGas, type CollectedTransaction, type GasSummary, type TransactionReceiptReader } from "./gas-collector";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
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
  /** The gateway's admission over the window; queueWaitMs.p95UpperBoundMs is null past the last bucket bound. */
  admission: {
    queueDepth: MetricSummary;
    acceptedTicketsPerSecond: number | null;
    ticketsPerTransaction: number | null;
    queueWaitMs: { count: number | null; meanMs: number | null; p95UpperBoundMs: number | null };
  };
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
  /** The node image as the shard pins it; null for a functional run, which records no node evidence. */
  madaraImage: { digest: string; tag: string | null } | null;
}

export interface HarnessEvidence extends HarnessEvidenceBeforeRun {
  blockStats: BlockStats | null;
  hostStateEnd: Record<string, unknown> | null;
}

/** Where the driver process ran: the campaign compares figures only across the same placement. */
export interface DriverPlacement {
  hostname: string;
  pid: number;
  cpuset: string | null;
  cgroup: string | null;
  availableParallelism: number;
}

export interface HarnessGameInstance {
  botCount: number;
  gameId: number;
  gameName: string;
  /** Transactions the settlement burst took at this game's start; null for a game the harness did not start. */
  settlementTransactions: number | null;
}

interface RunGates {
  minimumThresholdActions: number;
  evidence: HarnessEvidence;
}

/** What one worker hands its roster driver so the driver can assert the run-wide gates. */
export interface WorkerWorkloadSummary {
  gameId: number;
  startedAt: string;
  endedAt: string;
  plannedActions: number;
  thresholdEligibleActions: number;
  /** When this worker's first action left, so the driver can show how tight the release was. */
  firstSubmitAt: string | null;
  admissionToVisibleMs: number[];
  /** Completed actions the provider reported no admission-to-visible figure for. */
  admissionToVisibleMissing: number;
  heraldConfirmedLagMs: number[];
}

export interface HarnessReportInput {
  functional?: boolean;
  accounts: HarnessAccount[];
  botCount: number;
  chainId: string;
  games: HarnessGameInstance[];
  intervalSeconds: number;
  /** Null when this process is one worker of a roster run: the driver asserts the run's gates over every worker. */
  gates: RunGates | null;
  minutes: number;
  /** Reads receipts after the window; the driver never does on the timed path. */
  receipts: TransactionReceiptReader;
  rpcUrl: string;
  setupTransactions: TrackedTransaction[];
  heraldUrl: string;
  driver: DriverPlacement;
  workload: WorkloadResult;
  seasonFinalizations?: SeasonFinalizationEvidence[];
  layerRoundTrips?: LayerRoundTripEvidence[];
  transportRequests?: HarnessRpcRequests;
}

interface PercentileSummary {
  acceptedOnL2Ms: LatencyPercentiles;
  admissionToVisibleMs: LatencyPercentiles;
  heraldConfirmedLagMs: LatencyPercentiles;
  preConfirmedMs: LatencyPercentiles;
  submitDelayMs: LatencyPercentiles;
  submitMs: LatencyPercentiles;
}

interface LatencyPercentiles {
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

// The owner's latency targets (2026-09-23): the player sees a pre-confirmed result fast and Herald keeps up with the
// node. They are driven as low as possible and reported against these figures, never a failing gate; a run fails only
// on correctness. Block close, pre-confirmed and accepted-on-L2 latencies are reported beside them as diagnostics.
const ADMISSION_TO_VISIBLE_P95_TARGET_MS = 250;
const HERALD_CONFIRMED_LAG_P95_TARGET_MS = 500;
export const HARNESS_OUTPUT_DIRECTORY = path.resolve(
  process.env.HARNESS_OUTPUT_DIRECTORY ?? path.resolve(import.meta.dir, "../.lab/runs"),
);
const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const BLOCK_STATS_SCRIPT = path.resolve(import.meta.dir, "../scripts/block-stats.sh");
const HOST_STATE_SCRIPT = path.resolve(import.meta.dir, "../scripts/host-state.sh");

export async function collectHarnessEvidenceBeforeRun(functional = false): Promise<HarnessEvidenceBeforeRun> {
  const madaraImage = functional ? null : pinnedNodeImage(process.env.MADARA_IMAGE);
  const [gitRevision, gitStatus, hostStateStart] = await Promise.all([
    runCommand(["git", "rev-parse", "HEAD"]),
    runCommand(["git", "status", "--porcelain"]),
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

export async function writeHarnessReport(
  input: HarnessReportInput,
): Promise<{ passed: boolean; path: string; workload: WorkerWorkloadSummary }> {
  const analysis = analyzeHarnessResult(input);
  const gas = await collectRunGas(input);
  const createdAt = new Date().toISOString();
  const runId = `${createdAt.replace(/[-:.]/g, "")}-g${input.games.map(({ gameId }) => gameId).join("-")}`;
  const outputPath = path.join(HARNESS_OUTPUT_DIRECTORY, `${runId}.json`);
  const manifest = buildHarnessManifest(input, analysis, gas, runId, createdAt);

  await mkdir(HARNESS_OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { passed: analysis.passed, path: outputPath, workload: summarizeWorkerWorkload(input, analysis) };
}

function summarizeWorkerWorkload(
  input: HarnessReportInput,
  analysis: ReturnType<typeof analyzeHarnessResult>,
): WorkerWorkloadSummary {
  const latencies = (field: "admissionToVisibleMs" | "heraldConfirmedLagMs") =>
    analysis.completedActions.flatMap((action) => (action[field] === undefined ? [] : [action[field]]));
  return {
    gameId: input.games[0]!.gameId,
    startedAt: input.workload.startedAt,
    endedAt: input.workload.endedAt,
    plannedActions: input.workload.plannedActions,
    thresholdEligibleActions: analysis.thresholdEligibleActions,
    firstSubmitAt: analysis.actions[0]?.submitStartedAt ?? null,
    admissionToVisibleMs: latencies("admissionToVisibleMs"),
    admissionToVisibleMissing: unmeasuredAdmissions(analysis.completedActions),
    heraldConfirmedLagMs: latencies("heraldConfirmedLagMs"),
  };
}

/** The run-wide gates over every worker of a roster run: the bars hold for the whole run, not per bot. */
export function assessRosterRun(input: {
  functional: boolean;
  workers: WorkerWorkloadSummary[];
  minimumThresholdActions: number;
}) {
  const plannedActions = input.workers.reduce((sum, worker) => sum + worker.plannedActions, 0);
  const thresholdEligibleActions = input.workers.reduce((sum, worker) => sum + worker.thresholdEligibleActions, 0);
  const admissionToVisibleMs = input.workers.flatMap((worker) => worker.admissionToVisibleMs);
  const heraldConfirmedLagMs = input.workers.flatMap((worker) => worker.heraldConfirmedLagMs);
  const admissionToVisibleMissing = input.workers.reduce((sum, worker) => sum + worker.admissionToVisibleMissing, 0);
  const percentiles = {
    admissionToVisibleMs: { p50: percentile(admissionToVisibleMs, 50), p95: percentile(admissionToVisibleMs, 95) },
    heraldConfirmedLagMs: { p50: percentile(heraldConfirmedLagMs, 50), p95: percentile(heraldConfirmedLagMs, 95) },
  };
  const checks = {
    thresholdEligibleActions: thresholdEligibleActions >= input.minimumThresholdActions,
    ...(input.functional ? {} : { admissionToVisibleMeasured: admissionToVisibleMissing === 0 }),
  };
  return {
    checks,
    limits: { minimumThresholdActions: input.minimumThresholdActions },
    latency: input.functional
      ? null
      : latencyAgainstTargets(
          percentiles.admissionToVisibleMs.p95,
          percentiles.heraldConfirmedLagMs.p95,
          admissionToVisibleMissing,
        ),
    passed: Object.values(checks).every(Boolean),
    percentiles: input.functional ? null : percentiles,
    plannedActions,
    thresholdEligibleActions,
    releaseSpreadMs: releaseSpread(input.workers),
  };
}

/** Milliseconds between the first and the last worker's first submission: the width of the burst's release. */
function releaseSpread(workers: WorkerWorkloadSummary[]): number | null {
  const first = workers.flatMap((worker) => (worker.firstSubmitAt ? [Date.parse(worker.firstSubmitAt)] : []));
  return first.length === 0 ? null : Math.max(...first) - Math.min(...first);
}

/**
 * Where each latency p95 stands against its target. Over target is flagged for the report, never a failed run; a
 * latency with no samples is flagged too, since a run cannot show it met a target it never measured. `missing`
 * counts completed actions with no admission-to-visible figure: they are outside the p95, so the run's
 * admissionToVisibleMeasured check fails on any.
 */
export function latencyAgainstTargets(
  admissionToVisibleP95: number | null,
  heraldConfirmedLagP95: number | null,
  admissionToVisibleMissing: number,
) {
  return {
    missing: { admissionToVisible: admissionToVisibleMissing },
    targets: {
      admissionToVisibleP95Ms: ADMISSION_TO_VISIBLE_P95_TARGET_MS,
      heraldConfirmedLagP95Ms: HERALD_CONFIRMED_LAG_P95_TARGET_MS,
    },
    overTarget: {
      admissionToVisibleP95: !withinTarget(admissionToVisibleP95, ADMISSION_TO_VISIBLE_P95_TARGET_MS),
      heraldConfirmedLagP95: !withinTarget(heraldConfirmedLagP95, HERALD_CONFIRMED_LAG_P95_TARGET_MS),
    },
  };
}

/** Every transaction the run recorded, by stage, against the node's close-block gas for the measured window. */
function collectRunGas(input: HarnessReportInput): Promise<GasSummary> {
  const finalizations: CollectedTransaction[] = (input.seasonFinalizations ?? []).flatMap((finalization) =>
    finalization.transactionHash === undefined
      ? []
      : [
          {
            botId: 0,
            gameId: finalization.gameId,
            kind: "season_close",
            outcome: "completed",
            stage: "finalization",
            transactionHash: finalization.transactionHash,
          },
        ],
  );
  const drills = (input.layerRoundTrips ?? []).flatMap((drill) => drill.steps.map((step) => step.transaction));
  const blockStats = input.gates?.evidence.blockStats ?? null;
  return collectGas({
    transactions: [...input.setupTransactions, ...input.workload.actions, ...drills, ...finalizations],
    reader: input.receipts,
    node: blockStats ? { blocks: blockStats.blocks, l2GasConsumed: blockStats.transactions.l2GasConsumed } : null,
    nativeExecution: readNativeExecution(input.gates?.evidence.hostStateStart ?? null),
  });
}

/** host-state.sh records the flag the Madara container was started with; null when the host state is missing. */
function readNativeExecution(hostState: Record<string, unknown> | null): boolean | null {
  const madara = hostState?.madara as { nativeExecution?: unknown } | undefined;
  return typeof madara?.nativeExecution === "boolean" ? madara.nativeExecution : null;
}

export function analyzeHarnessResult(input: HarnessReportInput) {
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
  // Failed actions have no figure by construction; a completed one without it would silently shrink the sample.
  const admissionToVisibleMissing = unmeasuredAdmissions(completedActions);
  const measuredRun = input.gates !== null && !input.functional;
  const requestedMix = summarizeRequestedMix(actions);
  const actualMix = summarizeCompletedMix(actions);
  const failureClasses = summarizeFailureClasses(failedActions);
  const revertReasons = summarizeRevertReasons(reverts);
  const rpc = summarizeRpcLoad(input.setupTransactions, actions, input.workload.overheadRpc);

  const checks = {
    ...(input.gates === null
      ? {}
      : {
          thresholdEligibleActions: thresholdEligibleActions >= input.gates.minimumThresholdActions,
        }),
    ...(measuredRun ? { admissionToVisibleMeasured: admissionToVisibleMissing === 0 } : {}),
    setup: setupFailures.length === 0,
    ...(input.workload.frontier && input.functional ? frontierDesignChecks(input.workload.frontier) : {}),
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
    latency: measuredRun
      ? latencyAgainstTargets(
          percentiles.admissionToVisibleMs.p95,
          percentiles.heraldConfirmedLagMs.p95,
          admissionToVisibleMissing,
        )
      : null,
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

/** FR11's design gates: only the accelerated design run plays enough days for them to mean anything. */
function frontierDesignChecks(frontier: FrontierEvidence) {
  return {
    frontierTokenCap: frontier.players.every((player) =>
      player.days.every(
        (day) =>
          player.chests.filter(
            (chest) => chest.epoch === Math.floor(day.startedAt / frontier.epochSeconds) && chest.kind === "Token",
          ).length <= frontier.tokenCap,
      ),
    ),
    frontierRollovers: frontier.players.every(
      (player) =>
        player.rollovers.filter((rollover) => rollover.currentArmies.length > 0).length >= 3 &&
        player.rollovers.every((rollover) =>
          rollover.currentArmies.every((id) => !rollover.previousArmies.includes(id)),
        ),
    ),
  };
}

function buildHarnessManifest(
  input: HarnessReportInput,
  analysis: ReturnType<typeof analyzeHarnessResult>,
  gas: GasSummary,
  runId: string,
  createdAt: string,
) {
  return {
    runId,
    createdAt,
    passed: analysis.passed,
    chain: {
      chainId: input.chainId,
      rpcUrl: input.rpcUrl,
      heraldUrl: input.heraldUrl,
      madaraImage: input.gates?.evidence.madaraImage ?? null,
    },
    source: input.gates
      ? { gitRevision: input.gates.evidence.gitRevision, gitDirty: input.gates.evidence.gitDirty }
      : null,
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
            scope: "estimateInvokeFee, getBlock and getTransactionStatus calls made by the harness driver",
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
    gas,
    thresholds: {
      // Null limits: this process is one worker of a roster run, and the driver's summary carries the gates.
      limits: input.gates ? { minimumThresholdActions: input.gates.minimumThresholdActions } : null,
      checks: analysis.checks,
      latency: analysis.latency,
    },
    driver: input.driver,
    evidence: input.gates
      ? {
          hostStateStart: input.gates.evidence.hostStateStart,
          hostStateEnd: input.gates.evidence.hostStateEnd,
          blockStats: input.gates.evidence.blockStats,
        }
      : null,
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

export function summarizeFailureClasses(actions: readonly Pick<TrackedTransaction, "failureClass">[]) {
  const counts = { gameRuleLimit: 0, harnessPathing: 0, gameplayRejection: 0, gameplayRace: 0, chainOrDriver: 0 };
  for (const action of actions) {
    if (action.failureClass === "game_rule_limit") counts.gameRuleLimit += 1;
    else if (action.failureClass === "harness_pathing") counts.harnessPathing += 1;
    else if (action.failureClass === "gameplay_rejection") counts.gameplayRejection += 1;
    else if (action.failureClass === "gameplay_race") counts.gameplayRace += 1;
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

function unmeasuredAdmissions(completed: readonly TrackedTransaction[]): number {
  return completed.filter((action) => action.admissionToVisibleMs === undefined).length;
}

function summarizePercentiles(actions: TrackedTransaction[]): PercentileSummary {
  return {
    acceptedOnL2Ms: latencyPercentiles(actions, "acceptedOnL2Ms"),
    admissionToVisibleMs: latencyPercentiles(actions, "admissionToVisibleMs"),
    heraldConfirmedLagMs: latencyPercentiles(actions, "heraldConfirmedLagMs"),
    preConfirmedMs: latencyPercentiles(actions, "preConfirmedMs"),
    submitDelayMs: latencyPercentiles(actions, "submitDelayMs"),
    submitMs: latencyPercentiles(actions, "submitMs"),
  };
}

function latencyPercentiles(actions: TrackedTransaction[], field: keyof PercentileSummary): LatencyPercentiles {
  const values = actions.flatMap((action) => (action[field] === undefined ? [] : [action[field]]));
  return { p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99) };
}

function withinTarget(value: number | null, target: number): boolean {
  return value !== null && value <= target;
}

// Block stats are the run's close-cost diagnostic, so a measured run cannot pass without them: a failed read (log
// rotation, a window spanning a container restart, an empty window) is a failed run, never a null figure.
async function captureBlockStats(since: string, until: string): Promise<BlockStats> {
  const output = await runCommand([BLOCK_STATS_SCRIPT, "--since", since, "--until", until, "--json"]);
  const summary = JSON.parse(output) as Omit<BlockStats, "window">;
  if (summary.blocks.count === 0)
    throw new Error(`Block stats: no closed blocks in the Madara log window ${since}..${until}`);
  return { ...summary, window: { since, until } };
}

export async function readDriverPlacement(): Promise<DriverPlacement> {
  const [status, cgroup] = await Promise.all([readProcFile("/proc/self/status"), readProcFile("/proc/self/cgroup")]);
  return {
    hostname: os.hostname(),
    pid: process.pid,
    cpuset: status?.match(/^Cpus_allowed_list:\s*(\S+)/m)?.[1] ?? null,
    cgroup: cgroup?.trim().split("\n").at(-1)?.split(":").at(-1) ?? null,
    availableParallelism: os.availableParallelism(),
  };
}

async function readProcFile(file: string): Promise<string | null> {
  return readFile(file, "utf8").catch(() => null);
}

/**
 * The node image a measured run played against, as the shard pins it by digest in its harness.env (MADARA_IMAGE).
 * It is read from the shard's configuration, never from a container name, so a run works from any host.
 */
export function pinnedNodeImage(pinned: string | undefined): { digest: string; tag: string | null } {
  if (!pinned) throw new Error("MADARA_IMAGE is required for a measured run: the shard's harness.env pins it");
  const match = /^(?:(.+)@)?(sha256:[a-f0-9]{64})$/.exec(pinned.trim());
  if (!match) throw new Error(`MADARA_IMAGE ${pinned} is not pinned by digest`);
  return { tag: match[1] ?? null, digest: match[2]! };
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
