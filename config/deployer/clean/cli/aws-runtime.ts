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
import type { DeploymentEnvironmentId, IndexerTier, RuntimeLifecycleClass } from "../types";
import { assertCanonicalRuntimeName, requireRuntimeInstanceId } from "../runtime/runtime-identity";
import { parseArgs } from "./args";

type AwsRuntimeOperation = "deploy" | "inspect" | "resize" | "delete";

export interface AwsRuntimeCliRequest {
  operation: AwsRuntimeOperation;
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  runtimeInstanceId?: string;
  tier?: IndexerTier;
  rpcUrl?: string;
  worldAddress?: string;
  worldBlock?: string;
  namespaces?: string;
  externalContracts?: string[];
  version?: string;
  imageDigest?: string;
  upstreamRpcSecretArn?: string;
  routingShard?: number;
  lifecycleClass?: RuntimeLifecycleClass;
  retainData?: boolean;
  expectedDeleteAfter?: string;
}

export interface AwsRuntimeCliResult {
  operation: AwsRuntimeOperation;
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  runtimeInstanceId?: string;
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
  runtimeInstanceId?: string;
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
  "slottest.blitz",
  "slottest.eternum",
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
  "skipped-stale",
]);
const supportedTiers: ReadonlySet<IndexerTier> = new Set(["basic", "pro", "epic", "legendary"]);
const maxRequestFileBytes = 64 * 1024;
const requestFieldArgs: Readonly<Record<string, string>> = {
  version: "version",
  rpcUrl: "rpc-url",
  worldAddress: "world-address",
  worldBlock: "world-block",
  namespaces: "namespaces",
  externalContracts: "external-contracts",
  retainData: "retain-data",
  routingShard: "routing-shard",
  lifecycleClass: "lifecycle-class",
  expectedDeleteAfter: "expected-delete-after",
};

