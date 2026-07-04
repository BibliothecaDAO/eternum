#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

const validEnvironments = new Set(["slot.blitz", "slot.eternum", "mainnet.blitz", "mainnet.eternum"]);
const validRuntimeKinds = new Set(["katana", "torii"]);

function main() {
  const startedAt = new Date().toISOString();

  try {
    const request = resolveAuditRequest(parseArgs(process.argv.slice(2)));
    const audit = runResourceAudit(request);
    const orphanCount = audit.resources.length;

    printJson({
      operation: "aws-runtime-resource-audit",
      status: orphanCount === 0 ? "passed" : "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      environmentId: request.environmentId,
      runtimeKind: request.runtimeKind,
      runtimeName: request.runtimeName,
      serviceName: request.serviceName,
      filters: audit.filters,
      resourceCount: orphanCount,
      resources: audit.resources,
      ...(orphanCount > 0
        ? {
            failureClassification: "runtime-orphans-detected",
            errorMessage: `Found ${orphanCount} runtime-tagged AWS resource(s) after delete`,
          }
        : {}),
    });

    if (orphanCount > 0) {
      process.exitCode = 1;
    }
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

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new ValidationError(`Missing value for ${arg}`);
    }

    parsed[toCamelCase(arg.slice(2))] = value;
    index += 1;
  }

  return parsed;
}

function resolveAuditRequest(args) {
  const request = {
    environmentId: resolveInput(args.environment, "AWS_RUNTIME_AUDIT_ENVIRONMENT"),
    runtimeName: resolveInput(args.runtimeName, "AWS_RUNTIME_AUDIT_RUNTIME_NAME"),
    runtimeKind: resolveInput(args.runtimeKind, "AWS_RUNTIME_AUDIT_RUNTIME_KIND"),
    region: resolveInput(args.region, "AWS_REGION") || resolveInput("", "AWS_DEFAULT_REGION"),
  };

  validateAuditRequest(request);

  return {
    ...request,
    serviceName: buildAwsRuntimeServiceName(request),
  };
}

function validateAuditRequest(request) {
  const missingInputs = [
    ["AWS_RUNTIME_AUDIT_ENVIRONMENT", request.environmentId],
    ["AWS_RUNTIME_AUDIT_RUNTIME_NAME", request.runtimeName],
    ["AWS_RUNTIME_AUDIT_RUNTIME_KIND", request.runtimeKind],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingInputs.length > 0) {
    throw new ValidationError(`Missing required AWS runtime audit inputs: ${missingInputs.join(", ")}`);
  }

  if (!validEnvironments.has(request.environmentId)) {
    throw new ValidationError(`Invalid AWS_RUNTIME_AUDIT_ENVIRONMENT: ${request.environmentId}`);
  }

  if (!validRuntimeKinds.has(request.runtimeKind)) {
    throw new ValidationError(`Invalid AWS_RUNTIME_AUDIT_RUNTIME_KIND: ${request.runtimeKind}`);
  }
}

function runResourceAudit(request) {
  const filters = buildRuntimeTagFilters(request);
  return {
    filters,
    resources: collectTaggedResources(request, filters),
  };
}

function collectTaggedResources(request, filters) {
  const resources = [];
  let paginationToken = "";

  do {
    const payload = runGetResourcesPage(request, filters, paginationToken);
    resources.push(...normalizeTaggedResources(payload.ResourceTagMappingList));
    paginationToken = typeof payload.PaginationToken === "string" ? payload.PaginationToken : "";
  } while (paginationToken);

  return resources.sort((left, right) => left.arn.localeCompare(right.arn));
}

function runGetResourcesPage(request, filters, paginationToken) {
  const command = buildGetResourcesCommand(request, filters, paginationToken);
  const result = spawnSync("aws", command, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error || (result.status ?? 1) !== 0) {
    throw new AwsCommandError(command, result);
  }

  return parseJsonOutput(result.stdout);
}

function buildGetResourcesCommand(request, filters, paginationToken) {
  const command = [
    "resourcegroupstaggingapi",
    "get-resources",
    "--tag-filters",
    ...filters.map((filter) => `Key=${filter.key},Values=${filter.value}`),
    "--output",
    "json",
  ];
  if (request.region) {
    command.push("--region", request.region);
  }
  if (paginationToken) {
    command.push("--pagination-token", paginationToken);
  }

  return command;
}

function buildRuntimeTagFilters(request) {
  return [
    { key: "Project", value: "eternum" },
    { key: "Environment", value: request.environmentId },
    { key: "RuntimeKind", value: request.runtimeKind },
    { key: "RuntimeName", value: request.runtimeName },
    { key: "RuntimeServiceName", value: request.serviceName },
  ];
}

function normalizeTaggedResources(resources) {
  if (!Array.isArray(resources)) {
    return [];
  }

  return resources
    .map((resource) => ({
      arn: typeof resource.ResourceARN === "string" ? resource.ResourceARN : "",
      tags: normalizeTags(resource.Tags),
    }))
    .filter((resource) => resource.arn);
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return {};
  }

  return Object.fromEntries(
    tags
      .filter((tag) => typeof tag.Key === "string")
      .map((tag) => [tag.Key, typeof tag.Value === "string" ? tag.Value : ""]),
  );
}

function buildFailureResult(error, startedAt) {
  return {
    operation: "aws-runtime-resource-audit",
    status: "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
    failureClassification: classifyError(error),
    errorMessage: error instanceof Error ? error.message : String(error),
    ...(error instanceof AwsCommandError ? { command: error.command, commandOutput: error.commandOutput } : {}),
  };
}

function classifyError(error) {
  if (error instanceof ValidationError) {
    return "runtime-validation";
  }

  if (error instanceof AwsCommandError) {
    return "aws-command-failed";
  }

  return "unknown";
}

function parseJsonOutput(output) {
  const normalizedOutput = `${output || ""}`.trim();
  return normalizedOutput ? JSON.parse(normalizedOutput) : {};
}

function buildAwsRuntimeServiceName(options) {
  return truncateWithCleanSuffix(
    [
      normalizeRuntimeSegment(options.environmentId),
      normalizeRuntimeSegment(options.runtimeKind),
      normalizeRuntimeSegment(options.runtimeName),
    ]
      .filter(Boolean)
      .join("-"),
    63,
  );
}

function normalizeRuntimeSegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function truncateWithCleanSuffix(value, maxLength) {
  return value.length <= maxLength ? value : value.slice(0, maxLength).replace(/-+$/g, "");
}

function resolveInput(argValue, envName) {
  return argValue || process.env[envName]?.trim() || "";
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

class ValidationError extends Error {}

class AwsCommandError extends Error {
  constructor(command, result) {
    const output = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    super(output ? `AWS runtime resource audit failed: ${output}` : "AWS runtime resource audit failed");
    this.command = ["aws", ...command];
    this.commandOutput = output;
  }
}

main();
