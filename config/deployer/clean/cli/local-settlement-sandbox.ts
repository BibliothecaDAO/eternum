#!/usr/bin/env bun
import path from "node:path";
import { parseArgs } from "./args";
import { resolveDeploymentEnvironment } from "../environment";
import {
  buildLocalSettlementSandboxPlan,
  runLocalSettlementSandboxSmoke,
  type LocalSettlementSandboxRequest,
} from "../settlement/local-sandbox";
import { writeLocalSettlementSandboxEvidence } from "../settlement/local-sandbox-evidence";
import { LocalKatanaSandboxRuntime } from "../settlement/local-sandbox-runtime";

type LocalSettlementSandboxOperation = "plan" | "smoke";
type LocalSettlementSandboxCliFailureStep = "request-validation" | "evidence-write";

async function main(): Promise<void> {
  let args: Record<string, string> = {};
  try {
    args = parseArgs(process.argv.slice(2));
    const operation = resolveOperation(args.operation);
    const request = resolveRequest(args);
    const plan = buildLocalSettlementSandboxPlan(request);
    if (operation === "plan") {
      writeJson(plan);
      return;
    }

    const result = await runLocalSettlementSandboxSmoke(
      plan,
      new LocalKatanaSandboxRuntime({ katanaBinary: args["katana-binary"] }),
    );
    const evidenceFile = writeEvidenceOrThrowCliFailure(plan, result);
    writeJson({ ...result, evidenceFile });
    if (result.status === "failed") process.exitCode = 1;
  } catch (error) {
    writeJson(buildCliFailureResult(args, error));
    process.exitCode = 1;
  }
}

function writeEvidenceOrThrowCliFailure(
  plan: Parameters<typeof writeLocalSettlementSandboxEvidence>[0],
  result: Parameters<typeof writeLocalSettlementSandboxEvidence>[1],
): string {
  try {
    return writeLocalSettlementSandboxEvidence(plan, result);
  } catch (error) {
    throw new LocalSettlementSandboxCliError("evidence-write", error);
  }
}

function buildCliFailureResult(args: Record<string, string>, error: unknown) {
  const failure =
    error instanceof LocalSettlementSandboxCliError
      ? error
      : new LocalSettlementSandboxCliError("request-validation", error);
  return {
    schemaVersion: 1,
    operation: "local-settlement-sandbox",
    status: "failed",
    environmentId: args.environment || "unknown",
    runId: args["run-id"] || "unknown",
    evidenceClass: "test-only",
    productionCompletionEvidence: false,
    failure: {
      step: failure.step,
      errorName: failure.causeError instanceof Error ? failure.causeError.name : "Error",
      errorMessage: failure.causeError instanceof Error ? failure.causeError.message : String(failure.causeError),
    },
    failedAt: new Date().toISOString(),
  };
}

class LocalSettlementSandboxCliError extends Error {
  constructor(
    readonly step: LocalSettlementSandboxCliFailureStep,
    readonly causeError: unknown,
  ) {
    super(causeError instanceof Error ? causeError.message : String(causeError));
  }
}

function resolveOperation(value: string | undefined): LocalSettlementSandboxOperation {
  if (value === "plan" || value === "smoke") return value;
  throw new Error("Local settlement sandbox requires --operation plan or --operation smoke");
}

function resolveRequest(args: Record<string, string>): LocalSettlementSandboxRequest {
  const environment = resolveDeploymentEnvironment(args.environment || "");
  const runId = requireArg(args, "run-id");
  return {
    environmentId: environment.id,
    runId,
    runRoot: path.resolve(args["run-root"] || `.context/settlement-e2e/runs/${runId}`),
    attestationMode: resolveAttestationMode(args["attestation-mode"]),
    settlementPort: resolveOptionalPort(args["settlement-port"]),
    appchainPort: resolveOptionalPort(args["appchain-port"]),
  };
}

function resolveAttestationMode(value: string | undefined): "fixture" {
  if (!value || value === "fixture") return "fixture";
  throw new Error("Local settlement sandbox currently supports --attestation-mode fixture only");
}

function resolveOptionalPort(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port)) throw new Error(`Local settlement sandbox port "${value}" is not an integer`);
  return port;
}

function requireArg(args: Record<string, string>, name: string): string {
  const value = args[name]?.trim();
  if (!value) throw new Error(`Local settlement sandbox requires --${name}`);
  return value;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

await main();
