#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import process from "node:process";

const MAX_RPO_SECONDS = 5 * 60;
const MAX_RTO_SECONDS = 30 * 60;
const CHECKPOINT_CONTAINER_NAME = "runtime-checkpoint";

async function main() {
  const startedAt = new Date().toISOString();
  try {
    const request = resolveRequest(parseArgs(process.argv.slice(2)));
    if (request.testMode === "checkpoint-update") {
      const result = await verifyCheckpointedUpdate(request);
      printJson({
        schemaVersion: 1,
        operation: "aws-runtime-checkpoint-update",
        status: "passed",
        startedAt,
        finishedAt: new Date().toISOString(),
        ...result,
      });
      return;
    }
    const originalTaskArn = resolveRunningTask(request);
    let recoverableMarkerAt = new Date().toISOString();
    const markerDeadline = Date.now() + (request.snapshotIntervalSeconds + 30) * 1000;
    while (Date.now() < markerDeadline) {
      recoverableMarkerAt = new Date().toISOString();
      writeRuntimeMarker(request, originalTaskArn, recoverableMarkerAt);
      await delay(Math.min(30_000, Math.max(1, markerDeadline - Date.now())));
    }

    const latestUncheckpointedMarkerAt = new Date().toISOString();
    writeRuntimeMarker(request, originalTaskArn, latestUncheckpointedMarkerAt);
    const crashedAt = new Date().toISOString();
    killRuntimePidOne(request, originalTaskArn);

    const replacement = await waitForReplacementTask(request, originalTaskArn, Date.parse(crashedAt));
    const restoredMarkerAt = readRuntimeMarker(request, replacement.taskArn);
    const rpoSeconds = Math.max(0, Math.floor((Date.parse(crashedAt) - Date.parse(restoredMarkerAt)) / 1000));
    const rtoSeconds = Math.max(0, Math.floor((replacement.healthyAtMs - Date.parse(crashedAt)) / 1000));
    const status = rpoSeconds <= MAX_RPO_SECONDS && rtoSeconds <= MAX_RTO_SECONDS ? "passed" : "failed";

    printJson({
      schemaVersion: 1,
      operation: "aws-runtime-forced-crash",
      status,
      environmentId: request.environmentId,
      runtimeKind: request.runtimeKind,
      runtimeName: request.runtimeName,
      runtimeInstanceId: request.runtimeInstanceId,
      originalTaskArn,
      replacementTaskArn: replacement.taskArn,
      recoverableMarkerAt,
      latestUncheckpointedMarkerAt,
      restoredMarkerAt,
      crashedAt,
      recoveredAt: new Date(replacement.healthyAtMs).toISOString(),
      rpoSeconds,
      rtoSeconds,
      rpoTargetSeconds: MAX_RPO_SECONDS,
      rtoTargetSeconds: MAX_RTO_SECONDS,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    if (status !== "passed") {
      process.exitCode = 1;
    }
  } catch (error) {
    printJson({
      schemaVersion: 1,
      operation: "aws-runtime-forced-crash",
      status: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

function resolveRequest(args) {
  const request = {
    environmentId: requireValue(args.environment, "--environment"),
    runtimeKind: requireValue(args["runtime-kind"], "--runtime-kind"),
    runtimeName: requireValue(args["runtime-name"], "--runtime-name"),
    runtimeInstanceId: requireValue(args["runtime-instance-id"], "--runtime-instance-id"),
    endpoint: args.endpoint,
    region: args.region || process.env.AWS_REGION || "us-east-1",
    cluster: requireValue(process.env.AWS_RUNTIME_CLUSTER, "AWS_RUNTIME_CLUSTER"),
    container: CHECKPOINT_CONTAINER_NAME,
    snapshotIntervalSeconds: positiveInteger(
      args["snapshot-interval-seconds"] || process.env.AWS_RUNTIME_SNAPSHOT_INTERVAL_SECONDS,
      300,
    ),
    testMode: args["test-mode"] || "forced-crash",
    resizeTier: args["resize-tier"] || "pro",
    imageDigest: args["image-digest"],
  };
  if (!new Set(["katana", "torii"]).has(request.runtimeKind)) {
    throw new Error("--runtime-kind must be katana or torii");
  }
  request.endpoint ||= resolveRuntimeEndpoint(request);
  if (!/^https:\/\//.test(request.endpoint)) {
    throw new Error("--endpoint must be an HTTPS runtime base endpoint");
  }
  return request;
}

async function verifyCheckpointedUpdate(request) {
  if (!/^sha256:[a-f0-9]{64}$/.test(request.imageDigest || "")) {
    throw new Error("Checkpoint update validation requires --image-digest");
  }
  const originalTaskArn = resolveRunningTask(request);
  const markerAt = new Date().toISOString();
  writeRuntimeMarker(request, originalTaskArn, markerAt);
  const startedAtMs = Date.now();
  const result = spawnSync(
    "bun",
    [
      "config/deployer/clean/cli/aws-runtime.ts",
      "--operation",
      "resize",
      "--environment",
      request.environmentId,
      "--runtime-kind",
      request.runtimeKind,
      "--runtime-name",
      request.runtimeName,
      "--runtime-instance-id",
      request.runtimeInstanceId,
      "--image-digest",
      request.imageDigest,
      "--tier",
      request.resizeTier,
    ],
    { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 },
  );
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Checkpointed update failed: ${result.stderr || result.stdout}`);
  }
  const replacementTaskArn = resolveRunningTask(request);
  const restoredMarkerAt = readRuntimeMarker(request, replacementTaskArn);
  if (restoredMarkerAt !== markerAt) {
    throw new Error(`Checkpointed update lost state: wrote ${markerAt}, restored ${restoredMarkerAt}`);
  }
  return {
    environmentId: request.environmentId,
    runtimeKind: request.runtimeKind,
    runtimeName: request.runtimeName,
    runtimeInstanceId: request.runtimeInstanceId,
    originalTaskArn,
    replacementTaskArn,
    markerAt,
    restoredMarkerAt,
    dataLossSeconds: 0,
    updateRtoSeconds: Math.floor((Date.now() - startedAtMs) / 1000),
  };
}

function resolveRuntimeEndpoint(request) {
  const result = spawnSync(
    "bun",
    [
      "config/deployer/clean/cli/aws-runtime.ts",
      "--operation",
      "inspect",
      "--environment",
      request.environmentId,
      "--runtime-kind",
      request.runtimeKind,
      "--runtime-name",
      request.runtimeName,
      "--runtime-instance-id",
      request.runtimeInstanceId,
    ],
    { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 },
  );
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Unable to inspect runtime before forced crash: ${result.stderr || result.stdout}`);
  }
  const payload = JSON.parse(result.stdout);
  return payload.artifact?.endpointUrl;
}

function resolveRunningTask(request) {
  const payload = runAwsJson("list running runtime tasks", [
    "ecs",
    "list-tasks",
    "--region",
    request.region,
    "--cluster",
    request.cluster,
    "--service-name",
    buildServiceName(request),
    "--desired-status",
    "RUNNING",
    "--output",
    "json",
  ]);
  const taskArn = payload.taskArns?.[0];
  if (!taskArn) {
    throw new Error("Runtime service has no running task");
  }
  return taskArn;
}

function writeRuntimeMarker(request, taskArn, markerAt) {
  const markerPath = `/data/${request.runtimeKind}/forced-crash-marker.txt`;
  executeRuntimeCommand(request, taskArn, `sh -c 'printf marker:${markerAt} > ${markerPath}'`);
}

function readRuntimeMarker(request, taskArn) {
  const markerPath = `/data/${request.runtimeKind}/forced-crash-marker.txt`;
  const output = executeRuntimeCommand(request, taskArn, `cat ${markerPath}`);
  const markerAt = /marker:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/.exec(output)?.[1];
  if (!markerAt) {
    throw new Error("Replacement runtime did not restore the forced-crash marker");
  }
  return markerAt;
}

function killRuntimePidOne(request, taskArn) {
  const result = runAws(
    "kill runtime PID 1",
    buildExecuteCommandArgs(request, taskArn, "/usr/local/bin/checkpoint-agent.sh kill-runtime"),
    { allowFailure: true },
  );
  if ((result.status ?? 1) === 0 && !/session/i.test(`${result.stdout || ""}${result.stderr || ""}`)) {
    throw new Error("Forced crash command did not terminate the runtime session");
  }
}

async function waitForReplacementTask(request, originalTaskArn, crashedAtMs) {
  const deadline = crashedAtMs + MAX_RTO_SECONDS * 1000;
  let replacementTaskArn;
  while (Date.now() < deadline) {
    try {
      const taskArn = resolveRunningTask(request);
      if (taskArn !== originalTaskArn) {
        replacementTaskArn = taskArn;
        if (await endpointIsHealthy(request.endpoint)) {
          return { taskArn, healthyAtMs: Date.now() };
        }
      }
    } catch {
      // ECS replacement and target registration are eventually consistent.
    }
    await delay(10_000);
  }
  throw new Error(
    `Runtime did not recover within ${MAX_RTO_SECONDS}s${replacementTaskArn ? `; replacement ${replacementTaskArn} remained unhealthy` : ""}`,
  );
}

async function endpointIsHealthy(endpoint) {
  try {
    const response = await fetch(`${endpoint.replace(/\/+$/, "")}/health`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function executeRuntimeCommand(request, taskArn, command) {
  const result = runAws("execute runtime test command", buildExecuteCommandArgs(request, taskArn, command));
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function buildExecuteCommandArgs(request, taskArn, command) {
  return [
    "ecs",
    "execute-command",
    "--region",
    request.region,
    "--cluster",
    request.cluster,
    "--task",
    taskArn,
    "--container",
    request.container,
    "--interactive",
    "--command",
    command,
  ];
}

function buildServiceName(request) {
  const hash = createHash("sha256")
    .update(`${request.environmentId}\0${request.runtimeKind}\0${request.runtimeName}\0${request.runtimeInstanceId}`)
    .digest("hex")
    .slice(0, 16);
  const prefix = `${request.environmentId.replace(/\./g, "-")}-${request.runtimeKind}`;
  const runtimeLength = 63 - prefix.length - hash.length - 2;
  return `${prefix}-${request.runtimeName.slice(0, runtimeLength).replace(/-+$/g, "")}-${hash}`;
}

function runAwsJson(action, args) {
  return JSON.parse(runAws(action, args).stdout || "{}");
}

function runAws(action, args, options = {}) {
  const result = spawnSync("aws", args, { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 });
  if ((result.status ?? 1) !== 0 && !options.allowFailure) {
    throw new Error(`Failed to ${action}: ${result.stderr || result.stdout || `aws exited with ${result.status}`}`);
  }
  return result;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error(`Invalid forced-crash argument near "${name || ""}"`);
    }
    args[name.slice(2)] = value;
  }
  return args;
}

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

await main();
