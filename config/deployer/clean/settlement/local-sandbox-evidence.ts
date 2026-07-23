import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  requireCanonicalLocalSettlementSandboxPlan,
  type LocalSettlementChainPlan,
  type LocalSettlementChainRunResult,
  type LocalSettlementChainSmokeResult,
  type LocalSettlementSandboxFailedResult,
  type LocalSettlementSandboxFailure,
  type LocalSettlementSandboxPlan,
  type LocalSettlementSandboxSmokeResult,
} from "./local-sandbox";

export function writeLocalSettlementSandboxEvidence(
  plan: LocalSettlementSandboxPlan,
  result: LocalSettlementSandboxSmokeResult,
): string {
  const canonicalPlan = requireCanonicalLocalSettlementSandboxPlan(plan);
  assertResultMatchesPlan(canonicalPlan, result);
  const evidenceFile = path.join(canonicalPlan.runRoot, "run.json");
  const temporaryFile = path.join(canonicalPlan.runRoot, ".run.json.tmp");
  mkdirSync(canonicalPlan.runRoot, { recursive: true });
  assertEvidenceFileDoesNotExist(evidenceFile);

  try {
    writeFileSync(temporaryFile, `${JSON.stringify(result, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporaryFile, evidenceFile);
    return evidenceFile;
  } finally {
    if (existsSync(temporaryFile)) unlinkSync(temporaryFile);
  }
}

function assertResultMatchesPlan(plan: LocalSettlementSandboxPlan, result: LocalSettlementSandboxSmokeResult): void {
  assertResultEnvelopeMatchesPlan(plan, result);
  if (!Array.isArray(result.chains) || result.chains.length !== plan.chains.length) {
    throw new Error("Local settlement sandbox evidence requires exactly two chain results");
  }
  plan.chains.forEach((chain, index) => {
    const chainResult = result.chains[index];
    assertChainResultMatchesPlan(chain, chainResult);
    if (result.status === "passed") {
      assertPassedChainResult(chain, chainResult as LocalSettlementChainSmokeResult);
    } else {
      assertFailedChainResult(chain, chainResult as LocalSettlementChainRunResult, result.failures);
    }
  });
  if (result.status === "failed") assertFailuresAreStructured(result);
}

function assertResultEnvelopeMatchesPlan(
  plan: LocalSettlementSandboxPlan,
  result: LocalSettlementSandboxSmokeResult,
): void {
  if (
    result.schemaVersion !== 1 ||
    result.operation !== "local-settlement-sandbox-smoke" ||
    (result.status !== "passed" && result.status !== "failed") ||
    result.environmentId !== plan.environmentId ||
    result.runId !== plan.runId ||
    result.attestationMode !== plan.attestationMode ||
    result.evidenceClass !== "test-only" ||
    result.productionCompletionEvidence !== false
  ) {
    throw new Error("Local settlement sandbox evidence does not match its canonical test-only plan");
  }
}

function assertChainResultMatchesPlan(
  chain: LocalSettlementChainPlan,
  result: LocalSettlementChainRunResult | LocalSettlementChainSmokeResult,
): void {
  if (result.layer !== chain.layer || result.plannedChainId !== chain.chainId || result.rpcUrl !== chain.rpcUrl) {
    throw new Error(`Local settlement sandbox evidence does not match its canonical ${chain.layer} binding`);
  }
}

function assertPassedChainResult(chain: LocalSettlementChainPlan, result: LocalSettlementChainSmokeResult): void {
  if (
    result.observedChainId !== chain.chainId ||
    !isPositiveInteger(result.processId) ||
    !isNonNegativeInteger(result.blockNumber) ||
    !isFelt(result.genesisHash) ||
    !isFelt(result.stateRoot) ||
    !isNonEmptyString(result.katanaVersion) ||
    !isIsoTimestamp(result.startedAt) ||
    !isIsoTimestamp(result.readyAt) ||
    !isIsoTimestamp(result.stoppedAt)
  ) {
    throw new Error(`Local settlement sandbox passed ${chain.layer} evidence is malformed`);
  }
}

function assertFailedChainResult(
  chain: LocalSettlementChainPlan,
  result: LocalSettlementChainRunResult,
  failures: LocalSettlementSandboxFailure[],
): void {
  if (
    !["not-started", "started", "ready"].includes(result.lifecycleStatus) ||
    !["not-required", "stopped", "failed"].includes(result.cleanupStatus)
  ) {
    throw new Error(`Local settlement sandbox failed ${chain.layer} lifecycle evidence is malformed`);
  }
  assertFailedChainLifecycleFields(chain, result, failures);
  assertFailedChainCleanupFields(chain, result);
}

function assertFailedChainLifecycleFields(
  chain: LocalSettlementChainPlan,
  result: LocalSettlementChainRunResult,
  failures: LocalSettlementSandboxFailure[],
): void {
  if (result.lifecycleStatus === "not-started") {
    if (result.processId !== undefined || result.startedAt !== undefined) {
      throw new Error(`Local settlement sandbox non-started ${chain.layer} evidence is malformed`);
    }
    return;
  }
  if (!isPositiveInteger(result.processId) || !isIsoTimestamp(result.startedAt)) {
    throw new Error(`Local settlement sandbox started ${chain.layer} evidence is malformed`);
  }
  if (result.lifecycleStatus !== "ready") return;
  if (
    !isNonEmptyString(result.observedChainId) ||
    !isNonNegativeInteger(result.blockNumber) ||
    !isFelt(result.genesisHash) ||
    !isFelt(result.stateRoot) ||
    !isNonEmptyString(result.katanaVersion) ||
    !isIsoTimestamp(result.readyAt)
  ) {
    throw new Error(`Local settlement sandbox ready ${chain.layer} evidence is malformed`);
  }
  if (
    result.observedChainId !== chain.chainId &&
    !failures.some((failure) => failure.step === "identity-verification" && failure.layer === chain.layer)
  ) {
    throw new Error(`Local settlement sandbox observed ${chain.layer} identity is not accounted for`);
  }
}

function assertFailedChainCleanupFields(chain: LocalSettlementChainPlan, result: LocalSettlementChainRunResult): void {
  if (result.cleanupStatus === "not-required") {
    if (result.lifecycleStatus !== "not-started" || result.stoppedAt || result.cleanupError) {
      throw new Error(`Local settlement sandbox skipped ${chain.layer} cleanup evidence is malformed`);
    }
    return;
  }
  if (result.lifecycleStatus === "not-started") {
    throw new Error(`Local settlement sandbox ${chain.layer} cleanup cannot precede startup`);
  }
  if (result.cleanupStatus === "stopped" && !isIsoTimestamp(result.stoppedAt)) {
    throw new Error(`Local settlement sandbox stopped ${chain.layer} evidence is malformed`);
  }
  if (result.cleanupStatus === "failed" && !isNonEmptyString(result.cleanupError)) {
    throw new Error(`Local settlement sandbox failed ${chain.layer} cleanup evidence is malformed`);
  }
}

function assertFailuresAreStructured(result: LocalSettlementSandboxFailedResult): void {
  if (!Array.isArray(result.failures) || result.failures.length === 0) {
    throw new Error("Local settlement sandbox failed evidence requires structured failures");
  }
  for (const failure of result.failures) {
    if (
      !["start", "readiness", "identity-verification", "cleanup"].includes(failure.step) ||
      !["settlement", "appchain"].includes(failure.layer || "") ||
      !isNonEmptyString(failure.errorName) ||
      !isNonEmptyString(failure.errorMessage)
    ) {
      throw new Error("Local settlement sandbox failure evidence is malformed");
    }
  }
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isFelt(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-f]+$/i.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function assertEvidenceFileDoesNotExist(evidenceFile: string): void {
  if (existsSync(evidenceFile)) {
    throw new Error(`Local settlement sandbox refuses to overwrite evidence "${evidenceFile}"`);
  }
}
