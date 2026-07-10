#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";

const validEnvironments = new Set([
  "slot.blitz",
  "slot.eternum",
  "slottest.blitz",
  "slottest.eternum",
  "mainnet.blitz",
  "mainnet.eternum",
]);
const validRuntimeKinds = new Set(["katana", "torii"]);

function main() {
  const startedAt = new Date().toISOString();
  const args = parseArgs(process.argv.slice(2));

  try {
    const request = resolveE2eRequest(args, args.dryRun);
    const steps = buildE2eSteps(request);

    if (args.dryRun) {
      printJson({
        operation: "aws-runtime-e2e",
        status: "planned",
        startedAt,
        finishedAt: new Date().toISOString(),
        environmentId: request.environmentId,
        runtimeKind: request.runtimeKind,
        runtimeName: request.runtimeName,
        steps: steps.map(({ name, command }) => ({ name, command })),
      });
      return;
    }

    const results = runE2eSteps(steps);
    printJson({
      operation: "aws-runtime-e2e",
      status: "passed",
      startedAt,
      finishedAt: new Date().toISOString(),
      environmentId: request.environmentId,
      runtimeKind: request.runtimeKind,
      runtimeName: request.runtimeName,
      results,
    });
  } catch (error) {
    printJson(buildFailureResult(error, startedAt));
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new ValidationError(`Unexpected positional argument: ${arg}`);
    }

    const name = toCamelCase(arg.slice(2));
    if (name === "dryRun") {
      parsed.dryRun = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ValidationError(`Missing value for ${arg}`);
    }

    parsed[name] = value;
    index += 1;
  }

  return parsed;
}

function resolveE2eRequest(args, dryRun) {
  const request = {
    environmentId: resolveInput(args.environment, "AWS_RUNTIME_E2E_ENVIRONMENT"),
    runtimeName: resolveInput(args.runtimeName, "AWS_RUNTIME_E2E_RUNTIME_NAME"),
    runtimeKind: resolveInput(args.runtimeKind, "AWS_RUNTIME_E2E_RUNTIME_KIND"),
    domain: resolveInput(args.domain, "AWS_RUNTIME_E2E_DOMAIN"),
    tier: resolveInput(args.tier, "AWS_RUNTIME_E2E_TIER") || "basic",
    resizeTier: resolveInput(args.resizeTier, "AWS_RUNTIME_E2E_RESIZE_TIER") || "pro",
    version: resolveInput(args.version, "AWS_RUNTIME_E2E_VERSION"),
    imageDigest: resolveInput(args.imageDigest, "AWS_RUNTIME_E2E_IMAGE_DIGEST"),
    runtimeInstanceId: resolveInput(args.runtimeInstanceId, "AWS_RUNTIME_E2E_RUNTIME_INSTANCE_ID") || randomUUID(),
    rpcUrl: resolveInput(args.rpcUrl, "AWS_RUNTIME_E2E_RPC_URL"),
    worldAddress: resolveInput(args.worldAddress, "AWS_RUNTIME_E2E_WORLD_ADDRESS"),
  };

  validateE2eRequest(request, dryRun);
  return request;
}

function resolveInput(argValue, envName) {
  return argValue || process.env[envName]?.trim() || "";
}

function validateE2eRequest(request, dryRun) {
  const missingInputs = [
    ["AWS_RUNTIME_E2E_ENVIRONMENT", request.environmentId],
    ["AWS_RUNTIME_E2E_RUNTIME_NAME", request.runtimeName],
    ["AWS_RUNTIME_E2E_RUNTIME_KIND", request.runtimeKind],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingInputs.length > 0) {
    throw new ValidationError(`Missing required AWS runtime e2e inputs: ${missingInputs.join(", ")}`);
  }

  if (!validEnvironments.has(request.environmentId)) {
    throw new ValidationError(`Invalid AWS_RUNTIME_E2E_ENVIRONMENT: ${request.environmentId}`);
  }

  if (!validRuntimeKinds.has(request.runtimeKind)) {
    throw new ValidationError(`Invalid AWS_RUNTIME_E2E_RUNTIME_KIND: ${request.runtimeKind}`);
  }

  if (request.runtimeKind === "torii") {
    const missingToriiInputs = [
      ["AWS_RUNTIME_E2E_RPC_URL", request.rpcUrl],
      ["AWS_RUNTIME_E2E_WORLD_ADDRESS", request.worldAddress],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missingToriiInputs.length > 0) {
      throw new ValidationError(`Missing required Torii e2e inputs: ${missingToriiInputs.join(", ")}`);
    }
  }

  if (!dryRun && !/^sha256:[a-f0-9]{64}$/.test(request.imageDigest)) {
    throw new ValidationError("AWS_RUNTIME_E2E_IMAGE_DIGEST must be an immutable sha256 digest");
  }
}

