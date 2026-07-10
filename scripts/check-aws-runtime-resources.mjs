#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const alarmSuffixes = ["unhealthy-hosts", "target-5xx", "running-tasks", "snapshot-failures", "snapshot-freshness"];

async function main() {
  const startedAt = new Date().toISOString();

  try {
    const request = resolveAuditRequest(parseArgs(process.argv.slice(2)));
    const audit = await waitForResourcesToDisappear(request);
    const status = audit.resources.length === 0 && audit.failures.length === 0 ? "passed" : "failed";

    printJson({
      operation: "aws-runtime-resource-audit",
      schemaVersion: 2,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      environmentId: request.environmentId,
      runtimeKind: request.runtimeKind,
      runtimeName: request.runtimeName,
      runtimeInstanceId: request.runtimeInstanceId,
      serviceName: request.serviceName,
      expectedSnapshotIntent: request.expectedSnapshotIntent,
      attempts: audit.attempts,
      checks: audit.checks,
      resourceCount: audit.resources.length,
      resources: audit.resources,
      failures: audit.failures,
      ...(status === "failed"
        ? {
            failureClassification: "runtime-orphans-detected",
            errorMessage: buildAuditFailureMessage(audit),
          }
        : {}),
    });

    if (status === "failed") {
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
    runtimeInstanceId: resolveInput(args.runtimeInstanceId, "AWS_RUNTIME_AUDIT_RUNTIME_INSTANCE_ID"),
    region: resolveInput(args.region, "AWS_REGION") || resolveInput("", "AWS_DEFAULT_REGION") || "us-east-1",
    cluster: resolveInput(args.cluster, "AWS_RUNTIME_CLUSTER") || "eternum-game-runtime",
    efsFileSystemId: resolveInput(args.efsFileSystemId, "AWS_RUNTIME_EFS_FILE_SYSTEM_ID"),
    controlTableName: resolveInput(args.controlTableName, "AWS_RUNTIME_CONTROL_TABLE_NAME"),
    registryUrl: resolveInput(args.registryUrl, "RUNTIME_REGISTRY_URL"),
    expectedSnapshotIntent:
      resolveInput(args.expectedSnapshotIntent, "AWS_RUNTIME_AUDIT_EXPECTED_SNAPSHOT_INTENT") || "deleted",
  };
  validateAuditRequest(request);

  const serviceName = buildAwsRuntimeServiceName(request);
  return {
    ...request,
    serviceName,
    targetGroupName: buildTargetGroupName(request),
    runtimeBasePath: `/x/${normalizeSegment(request.environmentId)}/${request.runtimeName}/${request.runtimeKind}`,
    listenerArns: resolveListenerArns(args.listenerArns),
  };
}

function validateAuditRequest(request) {
  const missingInputs = [
    ["AWS_RUNTIME_AUDIT_ENVIRONMENT", request.environmentId],
    ["AWS_RUNTIME_AUDIT_RUNTIME_NAME", request.runtimeName],
    ["AWS_RUNTIME_AUDIT_RUNTIME_KIND", request.runtimeKind],
    ["AWS_RUNTIME_AUDIT_RUNTIME_INSTANCE_ID", request.runtimeInstanceId],
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
  if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(request.runtimeName)) {
    throw new ValidationError(`Invalid AWS_RUNTIME_AUDIT_RUNTIME_NAME: ${request.runtimeName}`);
  }
  if (!new Set(["deleted", "retained"]).has(request.expectedSnapshotIntent)) {
    throw new ValidationError("Expected snapshot intent must be deleted or retained");
  }
}

async function waitForResourcesToDisappear(request) {
  const maxAttempts = readPositiveInteger("AWS_RUNTIME_AUDIT_ATTEMPTS", 6);
  const delayMs = readPositiveInteger("AWS_RUNTIME_AUDIT_DELAY_MS", 5_000);
  let audit;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    audit = runResourceChecks(request);
    if (audit.resources.length === 0 && audit.failures.length === 0) {
      return { ...audit, attempts: attempt };
    }
    if (attempt < maxAttempts) {
      await delay(delayMs);
    }
  }
  return { ...audit, attempts: maxAttempts };
}

function runResourceChecks(request) {
  const results = [
    checkEcsService(request),
    checkTaskDefinitions(request),
    checkTargetGroup(request),
    checkListenerRules(request),
    checkAccessPoints(request),
    checkAlarms(request),
    checkDeletionAudit(request),
    checkRuntimeRegistry(request),
  ];
  return {
    checks: results.map(({ resources: _resources, failure: _failure, ...result }) => result),
    resources: results.flatMap((result) => result.resources),
    failures: results.flatMap((result) => (result.failure ? [result.failure] : [])),
  };
}

