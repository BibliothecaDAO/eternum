import { randomUUID } from "node:crypto";
import type { AwsRuntimeLiveState, AwsRuntimeRequest } from "../aws-runtime";
import { buildAwsCommandOutput, parseJsonOutput, runRequiredAwsCommand, type AwsCommandRunner } from "./commands";
import type { AwsRuntimeCommandConfig } from "./config";
import { buildAwsRuntimeServiceName } from "./naming";
import { AWS_RUNTIME_CHECKPOINT_CONTAINER_NAME } from "./task-definition";

const DEFAULT_LEASE_SECONDS = 3600;
const MINIMUM_LEASE_SECONDS = 1800;
const RUNTIME_ADMISSION_CEILING = 80;

export function ensureRuntimeRouteAssignment(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
): AwsRuntimeRequest {
  if (!request.runtimeInstanceId) {
    return request;
  }

  const tableName = process.env.AWS_RUNTIME_CONTROL_TABLE_NAME?.trim();
  if (!tableName) {
    assertControlTableIsOptional(request);
    return { ...request, routingShard: request.routingShard ?? 0 };
  }

  const existingAssignment = readRuntimeRouteAssignment(commandRunner, request, tableName);
  if (existingAssignment) {
    assertRouteAssignmentMatchesInstance(request, existingAssignment);
    assertRequestedShardMatches(request, existingAssignment.routingShard);
    return { ...request, routingShard: existingAssignment.routingShard };
  }

  const candidateShards = request.routingShard === undefined ? listCandidateShards() : [request.routingShard];
  for (const routingShard of candidateShards) {
    if (tryAssignRuntimeRoute(commandRunner, request, tableName, routingShard)) {
      publishRoutingShardAdmissionMetric(commandRunner, request, tableName, routingShard);
      return { ...request, routingShard };
    }

    const assignedAfterRace = readRuntimeRouteAssignment(commandRunner, request, tableName);
    if (assignedAfterRace) {
      assertRouteAssignmentMatchesInstance(request, assignedAfterRace);
      assertRequestedShardMatches(request, assignedAfterRace.routingShard);
      return { ...request, routingShard: assignedAfterRace.routingShard };
    }
  }

  throw new Error(
    `No AWS runtime routing shard has capacity for "${request.runtimeName}"; append a shard before retrying`,
  );
}

export function resolveExistingRuntimeRouteAssignment(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
): AwsRuntimeRequest {
  if (!request.runtimeInstanceId) {
    return request;
  }

  const tableName = process.env.AWS_RUNTIME_CONTROL_TABLE_NAME?.trim();
  if (!tableName) {
    assertControlTableIsOptional(request);
    return request;
  }

  const assignment = readRuntimeRouteAssignment(commandRunner, request, tableName);
  if (!assignment) {
    return request;
  }

  assertRouteAssignmentMatchesInstance(request, assignment);
  assertRequestedShardMatches(request, assignment.routingShard);
  return { ...request, routingShard: assignment.routingShard };
}

function publishRoutingShardAdmissionMetric(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  tableName: string,
  routingShard: number,
): void {
  const result = runRequiredAwsCommand(commandRunner, `read routing shard ${routingShard} admission count`, [
    "dynamodb",
    "get-item",
    "--region",
    configRegion(request),
    "--table-name",
    tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: buildShardCounterKey(request, routingShard) } }),
    "--consistent-read",
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ Item?: { RuntimeCount?: { N?: string } } }>(result.stdout || "", {});
  const runtimeCount = Number(payload.Item?.RuntimeCount?.N);
  if (!Number.isInteger(runtimeCount) || runtimeCount < 0) {
    throw new Error(`Routing shard ${routingShard} admission count is missing after assignment`);
  }

  runRequiredAwsCommand(commandRunner, `publish routing shard ${routingShard} admission count`, [
    "cloudwatch",
    "put-metric-data",
    "--region",
    configRegion(request),
    "--namespace",
    "Eternum/AwsRuntime",
    "--metric-data",
    JSON.stringify([
      {
        MetricName: "RoutingShardRuntimeCount",
        Dimensions: [
          { Name: "EnvironmentId", Value: request.environmentId },
          { Name: "RoutingShard", Value: `${routingShard}` },
        ],
        Unit: "Count",
        Value: runtimeCount,
      },
    ]),
  ]);
}

