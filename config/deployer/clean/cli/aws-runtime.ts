#!/usr/bin/env bun
import * as fs from "node:fs";
import { resolveDeploymentEnvironment } from "../environment";
import {
  classifyAwsRuntimeFailure,
  deleteAwsRuntime,
  describeAwsRuntime,
  ensureAwsRuntime,
  resizeAwsRuntime,
  toAwsRuntimeArtifact,
  type AwsRuntimeActionResult,
  type AwsRuntimeDiff,
  type AwsRuntimeKind,
  type AwsRuntimeLiveState,
} from "../runtime/aws-runtime";
import type { DeploymentEnvironmentId, IndexerTier } from "../types";
import { parseArgs } from "./args";

type AwsRuntimeOperation = "deploy" | "inspect" | "resize" | "delete";

export interface AwsRuntimeCliRequest {
  operation: AwsRuntimeOperation;
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  tier?: IndexerTier;
  rpcUrl?: string;
  worldAddress?: string;
  worldBlock?: string;
  namespaces?: string;
  externalContracts?: string[];
  version?: string;
  retainData?: boolean;
}

export interface AwsRuntimeCliResult {
  operation: AwsRuntimeOperation;
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  action?: AwsRuntimeActionResult["action"];
  mode?: AwsRuntimeActionResult["mode"];
  requestedTier?: IndexerTier;
  diff?: AwsRuntimeDiff;
  adopted?: AwsRuntimeActionResult["adopted"];
  swept?: AwsRuntimeActionResult["swept"];
  restoredFromSnapshot?: string;
  health?: AwsRuntimeLiveState["health"];
  liveState: AwsRuntimeLiveState;
  artifact: ReturnType<typeof toAwsRuntimeArtifact>;
}

export interface AwsRuntimeCliFailureResult {
  operation?: AwsRuntimeOperation;
  environmentId?: DeploymentEnvironmentId;
  runtimeKind?: AwsRuntimeKind;
  runtimeName?: string;
  failureClassification: ReturnType<typeof classifyAwsRuntimeFailure>;
  errorMessage: string;
  failedAt: string;
}

const supportedFailureClassifications: ReadonlySet<AwsRuntimeCliFailureResult["failureClassification"]> = new Set([
  "missing-foundation-config",
  "aws-command-failed",
  "image-not-found",
  "rollout-failed",
  "stabilization-timeout",
  "runtime-state-indeterminate",
  "runtime-validation",
  "unknown",
]);
const supportedOperations: ReadonlySet<AwsRuntimeCliResult["operation"]> = new Set([
  "deploy",
  "inspect",
  "resize",
  "delete",
]);
const supportedEnvironmentIds: ReadonlySet<DeploymentEnvironmentId> = new Set([
  "slot.blitz",
  "slot.eternum",
  "mainnet.blitz",
  "mainnet.eternum",
]);
const supportedRuntimeKinds: ReadonlySet<AwsRuntimeKind> = new Set(["katana", "torii"]);
const supportedActions: ReadonlySet<NonNullable<AwsRuntimeCliResult["action"]>> = new Set([
  "created",
  "already-live",
  "updated",
  "deleted",
  "already-missing",
]);
const supportedTiers: ReadonlySet<IndexerTier> = new Set(["basic", "pro", "epic", "legendary"]);

function usage() {
  console.log(
    [
      "",
      "Usage: bun config/deployer/clean/cli/aws-runtime.ts --operation <deploy|inspect|resize|delete> --environment <slot.blitz|slot.eternum|mainnet.blitz|mainnet.eternum> --runtime-kind <katana|torii> --runtime-name <name>",
      "",
      "Optional flags:",
      "  --tier <basic|pro|epic|legendary>",
      "  --rpc-url <url>",
      "  --world-address <0x...>",
      "  --world-block <block-number>",
      "  --namespaces <comma-separated namespaces>",
      "  --external-contracts <newline-or-comma-separated contracts>",
      "  --version <dojo runtime version>",
      "  --retain-data (delete only; keep snapshot data for later restore)",
      "",
    ].join("\n"),
  );
}

function parseOperation(value: string | undefined): AwsRuntimeOperation {
  if (value === "deploy" || value === "inspect" || value === "resize" || value === "delete") {
    return value;
  }

  throw new Error(`Unsupported AWS runtime operation "${value || ""}"`);
}

function parseRuntimeKind(value: string | undefined): AwsRuntimeKind {
  if (value === "katana" || value === "torii") {
    return value;
  }

  throw new Error(`Unsupported AWS runtime kind "${value || ""}"`);
}

