#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

const MAX_REGIONAL_RPO_SECONDS = 20 * 60;

async function main() {
  const startedAt = new Date().toISOString();
  try {
    const request = resolveRequest(parseArgs(process.argv.slice(2)));
    const result = await runOperation(request);
    printJson({
      schemaVersion: 1,
      operation: request.operation,
      status: "passed",
      startedAt,
      finishedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    printJson({
      schemaVersion: 1,
      operation: "aws-runtime-dr",
      status: "failed",
      startedAt,
      finishedAt: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

async function runOperation(request) {
  const replication = describeReplication(request);
  switch (request.operation) {
    case "configure":
      return ensureReplication(request, replication);
    case "status":
      return requireHealthyReplication(request, replication);
    case "promote": {
      const status = requireHealthyReplication(request, replication);
      runAws("promote destination EFS replica", [
        "efs",
        "delete-replication-configuration",
        "--region",
        request.sourceRegion,
        "--source-file-system-id",
        request.sourceFileSystemId,
        "--deletion-mode",
        "ALL_CONFIGURATIONS",
      ]);
      await waitForReplicationPromotion(request);
      return { ...status, promotedAt: new Date().toISOString() };
    }
    default:
      throw new Error(`Unsupported DR operation "${request.operation}"`);
  }
}

async function waitForReplicationPromotion(request) {
  const timeoutSeconds = positiveInteger(process.env.AWS_RUNTIME_DR_PROMOTION_TIMEOUT_SECONDS, 1800);
  const pollSeconds = positiveInteger(process.env.AWS_RUNTIME_DR_PROMOTION_POLL_SECONDS, 15);
  const deadline = Date.now() + timeoutSeconds * 1000;

  while (Date.now() < deadline) {
    if (!describeReplication(request)) {
      return;
    }
    await delay(pollSeconds * 1000);
  }

  throw new Error(`EFS replica promotion did not complete within ${timeoutSeconds} seconds`);
}

function ensureReplication(request, replication) {
  if (replication) {
    assertReplicationDestinationMatches(request, replication);
    return buildReplicationStatus(request, replication, "already-configured");
  }

  const result = runAws("configure cross-account EFS replication", [
    "efs",
    "create-replication-configuration",
    "--region",
    request.sourceRegion,
    "--source-file-system-id",
    request.sourceFileSystemId,
    "--destinations",
    JSON.stringify([
      {
        Region: request.destinationRegion,
        FileSystemId: request.destinationFileSystemArn,
        RoleArn: request.replicationRoleArn,
      },
    ]),
    "--output",
    "json",
  ]);
  return buildReplicationStatus(request, JSON.parse(result.stdout), "configured");
}

function requireHealthyReplication(request, replication) {
  if (!replication) {
    throw new Error("Cross-account EFS replication is not configured");
  }
  assertReplicationDestinationMatches(request, replication);
  const status = buildReplicationStatus(request, replication, "healthy");
  if (status.destinationStatus !== "ENABLED") {
    throw new Error(`EFS replication destination is ${status.destinationStatus || "unknown"}`);
  }
  if (status.replicationLagSeconds > MAX_REGIONAL_RPO_SECONDS) {
    throw new Error(
      `EFS replication lag ${status.replicationLagSeconds}s exceeds the ${MAX_REGIONAL_RPO_SECONDS}s regional RPO`,
    );
  }
  return status;
}

function describeReplication(request) {
  const result = runAws(
    "describe cross-account EFS replication",
    [
      "efs",
      "describe-replication-configurations",
      "--region",
      request.sourceRegion,
      "--file-system-id",
      request.sourceFileSystemId,
      "--output",
      "json",
    ],
    { allowNotFound: true },
  );
  if (!result) {
    return undefined;
  }
  return JSON.parse(result.stdout).Replications?.[0];
}

function buildReplicationStatus(request, replication, outcome) {
  const destination = replication.Destinations?.[0] || {};
  const lastReplicatedAt = normalizeTimestamp(destination.LastReplicatedTimestamp);
  return {
    outcome,
    sourceFileSystemId: request.sourceFileSystemId,
    destinationFileSystemArn: request.destinationFileSystemArn,
    destinationStatus: destination.Status,
    lastReplicatedAt,
    replicationLagSeconds: lastReplicatedAt
      ? Math.max(0, Math.floor((Date.now() - Date.parse(lastReplicatedAt)) / 1000))
      : Number.MAX_SAFE_INTEGER,
  };
}

function assertReplicationDestinationMatches(request, replication) {
  const destination = replication.Destinations?.[0];
  const expectedFileSystemId = request.destinationFileSystemArn.split("/").at(-1);
  if (
    !destination ||
    destination.FileSystemId !== expectedFileSystemId ||
    destination.Region !== request.destinationRegion ||
    destination.RoleArn !== request.replicationRoleArn
  ) {
    throw new Error("Existing EFS replication configuration does not match the requested DR destination");
  }
}

function resolveRequest(args) {
  const request = {
    operation: args.operation || "status",
    sourceRegion: args["source-region"] || process.env.AWS_REGION || "us-east-1",
    destinationRegion: args["destination-region"] || "us-west-2",
    sourceFileSystemId: args["source-file-system-id"] || process.env.AWS_RUNTIME_EFS_FILE_SYSTEM_ID,
    destinationFileSystemArn: args["destination-file-system-arn"] || process.env.AWS_RUNTIME_DR_EFS_FILE_SYSTEM_ARN,
    replicationRoleArn: args["replication-role-arn"] || process.env.AWS_RUNTIME_EFS_REPLICATION_ROLE_ARN,
  };
  if (!new Set(["configure", "status", "promote"]).has(request.operation)) {
    throw new Error("--operation must be configure, status, or promote");
  }
  if (!/^fs-[0-9a-f]{8,40}$/.test(request.sourceFileSystemId || "")) {
    throw new Error("A valid source EFS file system ID is required");
  }
  if (
    !/^arn:aws[^:]*:elasticfilesystem:us-west-2:\d{12}:file-system\/fs-[0-9a-f]{8,40}$/.test(
      request.destinationFileSystemArn || "",
    )
  ) {
    throw new Error("A us-west-2 cross-account destination EFS ARN is required");
  }
  if (!/^arn:aws[^:]*:iam::\d{12}:role\/.+/.test(request.replicationRoleArn || "")) {
    throw new Error("A valid EFS replication role ARN is required");
  }
  return request;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error(`Invalid DR argument near "${name || ""}"`);
    }
    args[name.slice(2)] = value;
  }
  return args;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runAws(action, args, options = {}) {
  const result = spawnSync("aws", args, { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 });
  if ((result.status ?? 1) === 0) {
    return result;
  }
  const output = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  if (options.allowNotFound && /ReplicationNotFound|not found|does not exist/i.test(output)) {
    return undefined;
  }
  throw new Error(`Failed to ${action}: ${output || `aws exited with ${result.status ?? 1}`}`);
}

function normalizeTimestamp(value) {
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

await main();