function checkEcsService(request) {
  return runCheck("ecs-service", () => {
    const payload = runAwsJson(request, [
      "ecs",
      "describe-services",
      "--cluster",
      request.cluster,
      "--services",
      request.serviceName,
    ]);
    const services = Array.isArray(payload.services) ? payload.services : [];
    return services
      .filter((service) => service.status !== "INACTIVE")
      .map((service) => resource("ecs-service", service.serviceArn || request.serviceName));
  });
}

function checkTaskDefinitions(request) {
  return runCheck("task-definitions", () => {
    const definitions = ["ACTIVE", "INACTIVE"].flatMap((status) => {
      const payload = runAwsJson(request, [
        "ecs",
        "list-task-definitions",
        "--family-prefix",
        request.serviceName,
        "--status",
        status,
      ]);
      return Array.isArray(payload.taskDefinitionArns) ? payload.taskDefinitionArns : [];
    });
    return definitions
      .filter((arn) => taskDefinitionFamily(arn) === request.serviceName)
      .map((arn) => resource("task-definition", arn));
  });
}

function checkTargetGroup(request) {
  return runCheck("target-group", () => {
    const payload = runAwsJson(
      request,
      ["elbv2", "describe-target-groups", "--names", request.targetGroupName],
      ["TargetGroupNotFound"],
    );
    return (payload.TargetGroups || []).map((group) =>
      resource("target-group", group.TargetGroupArn || request.targetGroupName),
    );
  });
}

function checkListenerRules(request) {
  return runCheck("listener-rules", () =>
    request.listenerArns.flatMap((listenerArn) => {
      const payload = runAwsJson(request, ["elbv2", "describe-rules", "--listener-arn", listenerArn]);
      return (payload.Rules || [])
        .filter((rule) => listenerRuleMatchesPath(rule, request.runtimeBasePath))
        .map((rule) => resource("listener-rule", rule.RuleArn || listenerArn));
    }),
  );
}

function checkAccessPoints(request) {
  if (!request.efsFileSystemId) {
    return skippedCheck("efs-access-points", "AWS_RUNTIME_EFS_FILE_SYSTEM_ID is not configured");
  }
  return runCheck("efs-access-points", () => {
    const payload = runAwsJson(request, ["efs", "describe-access-points", "--file-system-id", request.efsFileSystemId]);
    return (payload.AccessPoints || [])
      .filter((accessPoint) => accessPointBelongsToRuntime(accessPoint, request))
      .map((accessPoint) => resource("efs-access-point", accessPoint.AccessPointArn || accessPoint.AccessPointId));
  });
}

function checkAlarms(request) {
  return runCheck("cloudwatch-alarms", () => {
    const payload = runAwsJson(request, [
      "cloudwatch",
      "describe-alarms",
      "--alarm-name-prefix",
      `${request.serviceName}-`,
    ]);
    const expectedNames = new Set(alarmSuffixes.map((suffix) => `${request.serviceName}-${suffix}`));
    return (payload.MetricAlarms || [])
      .filter((alarm) => expectedNames.has(alarm.AlarmName))
      .map((alarm) => resource("cloudwatch-alarm", alarm.AlarmArn || alarm.AlarmName));
  });
}

function checkDeletionAudit(request) {
  if (!request.controlTableName) {
    return skippedCheck("snapshot-retention-intent", "AWS_RUNTIME_CONTROL_TABLE_NAME is not configured");
  }
  return runCheck("snapshot-retention-intent", () => {
    const controlKey = [
      "DELETE",
      request.environmentId,
      request.runtimeKind,
      request.runtimeName,
      request.runtimeInstanceId,
    ].join("#");
    const payload = runAwsJson(request, [
      "dynamodb",
      "get-item",
      "--table-name",
      request.controlTableName,
      "--key",
      JSON.stringify({ ControlKey: { S: controlKey } }),
      "--consistent-read",
    ]);
    const item = payload.Item;
    if (!item) {
      throw new AuditAssertionError("runtime deletion audit tombstone is missing");
    }
    if (item.RuntimeInstanceId?.S !== request.runtimeInstanceId) {
      throw new AuditAssertionError("runtime deletion audit instance ID does not match");
    }
    if (item.SnapshotRetentionIntent?.S !== request.expectedSnapshotIntent) {
      throw new AuditAssertionError(
        `snapshot retention intent is ${item.SnapshotRetentionIntent?.S || "missing"}, expected ${request.expectedSnapshotIntent}`,
      );
    }
    return [];
  });
}