export async function withRuntimeMutationLease<T>(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  operation: string,
  mutate: () => Promise<T> | T,
): Promise<T> {
  const tableName = process.env.AWS_RUNTIME_CONTROL_TABLE_NAME?.trim();
  if (!tableName) {
    assertControlTableIsOptional(request);
    return mutate();
  }

  const lease = acquireRuntimeMutationLease(commandRunner, request, tableName, operation);
  try {
    return await mutate();
  } finally {
    releaseRuntimeMutationLease(commandRunner, request, tableName, lease);
  }
}

export function checkpointRuntimeBeforeMutation(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
  operation: string,
): string | undefined {
  if (liveState.status !== "existing" || !request.runtimeInstanceId) {
    return undefined;
  }

  const taskArn = resolveRunningRuntimeTask(commandRunner, request, config);
  const correlationId = randomUUID();
  const result = runRequiredAwsCommand(commandRunner, `checkpoint AWS runtime before ${operation}`, [
    "ecs",
    "execute-command",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--task",
    taskArn,
    "--container",
    AWS_RUNTIME_CHECKPOINT_CONTAINER_NAME,
    "--interactive",
    "--command",
    `node /usr/local/bin/runtime-snapshot.mjs checkpoint ${correlationId}`,
  ]);
  const output = buildAwsCommandOutput(result);
  if (!output.includes(`checkpoint-complete:${correlationId}`)) {
    throw new Error(
      `AWS runtime "${request.runtimeName}" checkpoint ${correlationId} did not emit its correlated success marker`,
    );
  }

  return correlationId;
}

export function recordRuntimeDeletionAudit(commandRunner: AwsCommandRunner, request: AwsRuntimeRequest): void {
  const tableName = process.env.AWS_RUNTIME_CONTROL_TABLE_NAME?.trim();
  if (!tableName || !request.runtimeInstanceId) {
    return;
  }

  const deletedAt = new Date();
  const expiresAt = Math.floor(deletedAt.getTime() / 1000) + 90 * 24 * 60 * 60;
  runRequiredAwsCommand(commandRunner, `record deletion audit for "${request.runtimeName}"`, [
    "dynamodb",
    "put-item",
    "--region",
    configRegion(request),
    "--table-name",
    tableName,
    "--item",
    JSON.stringify({
      ControlKey: { S: buildRuntimeDeletionAuditKey(request) },
      RecordType: { S: "runtime-deletion-audit" },
      EnvironmentId: { S: request.environmentId },
      RuntimeKind: { S: request.runtimeKind },
      RuntimeName: { S: request.runtimeName },
      RuntimeInstanceId: { S: request.runtimeInstanceId },
      SnapshotRetentionIntent: { S: request.retainData ? "retained" : "deleted" },
      DeletedAt: { S: deletedAt.toISOString() },
      ExpiresAt: { N: `${expiresAt}` },
    }),
  ]);

  if (!request.retainData) {
    releaseRuntimeRouteAssignment(commandRunner, request, tableName);
  }
}

interface RuntimeMutationLease {
  leaseKey: string;
  leaseToken: string;
}

function acquireRuntimeMutationLease(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  tableName: string,
  operation: string,
): RuntimeMutationLease {
  const leaseKey = buildRuntimeLeaseKey(request);
  const leaseToken = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + resolveLeaseSeconds();
  const result = commandRunner([
    "dynamodb",
    "put-item",
    "--region",
    configRegion(request),
    "--table-name",
    tableName,
    "--item",
    JSON.stringify({
      ControlKey: { S: leaseKey },
      RecordType: { S: "runtime-lease" },
      EnvironmentId: { S: request.environmentId },
      RuntimeKind: { S: request.runtimeKind },
      RuntimeName: { S: request.runtimeName },
      RuntimeInstanceId: { S: request.runtimeInstanceId || "legacy" },
      LeaseToken: { S: leaseToken },
      Operation: { S: operation },
      LeaseExpiresAt: { N: `${expiresAt}` },
      ExpiresAt: { N: `${expiresAt + 3600}` },
    }),
    "--condition-expression",
    "attribute_not_exists(ControlKey) OR LeaseExpiresAt < :now",
    "--expression-attribute-values",
    JSON.stringify({ ":now": { N: `${now}` } }),
  ]);

  if ((result.status ?? 1) !== 0) {
    const output = buildAwsCommandOutput(result);
    if (/ConditionalCheckFailedException/i.test(output)) {
      throw new Error(`AWS runtime "${request.runtimeName}" already has an active mutation lease`);
    }
    throw new Error(`Failed to acquire AWS runtime mutation lease: ${output || "aws command failed"}`);
  }

  return { leaseKey, leaseToken };
}