function parseTier(value: string | undefined): IndexerTier | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "basic" || value === "pro" || value === "epic" || value === "legendary") {
    return value;
  }

  throw new Error(`Unsupported AWS runtime tier "${value}"`);
}

function parseExternalContracts(value: string | undefined): string[] {
  return (value || "")
    .split(/\r?\n|,/)
    .map((contract) => contract.trim())
    .filter(Boolean);
}

function resolveCliRequest(): AwsRuntimeCliRequest {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    usage();
    process.exit(0);
  }

  const environmentId = args.environment;
  if (!environmentId) {
    throw new Error("--environment is required");
  }

  const environment = resolveDeploymentEnvironment(environmentId);
  const runtimeName = args["runtime-name"] || args["torii-name"] || args["katana-name"];
  if (!runtimeName) {
    throw new Error("--runtime-name is required");
  }

  return {
    operation: parseOperation(args.operation),
    environmentId: environment.id,
    runtimeKind: parseRuntimeKind(args["runtime-kind"]),
    runtimeName,
    tier: parseTier(args.tier),
    rpcUrl: args["rpc-url"],
    worldAddress: args["world-address"],
    worldBlock: args["world-block"],
    namespaces: args.namespaces,
    externalContracts: parseExternalContracts(args["external-contracts"] || args["torii-external-contracts"]),
    version: args.version,
    retainData: args["retain-data"] === "true",
  };
}

function buildRuntimeRequest(request: AwsRuntimeCliRequest) {
  const environment = resolveDeploymentEnvironment(request.environmentId);

  return {
    environmentId: environment.id,
    runtimeKind: request.runtimeKind,
    runtimeName: request.runtimeName,
    tier: request.tier,
    rpcUrl: request.rpcUrl || environment.rpcUrl,
    worldAddress: request.worldAddress,
    worldBlock: request.worldBlock,
    namespaces: request.namespaces,
    externalContracts: request.externalContracts,
    version: request.version,
    domain: environment.runtimeDomain,
    retainData: request.retainData,
  };
}

function validateRuntimeOperationRequest(
  request: AwsRuntimeCliRequest,
  runtimeRequest: ReturnType<typeof buildRuntimeRequest>,
): void {
  if (request.operation !== "deploy" || runtimeRequest.runtimeKind !== "torii") {
    return;
  }

  if (!runtimeRequest.rpcUrl) {
    throw new Error("Torii AWS runtime deploy requires --rpc-url");
  }

  if (!runtimeRequest.worldAddress) {
    throw new Error("Torii AWS runtime deploy requires --world-address");
  }
}

async function runAwsRuntimeOperation(request: AwsRuntimeCliRequest): Promise<AwsRuntimeCliResult> {
  const runtimeRequest = buildRuntimeRequest(request);
  validateRuntimeOperationRequest(request, runtimeRequest);

  if (request.operation === "inspect") {
    const liveState = await describeAwsRuntime(runtimeRequest);
    return buildCliResult(request, liveState);
  }

  if (request.operation === "resize") {
    return buildCliResultFromAction(request, await resizeAwsRuntime(runtimeRequest));
  }

  if (request.operation === "delete") {
    return buildCliResultFromAction(request, await deleteAwsRuntime(runtimeRequest));
  }

  return buildCliResultFromAction(request, await ensureAwsRuntime(runtimeRequest));
}

function buildCliResult(request: AwsRuntimeCliRequest, liveState: AwsRuntimeLiveState): AwsRuntimeCliResult {
  return {
    operation: request.operation,
    environmentId: request.environmentId,
    runtimeKind: request.runtimeKind,
    runtimeName: request.runtimeName,
    restoredFromSnapshot: liveState.restoredFromSnapshot,
    health: liveState.health,
    liveState,
    artifact: toAwsRuntimeArtifact(liveState),
  };
}

function buildCliResultFromAction(request: AwsRuntimeCliRequest, result: AwsRuntimeActionResult): AwsRuntimeCliResult {
  return {
    ...buildCliResult(request, result.liveState),
    action: result.action,
    mode: result.mode,
    requestedTier: result.requestedTier,
    diff: result.diff,
    adopted: result.adopted,
    swept: result.swept,
  };
}

function writeJsonResult(result: AwsRuntimeCliResult | AwsRuntimeCliFailureResult): void {
  validateCliResult(result);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  process.stdout.write(json);
}

export function validateCliResult(result: AwsRuntimeCliResult | AwsRuntimeCliFailureResult): void {
  if ("failureClassification" in result) {
    validateFailureResult(result);
    return;
  }

  validateSuccessResult(result);
}