function checkRuntimeRegistry(request) {
  if (!request.registryUrl) {
    return skippedCheck("runtime-registry", "RUNTIME_REGISTRY_URL is not configured");
  }
  return runCheck("runtime-registry", () => {
    const result = spawnSync("curl", ["--fail", "--silent", "--show-error", request.registryUrl], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.error || (result.status ?? 1) !== 0) {
      throw new Error(normalizeCommandOutput(result) || "runtime registry request failed");
    }
    const registry = JSON.parse(result.stdout || "{}");
    return Object.entries(registry.aliases || {})
      .filter(([, alias]) => alias.runtimeInstanceId === request.runtimeInstanceId && alias.providers?.aws)
      .map(([alias]) => resource("runtime-registry-record", alias));
  });
}

function runCheck(name, collectResources) {
  try {
    const resources = collectResources();
    return { name, status: resources.length === 0 ? "passed" : "orphaned", resources };
  } catch (error) {
    return {
      name,
      status: "failed",
      resources: [],
      failure: `${name}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function skippedCheck(name, reason) {
  return { name, status: "skipped", reason, resources: [] };
}

function runAwsJson(request, args, allowedErrorPatterns = []) {
  const command = [...args, "--region", request.region, "--output", "json"];
  const result = spawnSync("aws", command, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error || (result.status ?? 1) !== 0) {
    const output = normalizeCommandOutput(result);
    if (allowedErrorPatterns.some((pattern) => output.includes(pattern))) {
      return {};
    }
    throw new AwsCommandError(command, output);
  }
  return result.stdout?.trim() ? JSON.parse(result.stdout) : {};
}

function resolveListenerArns(argValue) {
  const value = argValue || process.env.AWS_RUNTIME_ALB_LISTENER_ARNS || process.env.AWS_RUNTIME_ALB_LISTENER_ARN || "";
  if (!value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // Comma-separated values are accepted for local audits.
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function listenerRuleMatchesPath(rule, runtimeBasePath) {
  return (rule.Conditions || []).some(
    (condition) =>
      condition.Field === "path-pattern" &&
      (condition.Values || []).some((value) => value === runtimeBasePath || value === `${runtimeBasePath}/*`),
  );
}

function accessPointBelongsToRuntime(accessPoint, request) {
  if (accessPoint.RootDirectory?.Path === `/runtimes/${request.serviceName}`) {
    return true;
  }
  const tags = Object.fromEntries((accessPoint.Tags || []).map((tag) => [tag.Key, tag.Value]));
  return tags.RuntimeInstanceId === request.runtimeInstanceId || tags.RuntimeServiceName === request.serviceName;
}

function taskDefinitionFamily(arn) {
  return String(arn).split("/").pop().split(":")[0];
}

function resource(type, id) {
  return { type, id: String(id || "unknown") };
}

function buildAwsRuntimeServiceName(request) {
  const prefix = `${normalizeSegment(request.environmentId)}-${normalizeSegment(request.runtimeKind)}`;
  const hash = buildRuntimeResourceHash(request);
  const runtimeNameLength = 63 - prefix.length - hash.length - 2;
  return `${prefix}-${request.runtimeName.slice(0, runtimeNameLength).replace(/-+$/g, "")}-${hash}`;
}

function buildTargetGroupName(request) {
  const hash = buildRuntimeResourceHash(request);
  const prefix = `${request.runtimeKind}-${request.runtimeName}`;
  const readablePrefix = prefix.slice(0, 32 - hash.length - 1).replace(/-+$/g, "");
  return `${readablePrefix}-${hash}`;
}

function buildRuntimeResourceHash(request) {
  return createHash("sha256")
    .update([request.environmentId, request.runtimeKind, request.runtimeName, request.runtimeInstanceId].join("\0"))
    .digest("hex")
    .slice(0, 16);
}

function normalizeSegment(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildAuditFailureMessage(audit) {
  const parts = [];
  if (audit.resources.length > 0) {
    parts.push(`found ${audit.resources.length} runtime resource(s)`);
  }
  if (audit.failures.length > 0) {
    parts.push(`${audit.failures.length} audit check(s) failed`);
  }
  return parts.join(" and ");
}

function buildFailureResult(error, startedAt) {
  return {
    operation: "aws-runtime-resource-audit",
    schemaVersion: 2,
    status: "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
    failureClassification: error instanceof ValidationError ? "runtime-validation" : "aws-command-failed",
    errorMessage: error instanceof Error ? error.message : String(error),
  };
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function resolveInput(argValue, envName) {
  return argValue || process.env[envName]?.trim() || "";
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function normalizeCommandOutput(result) {
  return [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

class ValidationError extends Error {}
class AuditAssertionError extends Error {}
class AwsCommandError extends Error {
  constructor(command, output) {
    super(output ? `AWS command failed: ${output}` : "AWS command failed");
    this.command = ["aws", ...command];
  }
}

await main();