function releaseRuntimeMutationLease(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  tableName: string,
  lease: RuntimeMutationLease,
): void {
  runRequiredAwsCommand(commandRunner, `release mutation lease for "${request.runtimeName}"`, [
    "dynamodb",
    "delete-item",
    "--region",
    configRegion(request),
    "--table-name",
    tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: lease.leaseKey } }),
    "--condition-expression",
    "LeaseToken = :leaseToken",
    "--expression-attribute-values",
    JSON.stringify({ ":leaseToken": { S: lease.leaseToken } }),
  ]);
}

function resolveRunningRuntimeTask(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): string {
  const result = runRequiredAwsCommand(commandRunner, `resolve running task for "${request.runtimeName}"`, [
    "ecs",
    "list-tasks",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--service-name",
    buildAwsRuntimeServiceName(request),
    "--desired-status",
    "RUNNING",
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ taskArns?: string[] }>(result.stdout || "", {});
  const taskArn = payload.taskArns?.[0];
  if (!taskArn) {
    throw new Error(`AWS runtime "${request.runtimeName}" has no running task to checkpoint`);
  }
  return taskArn;
}

function buildRuntimeLeaseKey(request: AwsRuntimeRequest): string {
  return ["LEASE", request.environmentId, request.runtimeKind, request.runtimeName].join("#");
}

function buildRuntimeDeletionAuditKey(request: AwsRuntimeRequest): string {
  return ["DELETE", request.environmentId, request.runtimeKind, request.runtimeName, request.runtimeInstanceId].join(
    "#",
  );
}

interface RuntimeRouteAssignment {
  routingShard: number;
  runtimeInstanceId: string;
}

function readRuntimeRouteAssignment(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  tableName: string,
): RuntimeRouteAssignment | undefined {
  const result = runRequiredAwsCommand(commandRunner, `read route assignment for "${request.runtimeName}"`, [
    "dynamodb",
    "get-item",
    "--region",
    configRegion(request),
    "--table-name",
    tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: buildRuntimeRouteKey(request) } }),
    "--consistent-read",
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{
    Item?: { RoutingShard?: { N?: string }; RuntimeInstanceId?: { S?: string } };
  }>(result.stdout || "", {});
  const routingShard = Number(payload.Item?.RoutingShard?.N);
  const runtimeInstanceId = payload.Item?.RuntimeInstanceId?.S;
  return Number.isInteger(routingShard) && routingShard >= 0 && runtimeInstanceId
    ? { routingShard, runtimeInstanceId }
    : undefined;
}

function releaseRuntimeRouteAssignment(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  tableName: string,
): void {
  const assignment = readRuntimeRouteAssignment(commandRunner, request, tableName);
  if (!assignment) {
    return;
  }
  assertRouteAssignmentMatchesInstance(request, assignment);

  runRequiredAwsCommand(commandRunner, `release route assignment for "${request.runtimeName}"`, [
    "dynamodb",
    "transact-write-items",
    "--region",
    configRegion(request),
    "--transact-items",
    JSON.stringify([
      {
        Delete: {
          TableName: tableName,
          Key: { ControlKey: { S: buildRuntimeRouteKey(request) } },
          ConditionExpression: "RuntimeInstanceId = :runtimeInstanceId",
          ExpressionAttributeValues: {
            ":runtimeInstanceId": { S: request.runtimeInstanceId! },
          },
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: { ControlKey: { S: buildShardCounterKey(request, assignment.routingShard) } },
          UpdateExpression: "ADD RuntimeCount :minusOne",
          ConditionExpression: "RuntimeCount > :zero",
          ExpressionAttributeValues: {
            ":minusOne": { N: "-1" },
            ":zero": { N: "0" },
          },
        },
      },
    ]),
  ]);
  publishRoutingShardAdmissionMetric(commandRunner, request, tableName, assignment.routingShard);
}

