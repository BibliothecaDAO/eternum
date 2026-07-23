import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { resolveDeploymentEnvironment } from "../environment";
import type { DeploymentEnvironmentId } from "../types";

export type LocalSettlementAttestationMode = "fixture";
export type LocalSettlementChainLayer = "settlement" | "appchain";

export interface LocalSettlementSandboxRequest {
  environmentId: DeploymentEnvironmentId;
  runId: string;
  runRoot: string;
  attestationMode: LocalSettlementAttestationMode;
  settlementPort?: number;
  appchainPort?: number;
}

export interface LocalSettlementChainPlan {
  layer: LocalSettlementChainLayer;
  chainId: string;
  rpcUrl: string;
  port: number;
  seed: number;
  dataDir: string;
  logFile: string;
}

export interface LocalSettlementSandboxPlan {
  schemaVersion: 1;
  environmentId: "local.blitz";
  runId: string;
  runRoot: string;
  evidenceClass: "test-only";
  productionCompletionEvidence: false;
  attestationMode: "fixture";
  chains: [LocalSettlementChainPlan, LocalSettlementChainPlan];
}

export interface LocalSettlementChainProcess {
  layer: LocalSettlementChainLayer;
  processId: number;
  startedAt: string;
}

export interface LocalSettlementChainObservation {
  observedChainId: string;
  blockNumber: number;
  genesisHash: string;
  stateRoot: string;
  katanaVersion: string;
  readyAt: string;
}

export interface LocalSettlementChainStop {
  stoppedAt: string;
}

export interface LocalSettlementSandboxRuntime {
  startChain(chain: LocalSettlementChainPlan): Promise<LocalSettlementChainProcess>;
  waitForChain(chain: LocalSettlementChainPlan): Promise<LocalSettlementChainObservation>;
  stopChain(process: LocalSettlementChainProcess, chain: LocalSettlementChainPlan): Promise<LocalSettlementChainStop>;
}

export interface LocalSettlementChainSmokeResult {
  layer: LocalSettlementChainLayer;
  plannedChainId: string;
  observedChainId: string;
  rpcUrl: string;
  processId: number;
  blockNumber: number;
  genesisHash: string;
  stateRoot: string;
  katanaVersion: string;
  startedAt: string;
  readyAt: string;
  stoppedAt: string;
}

export interface LocalSettlementSandboxPassedResult {
  schemaVersion: 1;
  operation: "local-settlement-sandbox-smoke";
  status: "passed";
  environmentId: "local.blitz";
  runId: string;
  evidenceClass: "test-only";
  productionCompletionEvidence: false;
  attestationMode: "fixture";
  chains: [LocalSettlementChainSmokeResult, LocalSettlementChainSmokeResult];
}

export type LocalSettlementSandboxStep = "start" | "readiness" | "identity-verification" | "cleanup";

export interface LocalSettlementSandboxFailure {
  step: LocalSettlementSandboxStep;
  layer?: LocalSettlementChainLayer;
  errorName: string;
  errorMessage: string;
}

export interface LocalSettlementChainRunResult {
  layer: LocalSettlementChainLayer;
  plannedChainId: string;
  rpcUrl: string;
  lifecycleStatus: "not-started" | "started" | "ready";
  cleanupStatus: "not-required" | "stopped" | "failed";
  processId?: number;
  observedChainId?: string;
  blockNumber?: number;
  genesisHash?: string;
  stateRoot?: string;
  katanaVersion?: string;
  startedAt?: string;
  readyAt?: string;
  stoppedAt?: string;
  cleanupError?: string;
}

export interface LocalSettlementSandboxFailedResult {
  schemaVersion: 1;
  operation: "local-settlement-sandbox-smoke";
  status: "failed";
  environmentId: "local.blitz";
  runId: string;
  evidenceClass: "test-only";
  productionCompletionEvidence: false;
  attestationMode: "fixture";
  failures: LocalSettlementSandboxFailure[];
  chains: [LocalSettlementChainRunResult, LocalSettlementChainRunResult];
}

export type LocalSettlementSandboxSmokeResult = LocalSettlementSandboxPassedResult | LocalSettlementSandboxFailedResult;

interface StartedSettlementChain {
  plan: LocalSettlementChainPlan;
  process: LocalSettlementChainProcess;
}

interface ObservedSettlementChain extends StartedSettlementChain {
  observation: LocalSettlementChainObservation;
}