function buildE2eSteps(request) {
  return [
    ...buildStaticGuardSteps(),
    buildConcurrentAwsRuntimeDeployStep(request),
    buildAwsRuntimeStep("inspect", request),
    buildCheckpointUpdateStep(request),
    buildAwsRuntimeStep("inspect-after-resize", request, { operation: "inspect" }),
    buildForcedCrashStep(request),
    buildAwsRuntimeStep("inspect-after-forced-crash", request, { operation: "inspect" }),
    buildAwsRuntimeStep("delete-retain-data", request, { operation: "delete", retainData: true }),
    buildAwsRuntimeStep("deploy-retained-data", request, { operation: "deploy", tier: request.tier }),
    buildAwsRuntimeStep("inspect-retained-data", request, { operation: "inspect" }),
    buildAwsRuntimeStep("delete", request),
    buildResourceAuditStep("resource-audit-after-delete", request),
    buildAwsRuntimeStep("deploy-recreate", request, { operation: "deploy", tier: request.tier }),
    buildAwsRuntimeStep("inspect-recreate", request, { operation: "inspect" }),
    buildAwsRuntimeStep("delete-recreate", request, { operation: "delete" }),
    buildResourceAuditStep("resource-audit-after-recreate-delete", request),
  ];
}

function buildStaticGuardSteps() {
  return [
    buildShellStep("workflow-guard", ["pnpm", "run", "check:aws-runtime-workflows"]),
    buildShellStep("provider-guard", ["pnpm", "run", "check:aws-runtime-provider"]),
    buildShellStep("terraform-guard", ["pnpm", "run", "check:aws-runtime-terraform"]),
    buildShellStep("readme-guard", ["pnpm", "run", "check:aws-runtime-readme"]),
    buildShellStep("url-guard", ["pnpm", "run", "check:aws-runtime-urls"]),
    buildShellStep("iam-policy-guard", ["pnpm", "run", "check:aws-runtime-iam"]),
  ];
}

function buildShellStep(name, command) {
  return { name, command };
}

function buildAwsRuntimeStep(name, request, overrides = {}) {
  const operation = overrides.operation || name;
  const command = [
    "bun",
    "config/deployer/clean/cli/aws-runtime.ts",
    "--operation",
    operation,
    "--environment",
    request.environmentId,
    "--runtime-kind",
    request.runtimeKind,
    "--runtime-name",
    request.runtimeName,
    "--runtime-instance-id",
    request.runtimeInstanceId,
  ];

  appendOptionalFlag(command, "--domain", request.domain);
  appendOptionalFlag(command, "--tier", overrides.tier);
  appendOptionalFlag(command, "--version", request.version);
  appendOptionalFlag(command, "--image-digest", request.imageDigest);
  appendOptionalFlag(command, "--rpc-url", request.rpcUrl);
  appendOptionalFlag(command, "--world-address", request.worldAddress);
  appendOptionalFlag(command, "--retain-data", overrides.retainData ? "true" : "");

  return { name, command };
}

function buildForcedCrashStep(request) {
  return buildShellStep("forced-crash", [
    "node",
    "scripts/aws-runtime-forced-crash.mjs",
    "--environment",
    request.environmentId,
    "--runtime-kind",
    request.runtimeKind,
    "--runtime-name",
    request.runtimeName,
    "--runtime-instance-id",
    request.runtimeInstanceId,
  ]);
}

function buildCheckpointUpdateStep(request) {
  return buildShellStep("checkpoint-update", [
    "node",
    "scripts/aws-runtime-forced-crash.mjs",
    "--test-mode",
    "checkpoint-update",
    "--environment",
    request.environmentId,
    "--runtime-kind",
    request.runtimeKind,
    "--runtime-name",
    request.runtimeName,
    "--runtime-instance-id",
    request.runtimeInstanceId,
    "--resize-tier",
    request.resizeTier,
    "--image-digest",
    request.imageDigest,
  ]);
}

