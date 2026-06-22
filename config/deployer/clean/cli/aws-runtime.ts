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
  type AwsRuntimeKind,
  type AwsRuntimeLiveState,
} from "../runtime/aws-runtime";
import type { DeploymentEnvironmentId, IndexerTier } from "../types";
import { parseArgs } from "./args";

type AwsRuntimeOperation = "deploy" | "inspect" | "resize" | "delete";

interface AwsRuntimeCliRequest {
  operation: AwsRuntimeOperation;
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  tier?: IndexerTier;
  rpcUrl?: string;
  worldAddress?: string;
  namespaces?: string;
  externalContracts?: string[];
  version?: string;
}

interface AwsRuntimeCliResult {
  operation: AwsRuntimeOperation;
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  action?: AwsRuntimeActionResult["action"];
  mode?: AwsRuntimeActionResult["mode"];
  requestedTier?: IndexerTier;
  liveState: AwsRuntimeLiveState;
  artifact: ReturnType<typeof toAwsRuntimeArtifact>;
}

interface AwsRuntimeCliFailureResult {
  operation?: AwsRuntimeOperation;
  environmentId?: DeploymentEnvironmentId;
  runtimeKind?: AwsRuntimeKind;
  runtimeName?: string;
  failureClassification: ReturnType<typeof classifyAwsRuntimeFailure>;
  errorMessage: string;
  failedAt: string;
}

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
      "  --namespaces <comma-separated namespaces>",
      "  --external-contracts <newline-or-comma-separated contracts>",
      "  --version <dojo runtime version>",
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
    namespaces: args.namespaces,
    externalContracts: parseExternalContracts(args["external-contracts"] || args["torii-external-contracts"]),
    version: args.version,
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
    namespaces: request.namespaces,
    externalContracts: request.externalContracts,
    version: request.version,
    domain: environment.runtimeDomain,
  };
}

function validateRuntimeOperationRequest(request: AwsRuntimeCliRequest): void {
  if (request.operation !== "deploy" || request.runtimeKind !== "torii") {
    return;
  }

  if (!request.rpcUrl) {
    throw new Error("Torii AWS runtime deploy requires --rpc-url");
  }

  if (!request.worldAddress) {
    throw new Error("Torii AWS runtime deploy requires --world-address");
  }
}

async function runAwsRuntimeOperation(request: AwsRuntimeCliRequest): Promise<AwsRuntimeCliResult> {
  validateRuntimeOperationRequest(request);
  const runtimeRequest = buildRuntimeRequest(request);

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
  };
}

function writeJsonResult(result: AwsRuntimeCliResult | AwsRuntimeCliFailureResult): void {
  const json = `${JSON.stringify(result, null, 2)}\n`;
  process.stdout.write(json);
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

function buildFailureResult(error: unknown, request?: AwsRuntimeCliRequest): AwsRuntimeCliFailureResult {
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