interface LocalSettlementSandboxExecution {
  startedChains: StartedSettlementChain[];
  observedChains: ObservedSettlementChain[];
  failures: LocalSettlementSandboxFailure[];
}

interface LocalSettlementCleanupAttempt {
  layer: LocalSettlementChainLayer;
  stop?: LocalSettlementChainStop;
  failure?: LocalSettlementSandboxFailure;
}

const DEFAULT_SETTLEMENT_PORT = 5051;
const DEFAULT_APPCHAIN_PORT = 5052;

export function buildLocalSettlementSandboxPlan(request: LocalSettlementSandboxRequest): LocalSettlementSandboxPlan {
  assertLocalFixtureBoundary(request);
  assertCanonicalRunId(request.runId);
  const runRoot = resolveDedicatedRunRoot(request.runRoot);
  const settlementPort = resolvePort(request.settlementPort, DEFAULT_SETTLEMENT_PORT);
  const appchainPort = resolvePort(request.appchainPort, DEFAULT_APPCHAIN_PORT);
  assertDistinctPorts(settlementPort, appchainPort);

  return {
    schemaVersion: 1,
    environmentId: "local.blitz",
    runId: request.runId,
    runRoot,
    evidenceClass: "test-only",
    productionCompletionEvidence: false,
    attestationMode: "fixture",
    chains: [
      buildChainPlan("settlement", "WP_BLITZ_L1_LOCAL", settlementPort, 1101, runRoot),
      buildChainPlan("appchain", "WP_BLITZ_L3_LOCAL", appchainPort, 3101, runRoot),
    ],
  };
}

export async function runLocalSettlementSandboxSmoke(
  plan: LocalSettlementSandboxPlan,
  runtime: LocalSettlementSandboxRuntime,
): Promise<LocalSettlementSandboxSmokeResult> {
  const canonicalPlan = requireCanonicalLocalSettlementSandboxPlan(plan);
  const execution = await executeLocalSettlementSandbox(canonicalPlan, runtime);
  const cleanup = await cleanUpLocalSettlementSandbox(execution.startedChains, runtime);
  return buildLocalSettlementSandboxResult(canonicalPlan, execution, cleanup);
}

export function requireCanonicalLocalSettlementSandboxPlan(
  plan: LocalSettlementSandboxPlan,
): LocalSettlementSandboxPlan {
  const settlement = plan.chains?.[0];
  const appchain = plan.chains?.[1];
  if (!settlement || !appchain) {
    throw new Error("Local settlement sandbox plan requires exactly two chains");
  }
  const canonicalPlan = buildLocalSettlementSandboxPlan({
    environmentId: plan.environmentId,
    runId: plan.runId,
    runRoot: plan.runRoot,
    attestationMode: plan.attestationMode,
    settlementPort: settlement.port,
    appchainPort: appchain.port,
  });
  if (!isDeepStrictEqual(plan, canonicalPlan)) {
    throw new Error("Local settlement sandbox plan does not match its canonical local.blitz identity");
  }
  return canonicalPlan;
}

function assertLocalFixtureBoundary(request: LocalSettlementSandboxRequest): void {
  resolveDeploymentEnvironment(request.environmentId);
  if (request.environmentId !== "local.blitz" || request.attestationMode !== "fixture") {
    throw new Error("Fixture settlement evidence is restricted to local.blitz");
  }
}

function assertCanonicalRunId(runId: string): void {
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(runId)) {
    throw new Error("Local settlement sandbox runId must be a canonical lowercase identifier");
  }
}

function resolveDedicatedRunRoot(runRoot: string): string {
  const resolved = path.resolve(runRoot);
  if (!path.isAbsolute(runRoot) || resolved === path.parse(resolved).root) {
    throw new Error("Local settlement sandbox requires a dedicated absolute run root");
  }
  return resolved;
}

function resolvePort(requested: number | undefined, fallback: number): number {
  const port = requested ?? fallback;
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error("Local settlement sandbox ports must be integers from 1024 through 65535");
  }
  return port;
}

function assertDistinctPorts(settlementPort: number, appchainPort: number): void {
  if (settlementPort === appchainPort) {
    throw new Error("Local settlement sandbox chains require distinct ports");
  }
}

function buildChainPlan(
  layer: LocalSettlementChainLayer,
  chainId: string,
  port: number,
  seed: number,
  runRoot: string,
): LocalSettlementChainPlan {
  const chainRoot = path.join(runRoot, layer);
  return {
    layer,
    chainId,
    rpcUrl: `http://127.0.0.1:${port}`,
    port,
    seed,
    dataDir: path.join(chainRoot, "data"),
    logFile: path.join(chainRoot, "katana.log"),
  };
}