function tryAssignRuntimeRoute(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  tableName: string,
  routingShard: number,
): boolean {
  const result = commandRunner([
    "dynamodb",
    "transact-write-items",
    "--region",
    configRegion(request),
    "--transact-items",
    JSON.stringify([
      {
        Update: {
          TableName: tableName,
          Key: { ControlKey: { S: buildShardCounterKey(request, routingShard) } },
          UpdateExpression: "SET RecordType = :recordType, EnvironmentId = :environmentId ADD RuntimeCount :one",
          ConditionExpression: "attribute_not_exists(RuntimeCount) OR RuntimeCount < :ceiling",
          ExpressionAttributeValues: {
            ":recordType": { S: "routing-shard" },
            ":environmentId": { S: request.environmentId },
            ":one": { N: "1" },
            ":ceiling": { N: `${RUNTIME_ADMISSION_CEILING}` },
          },
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: {
            ControlKey: { S: buildRuntimeRouteKey(request) },
            RecordType: { S: "route-assignment" },
            EnvironmentId: { S: request.environmentId },
            RuntimeKind: { S: request.runtimeKind },
            RuntimeName: { S: request.runtimeName },
            RuntimeInstanceId: { S: request.runtimeInstanceId! },
            RoutingShard: { N: `${routingShard}` },
            AssignedAt: { S: new Date().toISOString() },
          },
          ConditionExpression: "attribute_not_exists(ControlKey)",
        },
      },
    ]),
  ]);

  if ((result.status ?? 1) === 0) {
    return true;
  }

  const output = buildAwsCommandOutput(result);
  if (/TransactionCanceledException|ConditionalCheckFailed/i.test(output)) {
    return false;
  }
  throw new Error(`Failed to assign AWS runtime routing shard: ${output || "aws command failed"}`);
}

function buildRuntimeRouteKey(request: AwsRuntimeRequest): string {
  return ["ROUTE", request.environmentId, request.runtimeKind, request.runtimeName].join("#");
}

function buildShardCounterKey(request: AwsRuntimeRequest, routingShard: number): string {
  return ["SHARD", request.environmentId, routingShard].join("#");
}

function listCandidateShards(): number[] {
  const listenerArns = process.env.AWS_RUNTIME_ALB_LISTENER_ARNS?.trim();
  if (!listenerArns) {
    return [0];
  }

  try {
    const parsed = JSON.parse(listenerArns);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((_listenerArn, index) => index);
    }
  } catch {
    // Foundation config validation reports the malformed value when the selected shard is resolved.
  }
  return [0];
}

function assertRequestedShardMatches(request: AwsRuntimeRequest, assignedShard: number): void {
  if (request.routingShard !== undefined && request.routingShard !== assignedShard) {
    throw new Error(
      `AWS runtime "${request.runtimeName}" is permanently assigned to routing shard ${assignedShard}, not ${request.routingShard}`,
    );
  }
}

function assertRouteAssignmentMatchesInstance(request: AwsRuntimeRequest, assignment: RuntimeRouteAssignment): void {
  if (request.runtimeInstanceId === assignment.runtimeInstanceId) {
    return;
  }

  throw new Error(
    `AWS runtime "${request.runtimeName}" route belongs to instance ${assignment.runtimeInstanceId}, not ${request.runtimeInstanceId || "missing"}`,
  );
}

function assertControlTableIsOptional(request: AwsRuntimeRequest): void {
  if (process.env.AWS_RUNTIME_REQUIRE_CONTROL_TABLE === "true") {
    throw new Error(
      `Missing AWS runtime foundation config: AWS_RUNTIME_CONTROL_TABLE_NAME for "${request.runtimeName}"`,
    );
  }
}

function resolveLeaseSeconds(): number {
  const configured = Number(process.env.AWS_RUNTIME_LEASE_SECONDS || DEFAULT_LEASE_SECONDS);
  return Number.isInteger(configured) && configured >= MINIMUM_LEASE_SECONDS ? configured : DEFAULT_LEASE_SECONDS;
}

function configRegion(request: AwsRuntimeRequest): string {
  return request.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
}