function usage() {
  console.log(
    [
      "",
      "Usage: bun config/deployer/clean/cli/aws-runtime.ts --operation <deploy|inspect|resize|delete> --environment <slot.blitz|slot.eternum|slottest.blitz|slottest.eternum|mainnet.blitz|mainnet.eternum> --runtime-kind <katana|torii> --runtime-name <name>",
      "",
      "Optional flags:",
      "  --tier <basic|pro|epic|legendary>",
      "  --runtime-instance-id <immutable runtime id>",
      "  --expected-delete-after <exact lifecycle timestamp required for delete>",
      "  --image-digest <sha256 digest>",
      "  --upstream-rpc-secret-arn <Secrets Manager ARN>",
      "  --routing-shard <non-negative shard number>",
      "  --lifecycle-class <shared|ephemeral>",
      "  --rpc-url <url>",
      "  --world-address <0x...>",
      "  --world-block <block-number>",
      "  --namespaces <comma-separated namespaces>",
      "  --external-contracts <newline-or-comma-separated contracts>",
      "  --version <dojo runtime version>",
      "  --retain-data (delete only; keep snapshot data for later restore)",
      "  --request-file <validated JSON request>",
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

function parseRoutingShard(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const routingShard = Number(value);
  if (!Number.isInteger(routingShard) || routingShard < 0) {
    throw new Error("--routing-shard must be a non-negative integer");
  }
  return routingShard;
}

function parseLifecycleClass(value: string | undefined): RuntimeLifecycleClass | undefined {
  if (value === undefined || value === "shared" || value === "ephemeral") {
    return value;
  }
  throw new Error("--lifecycle-class must be shared or ephemeral");
}

function resolveCliRequest(): AwsRuntimeCliRequest {
  const args = resolveCliArgs(process.argv.slice(2));

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
    runtimeInstanceId: args["runtime-instance-id"],
    tier: parseTier(args.tier),
    rpcUrl: args["rpc-url"],
    worldAddress: args["world-address"],
    worldBlock: args["world-block"],
    namespaces: args.namespaces,
    externalContracts: parseExternalContracts(args["external-contracts"] || args["torii-external-contracts"]),
    version: args.version,
    imageDigest: args["image-digest"],
    upstreamRpcSecretArn: args["upstream-rpc-secret-arn"],
    routingShard: parseRoutingShard(args["routing-shard"]),
    lifecycleClass: parseLifecycleClass(args["lifecycle-class"]),
    retainData: args["retain-data"] === "true",
    expectedDeleteAfter: args["expected-delete-after"],
  };
}

function resolveCliArgs(argv: string[]): Record<string, string> {
  const args = parseArgs(argv);
  const requestFile = args["request-file"];
  if (!requestFile) {
    return args;
  }

  return { ...buildRequestFileArgs(readRequestFile(requestFile)), ...args };
}

function readRequestFile(requestFile: string): Record<string, unknown> {
  let contents: string;
  try {
    const requestSize = fs.statSync(requestFile).size;
    if (requestSize > maxRequestFileBytes) {
      throw new Error(`exceeds the ${maxRequestFileBytes}-byte limit`);
    }
    contents = fs.readFileSync(requestFile, "utf8");
  } catch (error) {
    throw new Error(`AWS runtime request file could not be read: ${error instanceof Error ? error.message : error}`);
  }

  let request: unknown;
  try {
    request = JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error(
      `AWS runtime request file contains invalid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }

  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("AWS runtime request file must contain a JSON object");
  }

  return request as Record<string, unknown>;
}

function buildRequestFileArgs(request: Record<string, unknown>): Record<string, string> {
  const requestEntries = Object.entries(request);
  const unsupportedKey = requestEntries.find(([key]) => !requestFieldArgs[key])?.[0];
  if (unsupportedKey) {
    throw new Error(`AWS runtime request file contains unsupported field "${unsupportedKey}"`);
  }

  const requestArgs = Object.fromEntries(
    requestEntries.map(([key, value]) => {
      if (key === "externalContracts") {
        if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
          throw new Error("AWS runtime request externalContracts must be a string array");
        }
        return [requestFieldArgs[key], value.join("\n")];
      }
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        throw new Error(`AWS runtime request field "${key}" must be a scalar value`);
      }
      return [requestFieldArgs[key], `${value}`];
    }),
  );
  return requestArgs;
}

function buildRuntimeRequest(request: AwsRuntimeCliRequest) {
  const environment = resolveDeploymentEnvironment(request.environmentId);

  return {
    environmentId: environment.id,
    runtimeKind: request.runtimeKind,
    runtimeName: request.runtimeName,
    runtimeInstanceId: request.runtimeInstanceId,
    tier: request.tier,
    rpcUrl: request.rpcUrl || environment.rpcUrl,
    worldAddress: request.worldAddress,
    worldBlock: request.worldBlock,
    namespaces: request.namespaces,
    externalContracts: request.externalContracts,
    version: request.version,
    imageDigest: request.imageDigest,
    upstreamRpcSecretArn: request.upstreamRpcSecretArn,
    routingShard: request.routingShard,
    exposurePolicy: request.runtimeKind === "katana" ? ("public-dev-rpc" as const) : ("public-read" as const),
    lifecycleClass: request.lifecycleClass || ("shared" as const),
    domain: environment.runtimeDomain,
    retainData: request.retainData,
    expectedDeleteAfter: request.expectedDeleteAfter,
  };
}

function validateRuntimeOperationRequest(
  request: AwsRuntimeCliRequest,
  runtimeRequest: ReturnType<typeof buildRuntimeRequest>,
): void {
  assertCanonicalRuntimeName(request.runtimeName);
  if (request.operation !== "inspect") {
    requireRuntimeInstanceId(request.runtimeInstanceId);
  }

  if (request.environmentId.startsWith("mainnet.") && request.runtimeKind === "katana") {
    throw new Error(`AWS Katana is not permitted in production environment ${request.environmentId}`);
  }

  if (request.operation === "delete" && !Number.isFinite(Date.parse(request.expectedDeleteAfter || ""))) {
    throw new Error("AWS runtime delete requires --expected-delete-after with a valid timestamp");
  }

  if (request.operation !== "deploy" || runtimeRequest.runtimeKind !== "torii") {
    validatePinnedImageForMutation(request);
    return;
  }

  if (!runtimeRequest.rpcUrl) {
    throw new Error("Torii AWS runtime deploy requires --rpc-url");
  }

  if (!runtimeRequest.worldAddress) {
    throw new Error("Torii AWS runtime deploy requires --world-address");
  }

  validatePinnedImageForMutation(request);
}

function validatePinnedImageForMutation(request: AwsRuntimeCliRequest): void {
  if (request.operation === "inspect" || request.operation === "delete") {
    return;
  }

  if (!/^sha256:[a-f0-9]{64}$/.test(request.imageDigest || "")) {
    throw new Error("AWS runtime mutation requires --image-digest sha256:<64 lowercase hex>");
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
    runtimeInstanceId: request.runtimeInstanceId,
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

  if (result.operation !== "inspect") {
    requireRuntimeInstanceId(result.runtimeInstanceId);
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
    runtimeInstanceId: request?.runtimeInstanceId,
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