async function executeLocalSettlementSandbox(
  plan: LocalSettlementSandboxPlan,
  runtime: LocalSettlementSandboxRuntime,
): Promise<LocalSettlementSandboxExecution> {
  const startup = await startPlannedChains(plan, runtime);
  if (startup.failure) {
    return {
      startedChains: startup.startedChains,
      observedChains: [],
      failures: [startup.failure],
    };
  }

  const readiness = await observeStartedChains(startup.startedChains, runtime);
  if (readiness.failures.length > 0) {
    return {
      startedChains: startup.startedChains,
      observedChains: readiness.observedChains,
      failures: readiness.failures,
    };
  }

  const identityFailure = findChainIdentityFailure(readiness.observedChains);
  return {
    startedChains: startup.startedChains,
    observedChains: readiness.observedChains,
    failures: identityFailure ? [identityFailure] : [],
  };
}

async function startPlannedChains(
  plan: LocalSettlementSandboxPlan,
  runtime: LocalSettlementSandboxRuntime,
): Promise<{
  startedChains: StartedSettlementChain[];
  failure?: LocalSettlementSandboxFailure;
}> {
  const startedChains: StartedSettlementChain[] = [];
  for (const chain of plan.chains) {
    try {
      startedChains.push({ plan: chain, process: await runtime.startChain(chain) });
    } catch (error) {
      return {
        startedChains,
        failure: buildSandboxFailure("start", chain.layer, error),
      };
    }
  }
  return { startedChains };
}

async function observeStartedChains(
  startedChains: StartedSettlementChain[],
  runtime: LocalSettlementSandboxRuntime,
): Promise<{
  observedChains: ObservedSettlementChain[];
  failures: LocalSettlementSandboxFailure[];
}> {
  const outcomes = await Promise.all(
    startedChains.map(async (started) => {
      try {
        return {
          observed: {
            ...started,
            observation: await runtime.waitForChain(started.plan),
          },
        };
      } catch (error) {
        return {
          failure: buildSandboxFailure("readiness", started.plan.layer, error),
        };
      }
    }),
  );
  return {
    observedChains: outcomes.flatMap((outcome) => (outcome.observed ? [outcome.observed] : [])),
    failures: outcomes.flatMap((outcome) => (outcome.failure ? [outcome.failure] : [])),
  };
}

function findChainIdentityFailure(
  observedChains: ObservedSettlementChain[],
): LocalSettlementSandboxFailure | undefined {
  const mismatch = observedChains.find(({ plan, observation }) => observation.observedChainId !== plan.chainId);
  if (!mismatch) return undefined;
  return buildSandboxFailure(
    "identity-verification",
    mismatch.plan.layer,
    new Error(
      `Local settlement ${mismatch.plan.layer} chain identity mismatch: expected ${mismatch.plan.chainId}, observed ${mismatch.observation.observedChainId}`,
    ),
  );
}

async function cleanUpLocalSettlementSandbox(
  startedChains: StartedSettlementChain[],
  runtime: LocalSettlementSandboxRuntime,
): Promise<LocalSettlementCleanupAttempt[]> {
  const attempts: LocalSettlementCleanupAttempt[] = [];
  for (const started of [...startedChains].reverse()) {
    try {
      attempts.push({
        layer: started.plan.layer,
        stop: await runtime.stopChain(started.process, started.plan),
      });
    } catch (error) {
      attempts.push({
        layer: started.plan.layer,
        failure: buildSandboxFailure("cleanup", started.plan.layer, error),
      });
    }
  }
  return attempts;
}

function buildLocalSettlementSandboxResult(
  plan: LocalSettlementSandboxPlan,
  execution: LocalSettlementSandboxExecution,
  cleanup: LocalSettlementCleanupAttempt[],
): LocalSettlementSandboxSmokeResult {
  const cleanupFailures = cleanup.flatMap((attempt) => (attempt.failure ? [attempt.failure] : []));
  const failures = [...execution.failures, ...cleanupFailures];
  if (failures.length > 0) {
    return buildFailedSmokeResult(plan, execution, cleanup, failures);
  }
  return buildPassedSmokeResult(plan, execution, cleanup);
}