function buildConcurrentAwsRuntimeDeployStep(request) {
  const deploy = buildAwsRuntimeStep("deploy", request, { tier: request.tier }).command;
  return buildShellStep("concurrent-deploy", ["sh", "-c", buildConcurrentShellCommand(deploy, deploy)]);
}

function buildConcurrentShellCommand(leftCommand, rightCommand) {
  return [
    'left_output="$(mktemp)"',
    'right_output="$(mktemp)"',
    `${shellQuoteCommand(leftCommand)} >"\${left_output}" & left_pid=$!`,
    `${shellQuoteCommand(rightCommand)} >"\${right_output}" & right_pid=$!`,
    'wait "${left_pid}"; left_status=$?',
    'wait "${right_pid}"; right_status=$?',
    'cat "${left_output}"',
    'cat "${right_output}"',
    'rm -f "${left_output}" "${right_output}"',
    'if [ "${left_status}" -ne 0 ]; then exit "${left_status}"; fi',
    'exit "${right_status}"',
  ].join("; ");
}

function shellQuoteCommand(command) {
  return command.map(shellQuote).join(" ");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\"'\"'")}'`;
}

function buildResourceAuditStep(name, request) {
  const command = [
    "pnpm",
    "run",
    "check:aws-runtime-resources",
    "--",
    "--environment",
    request.environmentId,
    "--runtime-kind",
    request.runtimeKind,
    "--runtime-name",
    request.runtimeName,
    "--runtime-instance-id",
    request.runtimeInstanceId,
    "--expected-snapshot-intent",
    "deleted",
  ];

  appendOptionalFlag(command, "--region", request.region);

  return { name, command };
}

function appendOptionalFlag(command, flag, value) {
  if (!value) {
    return;
  }

  command.push(flag, value);
}