function validateSuccessResult(result: AwsRuntimeCliResult): void {
  const requiredStrings = [
    ["operation", result.operation],
    ["environmentId", result.environmentId],
    ["runtimeKind", result.runtimeKind],
    ["runtimeName", result.runtimeName],
  ];
  const missingField = requiredStrings.find(([, value]) => typeof value !== "string" || value.length === 0)?.[0];
  if (missingField) {
    throw new Error(`AWS runtime CLI result missing ${missingField}`);
  }

  if (!supportedOperations.has(result.operation)) {
    throw new Error(`AWS runtime CLI result has unsupported operation "${result.operation}"`);
  }

  if (!supportedEnvironmentIds.has(result.environmentId)) {
    throw new Error(`AWS runtime CLI result has unsupported environmentId "${result.environmentId}"`);
  }

  if (!supportedRuntimeKinds.has(result.runtimeKind)) {
    throw new Error(`AWS runtime CLI result has unsupported runtimeKind "${result.runtimeKind}"`);
  }

  if (result.operation !== "inspect" && !result.action) {
    throw new Error("AWS runtime CLI result missing action");
  }

  if (result.action && !supportedActions.has(result.action)) {
    throw new Error(`AWS runtime CLI result has unsupported action "${result.action}"`);
  }

  if (result.operation !== "inspect" && !supportedTiers.has(result.requestedTier as IndexerTier)) {
    throw new Error(`AWS runtime CLI result has unsupported requestedTier "${result.requestedTier || ""}"`);
  }

  if (result.action && result.mode !== "aws-ecs") {
    throw new Error("AWS runtime CLI action result missing aws-ecs mode");
  }

  if (!result.liveState || !result.artifact) {
    throw new Error("AWS runtime CLI result missing live state or artifact");
  }

  if (!artifactMatchesLiveState(result)) {
    throw new Error("AWS runtime CLI result artifact does not match live state");
  }

  if (result.liveState.health && result.health !== result.liveState.health) {
    throw new Error("AWS runtime CLI result health does not match live state");
  }

  if (result.artifact.health && result.health !== result.artifact.health) {
    throw new Error("AWS runtime CLI result health does not match artifact");
  }

  if (result.health && result.health.status !== "unknown" && !Number.isFinite(result.health.latencyMs)) {
    throw new Error("AWS runtime CLI result probed health missing latency");
  }
}

function artifactMatchesLiveState(result: AwsRuntimeCliResult): boolean {
  return JSON.stringify(result.artifact) === JSON.stringify(toAwsRuntimeArtifact(result.liveState));
}

function validateFailureResult(result: AwsRuntimeCliFailureResult): void {
  if (!result.failureClassification) {
    throw new Error("AWS runtime CLI failure result missing classification");
  }

  if (!supportedFailureClassifications.has(result.failureClassification)) {
    throw new Error(`AWS runtime CLI failure result has unsupported classification "${result.failureClassification}"`);
  }

  if (!result.errorMessage) {
    throw new Error("AWS runtime CLI failure result missing error message");
  }

  if (!Number.isFinite(Date.parse(result.failedAt))) {
    throw new Error("AWS runtime CLI failure result missing failedAt timestamp");
  }
}

function writeCliSummary(result: AwsRuntimeCliResult): void {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        "## AWS Runtime",
        "",
        `- Operation: \`${result.operation}\``,
        `- Runtime: \`${result.runtimeName}/${result.runtimeKind}\``,
        `- Status: \`${result.liveState.status}\``,
        result.liveState.endpointUrl ? `- Endpoint: ${result.liveState.endpointUrl}` : "",
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function writeFailureSummary(result: AwsRuntimeCliFailureResult): void {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "## AWS Runtime",
      "",
      `- Status: \`failed\``,
      `- Classification: \`${result.failureClassification}\``,
      result.runtimeName && result.runtimeKind ? `- Runtime: \`${result.runtimeName}/${result.runtimeKind}\`` : "",
      `- Error: \`${result.errorMessage}\``,
      "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function buildFailureResult(error: unknown, request?: AwsRuntimeCliRequest): AwsRuntimeCliFailureResult {
  return {
    operation: request?.operation,
    environmentId: request?.environmentId,
    runtimeKind: request?.runtimeKind,
    runtimeName: request?.runtimeName,
    failureClassification: classifyAwsRuntimeFailure(error),
    errorMessage: error instanceof Error ? error.message : String(error),
    failedAt: new Date().toISOString(),
  };
}

async function main() {
  let request: AwsRuntimeCliRequest | undefined;

  try {
    request = resolveCliRequest();
    const result = await runAwsRuntimeOperation(request);
    writeJsonResult(result);
    writeCliSummary(result);
  } catch (error) {
    const result = buildFailureResult(error, request);
    writeJsonResult(result);
    writeFailureSummary(result);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
