import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HarnessAccount } from "./account-factory";
import type { TrackedTransaction, WorkloadActionKind, WorkloadResult } from "./driver";

export interface HarnessEvidence {
  blockStatsAfter: string;
  blockStatsBefore: string;
  gitDirty: boolean;
  gitRevision: string;
  madaraImage: {
    digest: string;
    tag: string;
  };
}

export interface HarnessReportInput {
  accounts: HarnessAccount[];
  botCount: number;
  chainId: string;
  evidence: HarnessEvidence;
  gameId: number;
  gameName: string;
  intervalSeconds: number;
  minimumCompletedActions: number;
  minutes: number;
  rpcUrl: string;
  setupTransactions: TrackedTransaction[];
  toriiSqlUrl: string;
  workload: WorkloadResult;
}

interface PercentileSummary {
  acceptedOnL2Ms: LatencyPercentiles;
  indexedMs: LatencyPercentiles;
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
const INDEXED_P95_LIMIT_MS = 6_000;
const RUNS_DIRECTORY = path.resolve(import.meta.dir, "../.lab/runs");

export async function collectHarnessEvidenceBeforeRun(): Promise<Omit<HarnessEvidence, "blockStatsAfter">> {
  const [blockStatsBefore, gitRevision, gitStatus, madaraImage] = await Promise.all([
    captureBlockStats(),
    runCommand(["git", "rev-parse", "HEAD"]),
    runCommand(["git", "status", "--porcelain"]),
    readMadaraImage(),
  ]);
  return {
    blockStatsBefore,
    gitDirty: gitStatus.trim().length > 0,
    gitRevision: gitRevision.trim(),
    madaraImage,
  };
}

export async function finishHarnessEvidence(
  before: Omit<HarnessEvidence, "blockStatsAfter">,
): Promise<HarnessEvidence> {
  return { ...before, blockStatsAfter: await captureBlockStats() };
}

export async function writeHarnessReport(input: HarnessReportInput): Promise<{ passed: boolean; path: string }> {
  const analysis = analyzeHarnessResult(input);
  const createdAt = new Date().toISOString();
  const runId = createdAt.replace(/[-:.]/g, "");
  const outputPath = path.join(RUNS_DIRECTORY, `${runId}.json`);
  const manifest = buildHarnessManifest(input, analysis, runId, createdAt);

  await mkdir(RUNS_DIRECTORY, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { passed: analysis.passed, path: outputPath };
}

function analyzeHarnessResult(input: HarnessReportInput) {
  const actions = input.workload.actions;
  const completedActions = actions.filter((action) => action.outcome === "completed");
  const reverts = actions.filter((action) => action.outcome === "reverted" || action.outcome === "rejected");
  const failedActions = actions.filter((action) => action.outcome !== "completed");
  const indexingLoss = actions.filter(
    (action) => action.transactionIndexedAt === undefined || action.eventIndexedAt === undefined,
  );
  const setupFailures = input.setupTransactions.filter((transaction) => transaction.outcome !== "completed");
  const percentiles = summarizePercentiles(completedActions);
  const mix = summarizeMix(actions);

  const checks = {
    acceptedOnL2P95: passesLatency(percentiles.acceptedOnL2Ms.p95, ACCEPTED_ON_L2_P95_LIMIT_MS),
    completedActions: completedActions.length >= input.minimumCompletedActions,
    indexedP95: passesLatency(percentiles.indexedMs.p95, INDEXED_P95_LIMIT_MS),
    indexingLoss: indexingLoss.length === 0,
    preConfirmedP95: passesLatency(percentiles.preConfirmedMs.p95, PRECONFIRMED_P95_LIMIT_MS),
    setup: setupFailures.length === 0,
    zeroFailures: failedActions.length === 0,
    zeroReverts: reverts.length === 0,
  };

  return {
    actions,
    checks,
    completedActions,
    failedActions,
    indexingLoss,
    mix,
    passed: Object.values(checks).every(Boolean),
    percentiles,
    reverts,
    setupFailures,
  };
}

function buildHarnessManifest(
  input: HarnessReportInput,
  analysis: ReturnType<typeof analyzeHarnessResult>,
  runId: string,
  createdAt: string,
) {
  return {
    schemaVersion: 1,
    runId,
    createdAt,
    passed: analysis.passed,
    chain: {
      chainId: input.chainId,
      rpcUrl: input.rpcUrl,
      toriiSqlUrl: input.toriiSqlUrl,
      madaraImage: input.evidence.madaraImage,
    },
    source: {
      gitRevision: input.evidence.gitRevision,
      gitDirty: input.evidence.gitDirty,
    },
    game: { gameId: input.gameId, gameName: input.gameName },
    workload: {
      bots: input.botCount,
      minutes: input.minutes,
      intervalSeconds: input.intervalSeconds,
      requestedMix: { move: 0.5, explore: 0.3, produce: 0.2 },
      actualMix: analysis.mix,
      ticks: input.workload.ticks,
      plannedActions: input.workload.plannedActions,
      minimumCompletedActions: input.minimumCompletedActions,
      completedActions: analysis.completedActions.length,
      failedActions: analysis.failedActions.length,
      reverts: analysis.reverts.length,
      indexingLoss: analysis.indexingLoss.length,
      warmupMs: input.workload.warmupMs,
      startedAt: input.workload.startedAt,
      endedAt: input.workload.endedAt,
      percentiles: analysis.percentiles,
      actions: analysis.actions,
    },
    setup: {
      deployedAccounts: input.accounts.map(({ address, botId, deployedInMs }) => ({ address, botId, deployedInMs })),
      transactions: [...input.setupTransactions].sort((left, right) => left.botId - right.botId),
      failures: analysis.setupFailures.length,
    },
    thresholds: {
      limits: {
        acceptedOnL2P95Ms: ACCEPTED_ON_L2_P95_LIMIT_MS,
        indexedP95Ms: INDEXED_P95_LIMIT_MS,
        preConfirmedP95Ms: PRECONFIRMED_P95_LIMIT_MS,
        indexingTimeoutMs: 30_000,
        minimumCompletedActions: input.minimumCompletedActions,
      },
      checks: analysis.checks,
    },
    evidence: {
      blockStatsBefore: input.evidence.blockStatsBefore,
      blockStatsAfter: input.evidence.blockStatsAfter,
    },
  };
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

export function summarizeMix(actions: readonly Pick<TrackedTransaction, "kind">[]): Record<WorkloadActionKind, number> {
  const counts: Record<WorkloadActionKind, number> = { move: 0, explore: 0, produce: 0 };
  for (const action of actions) {
    if (action.kind in counts) counts[action.kind as WorkloadActionKind] += 1;
  }
  return counts;
}

function summarizePercentiles(actions: TrackedTransaction[]): PercentileSummary {
  return {
    acceptedOnL2Ms: latencyPercentiles(actions, "acceptedOnL2Ms"),
    indexedMs: latencyPercentiles(actions, "indexedMs"),
    preConfirmedMs: latencyPercentiles(actions, "preConfirmedMs"),
    submitDelayMs: latencyPercentiles(actions, "submitDelayMs"),
    submitMs: latencyPercentiles(actions, "submitMs"),
  };
}

function latencyPercentiles(
  actions: TrackedTransaction[],
  field: "acceptedOnL2Ms" | "indexedMs" | "preConfirmedMs" | "submitDelayMs" | "submitMs",
): LatencyPercentiles {
  const values = actions.flatMap((action) => (action[field] === undefined ? [] : [action[field]]));
  return { p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99) };
}

function passesLatency(value: number | null, limit: number): boolean {
  return value !== null && value <= limit;
}

async function captureBlockStats(): Promise<string> {
  return runCommand([path.resolve(import.meta.dir, "../scripts/block-stats.sh")]);
}

async function readMadaraImage(): Promise<HarnessEvidence["madaraImage"]> {
  const output = await runCommand([
    "docker",
    "inspect",
    "--format={{.Config.Image}}|{{.Image}}",
    "madara-lab",
  ]);
  const [tag, digest] = output.trim().split("|");
  if (!tag || !digest) throw new Error(`Could not parse Madara image metadata: ${output}`);
  return { tag, digest };
}

async function runCommand(command: string[]): Promise<string> {
  const process = Bun.spawn(command, {
    cwd: path.resolve(import.meta.dir, "../../.."),
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