function runE2eSteps(steps) {
  const results = [];

  for (const step of steps) {
    const startedAt = new Date().toISOString();
    const result = spawnSync(step.command[0], step.command.slice(1), {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    const finishedAt = new Date().toISOString();
    const stepResult = {
      name: step.name,
      command: step.command,
      status: result.status ?? 1,
      startedAt,
      finishedAt,
      stdout: normalizeOutput(result.stdout),
      stderr: normalizeOutput(result.stderr),
    };
    validateE2eStepResult(stepResult);
    results.push(stepResult);

    if (result.error || stepResult.status !== 0) {
      throw new StepFailureError(stepResult, result.error);
    }
  }

  return results;
}

function validateE2eStepResult(stepResult) {
  if (stepResult.status !== 0) {
    return;
  }

  if (isAwsRuntimeCliStep(stepResult)) {
    requireAwsRuntimeCliEvidence(stepResult);
  }

  if (isResourceAuditStep(stepResult)) {
    requireResourceAuditEvidence(stepResult);
  }

  if (stepResult.name === "inspect-retained-data") {
    requireRestoredSnapshot(stepResult);
  }

  if (stepResult.name === "inspect-recreate") {
    requireFreshRecreate(stepResult);
  }
}

function isAwsRuntimeCliStep(stepResult) {
  return commandContains(stepResult.command, "config/deployer/clean/cli/aws-runtime.ts");
}

function isResourceAuditStep(stepResult) {
  return stepResult.name.startsWith("resource-audit");
}

function requireAwsRuntimeCliEvidence(stepResult) {
  const payloads = parseJsonDocuments(stepResult.stdout, stepResult.name);
  if (stepResult.name === "concurrent-deploy" && payloads.length < 2) {
    throw new ValidationError(`${stepResult.name} did not emit both deploy JSON stdout documents`);
  }

  const expectedOperation = resolveExpectedRuntimeOperation(stepResult);
  for (const payload of payloads) {
    if (payload.operation !== expectedOperation) {
      throw new ValidationError(
        `${stepResult.name} emitted operation "${payload.operation || ""}" instead of "${expectedOperation}"`,
      );
    }
  }
}

function requireResourceAuditEvidence(stepResult) {
  const payloads = parseJsonDocuments(stepResult.stdout, stepResult.name);
  if (payloads.length !== 1) {
    throw new ValidationError(`${stepResult.name} did not emit exactly one JSON stdout document`);
  }

  const [payload] = payloads;
  if (payload.operation !== "aws-runtime-resource-audit" || payload.status !== "passed") {
    throw new ValidationError(`${stepResult.name} did not emit a passed resource audit result`);
  }
}

function resolveExpectedRuntimeOperation(stepResult) {
  const operationFlagIndex = stepResult.command.indexOf("--operation");
  if (operationFlagIndex >= 0) {
    return stepResult.command[operationFlagIndex + 1] || "";
  }

  if (stepResult.name === "concurrent-deploy") {
    return "deploy";
  }

  return stepResult.name;
}

function requireRestoredSnapshot(stepResult) {
  if (readRestoredSnapshot(stepResult)) {
    return;
  }

  throw new ValidationError(`${stepResult.name} did not report restoredFromSnapshot after retained-data recreate`);
}

function requireFreshRecreate(stepResult) {
  const restoredFromSnapshot = readRestoredSnapshot(stepResult);
  if (!restoredFromSnapshot) {
    return;
  }

  throw new ValidationError(
    `${stepResult.name} unexpectedly reported restoredFromSnapshot=${restoredFromSnapshot} after default delete`,
  );
}

function readRestoredSnapshot(stepResult) {
  const payload = parseJsonOutput(stepResult.stdout, stepResult.name);
  const restoredFromSnapshot = payload.restoredFromSnapshot || payload.liveState?.restoredFromSnapshot;
  return typeof restoredFromSnapshot === "string" && restoredFromSnapshot ? restoredFromSnapshot : "";
}

function parseJsonOutput(output, stepName) {
  const payloads = parseJsonDocuments(output, stepName);
  if (payloads.length !== 1) {
    throw new ValidationError(`${stepName} did not emit exactly one JSON stdout document`);
  }

  return payloads[0];
}

function parseJsonDocuments(output, stepName) {
  const normalizedOutput = normalizeOutput(output);
  if (!normalizedOutput) {
    throw new ValidationError(`${stepName} did not emit valid JSON stdout`);
  }

  try {
    return [JSON.parse(normalizedOutput)];
  } catch {
    return parseConcatenatedJsonDocuments(normalizedOutput, stepName);
  }
}

function parseConcatenatedJsonDocuments(output, stepName) {
  const documents = [];
  let cursor = skipWhitespace(output, 0);

  while (cursor < output.length) {
    const endIndex = findJsonDocumentEnd(output, cursor);
    if (endIndex < 0) {
      throw new ValidationError(`${stepName} did not emit valid JSON stdout`);
    }

    try {
      documents.push(JSON.parse(output.slice(cursor, endIndex)));
    } catch {
      throw new ValidationError(`${stepName} did not emit valid JSON stdout`);
    }
    cursor = skipWhitespace(output, endIndex);
  }

  return documents;
}

function commandContains(command, fragment) {
  return command.some((part) => part.includes(fragment));
}

function findJsonDocumentEnd(output, startIndex) {
  if (output[startIndex] !== "{") {
    return -1;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < output.length; index += 1) {
    const character = output[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = inString;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return -1;
}

function skipWhitespace(output, startIndex) {
  let index = startIndex;
  while (index < output.length && /\s/.test(output[index])) {
    index += 1;
  }
  return index;
}

function buildFailureResult(error, startedAt) {
  const failure = {
    operation: "aws-runtime-e2e",
    status: "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
    failureClassification: classifyError(error),
    errorMessage: error instanceof Error ? error.message : String(error),
  };

  if (error instanceof StepFailureError) {
    failure.failedStep = error.stepResult;
  }

  return failure;
}

function classifyError(error) {
  if (error instanceof ValidationError) {
    return "runtime-validation";
  }

  if (error instanceof StepFailureError) {
    return "aws-runtime-e2e-step-failed";
  }

  return "unknown";
}

function normalizeOutput(output) {
  return `${output || ""}`.trim();
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

class ValidationError extends Error {}

class StepFailureError extends Error {
  constructor(stepResult, cause) {
    super(
      cause
        ? `AWS runtime e2e step "${stepResult.name}" failed: ${cause.message}`
        : `AWS runtime e2e step "${stepResult.name}" exited with status ${stepResult.status}`,
    );
    this.stepResult = stepResult;
  }
}

main();