function buildPassedSmokeResult(
  plan: LocalSettlementSandboxPlan,
  execution: LocalSettlementSandboxExecution,
  cleanup: LocalSettlementCleanupAttempt[],
): LocalSettlementSandboxPassedResult {
  return {
    schemaVersion: 1,
    operation: "local-settlement-sandbox-smoke",
    status: "passed",
    environmentId: plan.environmentId,
    runId: plan.runId,
    evidenceClass: plan.evidenceClass,
    productionCompletionEvidence: plan.productionCompletionEvidence,
    attestationMode: plan.attestationMode,
    chains: plan.chains.map((chain) => buildPassedChainResult(chain, execution.observedChains, cleanup)) as [
      LocalSettlementChainSmokeResult,
      LocalSettlementChainSmokeResult,
    ],
  };
}

function buildPassedChainResult(
  chain: LocalSettlementChainPlan,
  observedChains: ObservedSettlementChain[],
  cleanup: LocalSettlementCleanupAttempt[],
): LocalSettlementChainSmokeResult {
  const observed = observedChains.find((candidate) => candidate.plan.layer === chain.layer);
  const stopped = cleanup.find((candidate) => candidate.layer === chain.layer)?.stop;
  if (!observed || !stopped) {
    throw new Error(`Local settlement ${chain.layer} success result is incomplete`);
  }
  return {
    layer: chain.layer,
    plannedChainId: chain.chainId,
    observedChainId: observed.observation.observedChainId,
    rpcUrl: chain.rpcUrl,
    processId: observed.process.processId,
    blockNumber: observed.observation.blockNumber,
    genesisHash: observed.observation.genesisHash,
    stateRoot: observed.observation.stateRoot,
    katanaVersion: observed.observation.katanaVersion,
    startedAt: observed.process.startedAt,
    readyAt: observed.observation.readyAt,
    stoppedAt: stopped.stoppedAt,
  };
}

function buildFailedSmokeResult(
  plan: LocalSettlementSandboxPlan,
  execution: LocalSettlementSandboxExecution,
  cleanup: LocalSettlementCleanupAttempt[],
  failures: LocalSettlementSandboxFailure[],
): LocalSettlementSandboxFailedResult {
  return {
    schemaVersion: 1,
    operation: "local-settlement-sandbox-smoke",
    status: "failed",
    environmentId: plan.environmentId,
    runId: plan.runId,
    evidenceClass: plan.evidenceClass,
    productionCompletionEvidence: plan.productionCompletionEvidence,
    attestationMode: plan.attestationMode,
    failures,
    chains: plan.chains.map((chain) => buildFailedChainResult(chain, execution, cleanup)) as [
      LocalSettlementChainRunResult,
      LocalSettlementChainRunResult,
    ],
  };
}

function buildFailedChainResult(
  chain: LocalSettlementChainPlan,
  execution: LocalSettlementSandboxExecution,
  cleanup: LocalSettlementCleanupAttempt[],
): LocalSettlementChainRunResult {
  const started = execution.startedChains.find((candidate) => candidate.plan.layer === chain.layer);
  const observed = execution.observedChains.find((candidate) => candidate.plan.layer === chain.layer);
  const cleanupAttempt = cleanup.find((candidate) => candidate.layer === chain.layer);
  return {
    layer: chain.layer,
    plannedChainId: chain.chainId,
    rpcUrl: chain.rpcUrl,
    lifecycleStatus: observed ? "ready" : started ? "started" : "not-started",
    cleanupStatus: cleanupAttempt?.failure ? "failed" : cleanupAttempt?.stop ? "stopped" : "not-required",
    ...(started
      ? {
          processId: started.process.processId,
          startedAt: started.process.startedAt,
        }
      : {}),
    ...(observed
      ? {
          observedChainId: observed.observation.observedChainId,
          blockNumber: observed.observation.blockNumber,
          genesisHash: observed.observation.genesisHash,
          stateRoot: observed.observation.stateRoot,
          katanaVersion: observed.observation.katanaVersion,
          readyAt: observed.observation.readyAt,
        }
      : {}),
    ...(cleanupAttempt?.stop ? { stoppedAt: cleanupAttempt.stop.stoppedAt } : {}),
    ...(cleanupAttempt?.failure ? { cleanupError: cleanupAttempt.failure.errorMessage } : {}),
  };
}

function buildSandboxFailure(
  step: LocalSettlementSandboxStep,
  layer: LocalSettlementChainLayer,
  error: unknown,
): LocalSettlementSandboxFailure {
  return {
    step,
    layer,
    errorName: error instanceof Error ? error.name : "Error",
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}
