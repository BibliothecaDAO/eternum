import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { buildFailureResult, validateCliResult } from "../cli/aws-runtime";
import {
  buildAwsRuntimeEndpointUrl,
  buildAwsRuntimeServiceName,
  classifyAwsRuntimeFailure,
  createAwsRuntimeCommandBackend as createAwsRuntimeCommandBackendImpl,
  deleteAwsRuntime,
  deleteAwsRuntimeGroup,
  describeAwsRuntime,
  ensureAwsRuntime,
  findExpiredAwsRuntimes,
  resolveAwsRuntimeTier,
  resolveAwsRuntimeEndpoint,
  toAwsRuntimeArtifact,
} from "../runtime/aws-runtime";
import {
  resolveRuntimeHealthTimeoutMs,
  resolveRuntimeStabilityDeadlineMs,
  waitForRuntimeServiceStable,
} from "../runtime/aws/health";
import { resolveAwsRuntimeCommandConfig, resolveRuntimeDomain, resolveRuntimeVersion } from "../runtime/aws/config";
import { buildRuntimeRootPath, buildTargetGroupName } from "../runtime/aws/naming";
import { deleteRuntimeTaskDefinitionRevisions, pruneRuntimeTaskDefinitionRevisions } from "../runtime/aws/service";
import {
  checkpointRuntimeBeforeMutation,
  ensureRuntimeRouteAssignment,
  recordRuntimeDeletionAudit,
  withRuntimeMutationLease,
} from "../runtime/aws/control";
import {
  deriveChildRuntimeInstanceId,
  deriveDeterministicRuntimeInstanceId,
  requireRuntimeInstanceId,
} from "../runtime/runtime-identity";

const AWS_ENV_KEYS = [
  "AWS_REGION",
  "AWS_RUNTIME_CLUSTER",
  "AWS_RUNTIME_ECR_IMAGE",
  "AWS_RUNTIME_ECR_REPOSITORY_URL",
  "AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN",
  "AWS_RUNTIME_TASK_ROLE_ARN",
  "AWS_RUNTIME_SUBNET_IDS",
  "AWS_RUNTIME_SECURITY_GROUP_IDS",
  "AWS_RUNTIME_EFS_FILE_SYSTEM_ID",
  "AWS_RUNTIME_VPC_ID",
  "AWS_RUNTIME_ALB_LISTENER_ARN",
  "AWS_RUNTIME_SNS_TOPIC_ARN",
  "AWS_RUNTIME_VERIFY_PUBLIC_HEALTH",
  "AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS",
  "AWS_RUNTIME_HEALTH_TIMEOUT_MS",
  "AWS_RUNTIME_CONTROL_TABLE_NAME",
  "AWS_RUNTIME_REQUIRE_CONTROL_TABLE",
  "AWS_RUNTIME_ALB_LISTENER_ARNS",
  "AWS_RUNTIME_LEASE_SECONDS",
] as const;

const originalEnv = new Map<string, string | undefined>(AWS_ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const TEST_RUNTIME_INSTANCE_ID = "018f6e54-5f4a-7ae2-a0ff-000000000042";
const EXPIRED_DELETE_AFTER = "2024-01-01T00:00:00.000Z";
const TEST_DELETE_IDENTITY = {
  environmentId: "slot.blitz" as const,
  runtimeKind: "torii" as const,
  runtimeName: "bltz-fire-gate-42",
  runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
};
const TEST_RUNTIME_SERVICE_NAME = buildAwsRuntimeServiceName(TEST_DELETE_IDENTITY);
const TEST_RUNTIME_ROOT_PATH = buildRuntimeRootPath(TEST_DELETE_IDENTITY);

function restoreAwsEnv(): void {
  for (const key of AWS_ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function configureAwsRuntimeEnv(): void {
  process.env.AWS_REGION = "us-east-1";
  process.env.AWS_RUNTIME_CLUSTER = "eternum-game-runtime";
  process.env.AWS_RUNTIME_ECR_IMAGE = `123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime@sha256:${"a".repeat(64)}`;
  process.env.AWS_RUNTIME_ECR_REPOSITORY_URL = "123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime";
  process.env.AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN = "arn:aws:iam::123456789012:role/runtime-execution";
  process.env.AWS_RUNTIME_TASK_ROLE_ARN = "arn:aws:iam::123456789012:role/runtime-task";
  process.env.AWS_RUNTIME_SUBNET_IDS = "subnet-a,subnet-b";
  process.env.AWS_RUNTIME_SECURITY_GROUP_IDS = "sg-runtime";
  process.env.AWS_RUNTIME_EFS_FILE_SYSTEM_ID = "fs-123";
  process.env.AWS_RUNTIME_VPC_ID = "vpc-123";
  process.env.AWS_RUNTIME_ALB_LISTENER_ARN = "arn:aws:elasticloadbalancing:listener/app/runtime/123/456";
  process.env.AWS_RUNTIME_SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:runtime-alerts";
  process.env.AWS_RUNTIME_VERIFY_PUBLIC_HEALTH = "0";
}

function okAwsCommand(stdout = "") {
  return {
    status: 0,
    stdout,
    stderr: "",
    signal: null,
    output: ["", stdout, ""],
    pid: 123,
  } as never;
}

function failedAwsCommand(stderr: string) {
  return {
    status: 255,
    stdout: "",
    stderr,
    signal: null,
    output: ["", "", stderr],
    pid: 123,
  } as never;
}

function createAwsRuntimeCommandBackend(
  commandRunner: Parameters<typeof createAwsRuntimeCommandBackendImpl>[0],
  options?: Parameters<typeof createAwsRuntimeCommandBackendImpl>[1],
): ReturnType<typeof createAwsRuntimeCommandBackendImpl> {
  return createAwsRuntimeCommandBackendImpl((args) => {
    const result = commandRunner(args);
    if (args.slice(0, 2).join(" ") === "ecr describe-images" && (result.status ?? 1) === 0 && !result.stdout) {
      return okAwsCommand(JSON.stringify({ imageDetails: [{ imageDigest: `sha256:${"a".repeat(64)}` }] }));
    }
    return result;
  }, options);
}

function activeRuntimeServicePayload(extraTags: Array<{ key: string; value: string }> = []) {
  return JSON.stringify({
    services: [
      {
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: 1,
        pendingCount: 0,
        deployments: [
          {
            status: "PRIMARY",
            rolloutState: "COMPLETED",
            desiredCount: 1,
            runningCount: 1,
            pendingCount: 0,
          },
        ],
        clusterArn: "arn:aws:ecs:cluster/runtime",
        serviceArn: "arn:aws:ecs:service/runtime/bltz-fire-gate-42",
        taskDefinition: "arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1",
        loadBalancers: [
          {
            targetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
          },
        ],
        tags: [
          { key: "RuntimeTier", value: "basic" },
          { key: "RuntimeVersion", value: "v1.8.16" },
          { key: "EfsAccessPointId", value: "fsap-123" },
          { key: "TargetGroupArn", value: "arn:aws:elasticloadbalancing:targetgroup/runtime/123" },
          ...extraTags,
        ],
      },
    ],
  });
}

function buildRuntimeOwnerTags(
  runtimeKind: string,
  runtimeName: string,
  gameName: string,
  options: {
    environment?: string;
    retainRuntime?: boolean;
    runtimeInstanceId?: string;
    deleteAfter?: string;
    lifecycleClass?: "ephemeral" | "shared";
    autoTeardown?: boolean;
  } = {},
) {
  return [
    { key: "Project", value: "eternum" },
    { key: "RuntimeProvider", value: "aws" },
    { key: "Environment", value: options.environment || "slot.blitz" },
    { key: "RuntimeKind", value: runtimeKind },
    { key: "RuntimeName", value: runtimeName },
    { key: "GameName", value: gameName },
    { key: "RunKind", value: "game" },
    { key: "RunName", value: gameName },
    { key: "AutoTeardown", value: `${options.autoTeardown ?? true}` },
    { key: "LifecycleClass", value: options.lifecycleClass || "ephemeral" },
    { key: "RuntimeTier", value: "basic" },
    ...(options.runtimeInstanceId ? [{ key: "RuntimeInstanceId", value: options.runtimeInstanceId }] : []),
    ...(options.deleteAfter ? [{ key: "DeleteAfter", value: options.deleteAfter }] : []),
    ...(options.retainRuntime ? [{ key: "RetainRuntime", value: "true" }] : []),
  ];
}

function buildTaggedRuntimeService(
  runtimeKind: string,
  runtimeName: string,
  gameName: string,
  options: {
    createdAt?: string;
    environment?: string;
    runtimeInstanceId?: string;
    deleteAfter?: string;
    lifecycleClass?: "ephemeral" | "shared";
    autoTeardown?: boolean;
    retainRuntime?: boolean;
  } = {},
) {
  return {
    status: "ACTIVE",
    desiredCount: 1,
    runningCount: 1,
    pendingCount: 0,
    createdAt: options.createdAt || "2026-07-04T00:00:00.000Z",
    clusterArn: "arn:aws:ecs:cluster/runtime",
    serviceArn: `arn:aws:ecs:service/runtime/${runtimeName}`,
    taskDefinition: `arn:aws:ecs:task-definition/slot-blitz-${runtimeKind}-${runtimeName}:1`,
    loadBalancers: [
      {
        targetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
      },
    ],
    tags: buildRuntimeOwnerTags(runtimeKind, runtimeName, gameName, {
      environment: options.environment,
      runtimeInstanceId: options.runtimeInstanceId,
      deleteAfter: options.deleteAfter,
      lifecycleClass: options.lifecycleClass,
      autoTeardown: options.autoTeardown,
      retainRuntime: options.retainRuntime,
    }),
  };
}

function runtimeServiceStabilityPayload(options: {
  deploymentRolloutState: string;
  runningCount: number;
  pendingCount: number;
  rolloutStateReason?: string;
  deploymentCount?: number;
}) {
  const deployment = {
    status: "PRIMARY",
    rolloutState: options.deploymentRolloutState,
    rolloutStateReason: options.rolloutStateReason,
    desiredCount: 1,
    runningCount: options.runningCount,
    pendingCount: options.pendingCount,
  };

  return JSON.stringify({
    services: [
      {
        status: "ACTIVE",
        desiredCount: 1,
        runningCount: options.runningCount,
        pendingCount: options.pendingCount,
        deployments: Array.from({ length: options.deploymentCount || 1 }, () => deployment),
      },
    ],
  });
}

function activeTaskDefinitionPayload(overrides: { rpcUrl?: string; image?: string; worldAddress?: string } = {}) {
  return JSON.stringify({
    taskDefinition: {
      taskDefinitionArn: "arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1",
      family: "slot-blitz-torii-bltz-fire-gate-42",
      revision: 1,
      status: "ACTIVE",
      networkMode: "awsvpc",
      pidMode: "task",
      requiresCompatibilities: ["FARGATE"],
      runtimePlatform: {
        cpuArchitecture: "X86_64",
        operatingSystemFamily: "LINUX",
      },
      cpu: "1024",
      memory: "2048",
      executionRoleArn: "arn:aws:iam::123456789012:role/runtime-execution",
      taskRoleArn: "arn:aws:iam::123456789012:role/runtime-task",
      containerDefinitions: [
        {
          name: "runtime",
          image:
            overrides.image || `123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime@sha256:${"a".repeat(64)}`,
          essential: true,
          user: "1000:1000",
          readonlyRootFilesystem: true,
          mountPoints: [
            { sourceVolume: "runtime-working-data", containerPath: "/data", readOnly: false },
            { sourceVolume: "runtime-data", containerPath: "/snapshots", readOnly: false },
            { sourceVolume: "runtime-tmp", containerPath: "/tmp", readOnly: false },
            { sourceVolume: "runtime-control", containerPath: "/runtime-control", readOnly: false },
          ],
          linuxParameters: {
            initProcessEnabled: true,
            capabilities: { drop: ["ALL"] },
          },
          environment: [
            { name: "RUNTIME_ENVIRONMENT_ID", value: "slot.blitz" },
            { name: "RUNTIME_KIND", value: "torii" },
            { name: "RUNTIME_NAME", value: "bltz-fire-gate-42" },
            { name: "RUNTIME_INSTANCE_ID", value: TEST_RUNTIME_INSTANCE_ID },
            { name: "RUNTIME_IMAGE_DIGEST", value: `sha256:${"a".repeat(64)}` },
            { name: "RUNTIME_EXPOSURE_POLICY", value: "public-read" },
            { name: "RUNTIME_BASE_PATH", value: "/x/slot-blitz/bltz-fire-gate-42/torii" },
            { name: "RUNTIME_VERSION", value: "v1.8.16" },
            { name: "RPC_URL", value: overrides.rpcUrl || "https://rpc.example.test" },
            { name: "WORLD_ADDRESS", value: overrides.worldAddress || "0xabc" },
            { name: "TORII_WORLD_BLOCK", value: "" },
            { name: "TORII_NAMESPACES", value: "" },
            { name: "TORII_EXTERNAL_CONTRACTS", value: "" },
            { name: "DATA_DIR", value: "/data" },
            { name: "SNAPSHOT_DIR", value: "/snapshots" },
            { name: "SNAPSHOT_INTERVAL_SECONDS", value: "300" },
            { name: "SNAPSHOT_RETAIN", value: "12" },
            { name: "SNAPSHOT_MAX_CONSECUTIVE_FAILURES", value: "3" },
            { name: "PROXY_CORS_ORIGINS", value: "" },
            { name: "PROXY_MAX_BODY_BYTES", value: "1048576" },
            { name: "PROXY_MAX_URL_BYTES", value: "8192" },
            { name: "PROXY_UPSTREAM_TIMEOUT_MS", value: "30000" },
            { name: "PROXY_MAX_WEBSOCKET_CONNECTIONS", value: "100" },
            { name: "PUBLIC_PORT", value: "8080" },
            { name: "INTERNAL_PORT", value: "8081" },
          ],
        },
        {
          name: "runtime-checkpoint",
          image:
            overrides.image || `123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime@sha256:${"a".repeat(64)}`,
          essential: false,
          user: "1000:1000",
          readonlyRootFilesystem: false,
          entryPoint: ["/usr/local/bin/checkpoint-agent.sh", "serve"],
          mountPoints: [
            { sourceVolume: "runtime-working-data", containerPath: "/data", readOnly: false },
            { sourceVolume: "runtime-data", containerPath: "/snapshots", readOnly: false },
            { sourceVolume: "checkpoint-tmp", containerPath: "/tmp", readOnly: false },
            { sourceVolume: "runtime-control", containerPath: "/runtime-control", readOnly: false },
          ],
          linuxParameters: {
            initProcessEnabled: true,
            capabilities: { drop: ["ALL"] },
          },
        },
      ],
      volumes: [
        { name: "runtime-working-data" },
        { name: "runtime-data" },
        { name: "runtime-tmp" },
        { name: "checkpoint-tmp" },
        { name: "runtime-control" },
      ],
      requiresAttributes: [],
      compatibilities: ["EC2", "FARGATE"],
      registeredAt: "2026-07-04T00:00:00.000Z",
      registeredBy: "arn:aws:sts::123456789012:assumed-role/test",
    },
  });
}

function taggedAccessPointPayload(accessPointId = "fsap-123") {
  return {
    AccessPointId: accessPointId,
    RootDirectory: {
      Path: "/runtimes/slot-blitz-torii-bltz-fire-gate-42",
    },
    Tags: [
      { Key: "Project", Value: "eternum" },
      { Key: "Environment", Value: "slot.blitz" },
      { Key: "RuntimeKind", Value: "torii" },
      { Key: "RuntimeName", Value: "bltz-fire-gate-42" },
      { Key: "RuntimeServiceName", Value: "slot-blitz-torii-bltz-fire-gate-42" },
    ],
  };
}

function activeRuntimeTaskDefinitionPayload(
  efsAccessPointId = "fsap-123",
  overrides: { rpcUrl?: string; image?: string; worldAddress?: string } = {},
) {
  const payload = JSON.parse(activeTaskDefinitionPayload(overrides)) as { taskDefinition: Record<string, unknown> };
  payload.taskDefinition.ephemeralStorage = { sizeInGiB: 25 };
  payload.taskDefinition.volumes = [
    {
      name: "runtime-working-data",
    },
    {
      name: "runtime-data",
      efsVolumeConfiguration: {
        authorizationConfig: {
          accessPointId: efsAccessPointId,
        },
      },
    },
    { name: "runtime-tmp" },
    { name: "checkpoint-tmp" },
    { name: "runtime-control" },
  ];
  return JSON.stringify(payload);
}

function completeCreateStep(createdStep: string, failureStep: string, shouldFail: boolean, markFailed: () => void) {
  if (shouldFail && createdStep === failureStep) {
    markFailed();
    return failedAwsCommand(`${failureStep} interrupted`);
  }

  return okAwsCommand(createStepOutput(createdStep));
}

function createStepOutput(createdStep: string): string {
  switch (createdStep) {
    case "access-point":
      return "fsap-123\n";
    case "task-definition":
      return "arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n";
    case "target-group":
      return "arn:aws:elasticloadbalancing:targetgroup/runtime/123\n";
    default:
      return "";
  }
}

function createBlitzToriiRuntime(backend: ReturnType<typeof createAwsRuntimeCommandBackend>) {
  return backend.createRuntime({
    environmentId: "slot.blitz",
    runtimeKind: "torii",
    runtimeName: "bltz-fire-gate-42",
    rpcUrl: "https://rpc.example.test",
    worldAddress: "0x123",
  });
}

function createServiceStateTracker() {
  let created = false;

  return {
    markCreated(): void {
      created = true;
    },
    describe() {
      return okAwsCommand(created ? activeRuntimeServicePayload() : JSON.stringify({ services: [] }));
    },
  };
}

function countCommands(commands: string[][], commandName: string): number {
  return commands.filter((command) => command.slice(0, 2).join(" ") === commandName).length;
}

function findCommand(commands: string[][], commandName: string): string[] {
  const command = commands.find((args) => args.slice(0, 2).join(" ") === commandName);
  expect(command).toBeDefined();
  return command!;
}

function readJsonArg<T>(command: string[], flag: string): T {
  const value = command[command.indexOf(flag) + 1];
  expect(value).toBeDefined();
  return JSON.parse(value!) as T;
}

function extractCreateRulePathValues(command: string[]): string[] {
  const condition = command[command.indexOf("--conditions") + 1] || "";
  const values = /Values=(?<values>.+)$/.exec(condition)?.groups?.values || "";
  return values.split(",").filter(Boolean);
}

function extractForwardTargetGroupArn(command: string[]): string | undefined {
  const action = command[command.indexOf("--actions") + 1] || "";
  return /TargetGroupArn=(?<targetGroupArn>[^,]+)/.exec(action)?.groups?.targetGroupArn;
}

function readLoggedAwsCommands(logPath: string): string[][] {
  return fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
}

function writeFakeAwsCli(tempDir: string): string {
  const scriptPath = path.join(tempDir, "aws");
  fs.writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.AWS_COMMAND_LOG, JSON.stringify(args) + "\\n");

const statePath = process.env.AWS_STATE_FILE;
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { describes: 0 };
function saveState() {
  fs.writeFileSync(statePath, JSON.stringify(state));
}
function write(value) {
  process.stdout.write(value);
}

if (args[0] === "ecs" && args[1] === "describe-services") {
  state.describes += 1;
  saveState();
  if (state.describes === 1) {
    write(JSON.stringify({ services: [] }));
  } else {
    write(${JSON.stringify(activeRuntimeServicePayload())});
  }
  process.exit(0);
}

if (args[0] === "ecr" && args[1] === "describe-images") {
  write(JSON.stringify({ imageDetails: [{ imageDigest: "sha256:${"a".repeat(64)}" }] }));
  process.exit(0);
}

if (args[0] === "efs" && args[1] === "create-access-point") {
  write("fsap-123\\n");
  process.exit(0);
}

if (args[0] === "ecs" && args[1] === "register-task-definition") {
  write("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\\n");
  process.exit(0);
}

if (args[0] === "elbv2" && args[1] === "create-target-group") {
  write("arn:aws:elasticloadbalancing:targetgroup/runtime/123\\n");
  process.exit(0);
}

process.exit(0);
`,
  );
  fs.chmodSync(scriptPath, 0o755);
  return scriptPath;
}

afterEach(() => {
  restoreAwsEnv();
  globalThis.fetch = originalFetch;
});

describe("AWS runtime helpers", () => {
  test("keeps public runtime health probing and service stability waiting in the AWS health module", () => {
    const healthModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/health.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(healthModule).toContain("export async function probeRuntimePublicHealth");
    expect(healthModule).toContain("export function waitForRuntimeServiceStable");
    expect(runtimeModule).toContain('from "./aws/health"');
  });

  test("keeps the split AWS runtime package as a public API re-export", async () => {
    const runtimePackage = await import("../runtime/aws");
    const runtimeModule = await import("../runtime/aws-runtime");

    expect(runtimePackage.ensureAwsRuntime).toBe(runtimeModule.ensureAwsRuntime);
    expect(runtimePackage.deleteAwsRuntime).toBe(runtimeModule.deleteAwsRuntime);
    expect(runtimePackage.createAwsRuntimeCommandBackend).toBe(runtimeModule.createAwsRuntimeCommandBackend);
  });

  test("keeps AWS runtime reconciliation flows in the AWS reconcile module", () => {
    const reconcileModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/reconcile.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(reconcileModule).toContain("export async function ensureAwsRuntime");
    expect(reconcileModule).toContain("export async function resizeAwsRuntime");
    expect(reconcileModule).toContain("export async function describeAwsRuntime");
    expect(reconcileModule).toContain("export async function deleteAwsRuntime");
    expect(runtimeModule).toContain('from "./aws/reconcile"');
    expect(runtimeModule).not.toContain("export async function ensureAwsRuntime");
  });

  test("keeps AWS runtime alarm lifecycle in the AWS alarms module", () => {
    const alarmsModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/alarms.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(alarmsModule).toContain("export function ensureRuntimeAlarms");
    expect(alarmsModule).toContain("export function deleteRuntimeAlarms");
    expect(runtimeModule).toContain('from "./aws/alarms"');
    expect(runtimeModule).not.toContain("function ensureRuntimeAlarms");
  });

  test("keeps AWS runtime routing resources in the AWS routing module", () => {
    const routingModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/routing.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(routingModule).toContain("export function ensureTargetGroup");
    expect(routingModule).toContain("export function ensureListenerRule");
    expect(routingModule).toContain("export function deleteListenerRuleIfPresent");
    expect(routingModule).toContain("export function deleteTargetGroupIfPresent");
    expect(runtimeModule).toContain('from "./aws/routing"');
    expect(runtimeModule).not.toContain("function ensureTargetGroup");
  });

  test("keeps AWS runtime ECS service lifecycle in the AWS service module", () => {
    const serviceModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/service.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(serviceModule).toContain("export async function ensureEcsService");
    expect(serviceModule).toContain("export async function updateRuntimeServiceTaskDefinition");
    expect(serviceModule).toContain("export function deleteEcsService");
    expect(serviceModule).toContain("export function cleanupRuntimeSnapshotStore");
    expect(runtimeModule).toContain('from "./aws/service"');
    expect(runtimeModule).not.toContain("function createEcsService");
  });

  test("keeps AWS runtime names and paths in the AWS naming module", () => {
    const namingModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/naming.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(namingModule).toContain("export function buildAwsRuntimeServiceName");
    expect(namingModule).toContain("export function buildRuntimeRootPath");
    expect(runtimeModule).toContain('from "./aws/naming"');
  });

  test("keeps AWS command execution helpers in the AWS commands module", () => {
    const commandsModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/commands.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(commandsModule).toContain("export function runAwsCommand");
    expect(commandsModule).toContain("export function runRequiredAwsCommand");
    expect(runtimeModule).toContain('from "./aws/commands"');
  });

  test("keeps AWS EFS access point resources in the AWS resources module", () => {
    const resourcesModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/resources.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(resourcesModule).toContain("export function ensureEfsAccessPoint");
    expect(resourcesModule).toContain("export function resolveEfsAccessPointIdByRootPath");
    expect(resourcesModule).toContain("export function deleteEfsAccessPointIfPresent");
    expect(runtimeModule).toContain('from "./aws/resources"');
  });

  test("keeps AWS runtime config resolution in the AWS config module", () => {
    const configModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/config.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(configModule).toContain("export function resolveAwsRuntimeCommandConfig");
    expect(configModule).toContain("export function buildAwsRuntimeTags");
    expect(configModule).toContain("export function resolveAwsRuntimeTier");
    expect(runtimeModule).toContain('from "./aws/config"');
  });

  test("keeps AWS task definition builders in the AWS task-definition module", () => {
    const taskDefinitionModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws/task-definition.ts"),
      "utf8",
    );
    const runtimeModule = fs.readFileSync(
      path.join(process.cwd(), "config/deployer/clean/runtime/aws-runtime.ts"),
      "utf8",
    );

    expect(taskDefinitionModule).toContain("export function buildContainerDefinitions");
    expect(taskDefinitionModule).toContain("export function buildResizedTaskDefinition");
    expect(taskDefinitionModule).toContain("export function stripReadonlyTaskDefinitionFields");
    expect(runtimeModule).toContain('from "./aws/task-definition"');
  });

  test("builds public single-domain runtime endpoints", () => {
    expect(
      buildAwsRuntimeEndpointUrl({
        domain: "runtime.realms.world",
        environmentId: "slot.blitz",
        runtimeName: "bltz-fire-gate-42",
        runtimeKind: "torii",
        endpointKind: "sql",
      }),
    ).toBe("https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/torii/sql");

    expect(
      buildAwsRuntimeEndpointUrl({
        domain: "runtime.realms.world",
        environmentId: "slot.blitz",
        runtimeName: "eternum-slot",
        runtimeKind: "katana",
        endpointKind: "rpc",
      }),
    ).toBe("https://runtime.realms.world/x/slot-blitz/eternum-slot/katana/rpc/v0_9");

    expect(
      resolveAwsRuntimeEndpoint({
        domain: "runtime.realms.world",
        environmentId: "mainnet.blitz",
        runtimeId: "bltz-fire-gate-42",
        runtimeKind: "torii",
        endpointKind: "health",
      }),
    ).toBe("https://runtime.realms.world/x/mainnet-blitz/bltz-fire-gate-42/torii/health");
  });

  test("normalizes and validates runtime route domains", () => {
    expect(resolveRuntimeDomain("https://Runtime.Realms.World.")).toBe("runtime.realms.world");
    expect(() => resolveRuntimeDomain("runtime.realms.world/attacker.example")).toThrow("Invalid AWS runtime domain");
  });

  test("normalizes AWS service names for runtime isolation", () => {
    expect(
      buildAwsRuntimeServiceName({ environmentId: "slot.blitz", runtimeKind: "torii", runtimeName: "Bltz_01" }),
    ).toBe("slot-blitz-torii-bltz-01");
  });

  test("builds collision-resistant service names for immutable runtime identities", () => {
    const first = buildAwsRuntimeServiceName({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate",
      runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-123456789abc",
    });
    const second = buildAwsRuntimeServiceName({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate",
      runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-abcdef012345",
    });

    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(63);
    expect(second.length).toBeLessThanOrEqual(63);
  });

  test("keeps generated AWS identifiers unique and within service limits across canonical identities", () => {
    const services = new Set<string>();
    const targetGroups = new Set<string>();

    for (let index = 0; index < 512; index += 1) {
      const identity = {
        environmentId: index % 2 === 0 ? ("slot.blitz" as const) : ("slottest.eternum" as const),
        runtimeKind: index % 3 === 0 ? ("katana" as const) : ("torii" as const),
        runtimeName: `${index % 2 === 0 ? "runtime" : "long-runtime-name"}-${index.toString(36)}`,
        runtimeInstanceId: `018f6e54-5f4a-7ae2-a0ff-${index.toString(16).padStart(12, "0")}`,
      };
      const serviceName = buildAwsRuntimeServiceName(identity);
      const targetGroupName = buildTargetGroupName(identity);

      expect(serviceName).toMatch(/^[a-z0-9-]+$/);
      expect(serviceName.length).toBeLessThanOrEqual(63);
      expect(targetGroupName).toMatch(/^[a-z0-9-]+-[a-f0-9]{16}$/);
      expect(targetGroupName.length).toBeLessThanOrEqual(32);
      expect(buildRuntimeRootPath(identity).length).toBeLessThanOrEqual(1000);
      expect(services.has(serviceName)).toBe(false);
      expect(targetGroups.has(targetGroupName)).toBe(false);
      services.add(serviceName);
      targetGroups.add(targetGroupName);
    }
  });

  test("rejects non-canonical runtime names for immutable identities", () => {
    expect(() =>
      buildAwsRuntimeServiceName({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "foo_bar",
        runtimeInstanceId: "runtime-1",
      }),
    ).toThrow("Invalid runtime name");
  });

  test("derives retry-stable UUIDs and distinct UUIDs for child runtimes", () => {
    const seed = ["github-run", "dojoengine/eternum", "game-launch", "12345", "slot.blitz", "game", "bltz-01"];
    const runtimeInstanceId = deriveDeterministicRuntimeInstanceId(seed);
    const retriedInstanceId = deriveDeterministicRuntimeInstanceId(seed);
    const nextRunInstanceId = deriveDeterministicRuntimeInstanceId([...seed.slice(0, 3), "12346", ...seed.slice(4)]);
    const firstChild = deriveChildRuntimeInstanceId(runtimeInstanceId, "bltz-01");
    const secondChild = deriveChildRuntimeInstanceId(runtimeInstanceId, "bltz-02");

    expect(runtimeInstanceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(retriedInstanceId).toBe(runtimeInstanceId);
    expect(nextRunInstanceId).not.toBe(runtimeInstanceId);
    expect(firstChild).not.toBe(secondChild);
    expect(() => requireRuntimeInstanceId(firstChild)).not.toThrow();
    expect(() => requireRuntimeInstanceId("runtime-1")).toThrow("lowercase RFC 9562 UUID");
  });

  test("rejects incomplete immutable desired state before reading AWS", async () => {
    const backend = {
      async describeRuntime() {
        throw new Error("desired-state validation must run before AWS");
      },
      async createRuntime() {
        return [];
      },
      async updateRuntimeTier() {},
      async deleteRuntime() {
        return [];
      },
    };
    const identity = {
      environmentId: "slot.blitz" as const,
      runtimeKind: "torii" as const,
      runtimeName: "bltz-01",
      runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-000000000030",
    };

    await expect(
      ensureAwsRuntime(
        {
          ...identity,
          runtimeInstanceId: undefined,
          imageDigest: `sha256:${"a".repeat(64)}`,
          exposurePolicy: "public-read",
        },
        { backend },
      ),
    ).rejects.toThrow("runtimeInstanceId is required");
    await expect(ensureAwsRuntime({ ...identity, exposurePolicy: "public-read" }, { backend })).rejects.toThrow(
      "requires imageDigest",
    );
    await expect(
      ensureAwsRuntime({ ...identity, imageDigest: `sha256:${"a".repeat(64)}` }, { backend }),
    ).rejects.toThrow("requires exposurePolicy");
  });

  test("rejects ephemeral or game-owned Katana desired state", async () => {
    const backend = {
      async describeRuntime() {
        throw new Error("desired-state validation must run before AWS");
      },
      async createRuntime() {
        return [];
      },
      async updateRuntimeTier() {},
      async deleteRuntime() {
        return [];
      },
    };
    const katanaRequest = {
      environmentId: "slot.blitz" as const,
      runtimeKind: "katana" as const,
      runtimeName: "shared-slot",
      runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
      imageDigest: `sha256:${"a".repeat(64)}`,
      exposurePolicy: "public-dev-rpc" as const,
    };

    await expect(ensureAwsRuntime({ ...katanaRequest, lifecycleClass: "ephemeral" }, { backend })).rejects.toThrow(
      "AWS Katana requires lifecycleClass=shared",
    );
    await expect(
      ensureAwsRuntime(
        {
          ...katanaRequest,
          lifecycleClass: "shared",
          owner: {
            runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
            gameName: "bltz-fire-gate-42",
            runKind: "game",
            runName: "bltz-fire-gate-42",
            autoTeardown: false,
            lifecycleClass: "shared",
          },
        },
        { backend },
      ),
    ).rejects.toThrow("Shared AWS Katana cannot be owned by a game or launch run");
  });

  test("rejects a mutation while another operation owns the runtime lease", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_CONTROL_TABLE_NAME = "runtime-control";
    let mutated = false;

    await expect(
      withRuntimeMutationLease(
        () => failedAwsCommand("ConditionalCheckFailedException: lease is active"),
        {
          environmentId: "slot.blitz",
          runtimeKind: "torii",
          runtimeName: "bltz-fire-gate-42",
          runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-123456789abc",
        },
        "delete",
        () => {
          mutated = true;
        },
      ),
    ).rejects.toThrow("already has an active mutation lease");
    expect(mutated).toBe(false);
  });

  test("rejects every mutation when the required control table is missing", async () => {
    configureAwsRuntimeEnv();
    delete process.env.AWS_RUNTIME_CONTROL_TABLE_NAME;
    process.env.AWS_RUNTIME_REQUIRE_CONTROL_TABLE = "true";
    let mutated = false;

    await expect(
      withRuntimeMutationLease(
        () => okAwsCommand(),
        {
          environmentId: "slot.blitz",
          runtimeKind: "torii",
          runtimeName: "bltz-fire-gate-42",
          runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-123456789abc",
        },
        "delete",
        () => {
          mutated = true;
        },
      ),
    ).rejects.toThrow("AWS_RUNTIME_CONTROL_TABLE_NAME");
    expect(mutated).toBe(false);
  });

  test("rejects a sticky route owned by a different runtime instance", () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_CONTROL_TABLE_NAME = "runtime-control";

    expect(() =>
      ensureRuntimeRouteAssignment(
        () =>
          okAwsCommand(
            JSON.stringify({
              Item: {
                RoutingShard: { N: "0" },
                RuntimeInstanceId: { S: "018f6e54-5f4a-7ae2-a0ff-previous0000" },
              },
            }),
          ),
        {
          environmentId: "slot.blitz",
          runtimeKind: "torii",
          runtimeName: "bltz-fire-gate-42",
          runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-current000000",
        },
      ),
    ).toThrow("route belongs to instance");
  });

  test("releases shard admission only after destructive runtime deletion", () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_CONTROL_TABLE_NAME = "runtime-control";
    const commands: string[][] = [];
    const runtimeInstanceId = "018f6e54-5f4a-7ae2-a0ff-123456789abc";
    const commandRunner = (args: string[]) => {
      commands.push(args);
      if (args.slice(0, 2).join(" ") === "dynamodb get-item" && commands.length === 2) {
        return okAwsCommand(
          JSON.stringify({ Item: { RoutingShard: { N: "1" }, RuntimeInstanceId: { S: runtimeInstanceId } } }),
        );
      }
      if (args.slice(0, 2).join(" ") === "dynamodb get-item") {
        return okAwsCommand(JSON.stringify({ Item: { RuntimeCount: { N: "0" } } }));
      }
      return okAwsCommand();
    };

    recordRuntimeDeletionAudit(commandRunner, {
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      runtimeInstanceId,
      retainData: false,
    });

    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "dynamodb put-item",
      "dynamodb get-item",
      "dynamodb transact-write-items",
      "dynamodb get-item",
      "cloudwatch put-metric-data",
    ]);
    const transaction = readJsonArg<Array<Record<string, unknown>>>(commands[2]!, "--transact-items");
    expect(transaction).toHaveLength(2);

    commands.length = 0;
    recordRuntimeDeletionAudit(commandRunner, {
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      runtimeInstanceId,
      retainData: true,
    });
    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual(["dynamodb put-item"]);
  });

  test("runs audited checkpoints only in the writable checkpoint sidecar", () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const commandRunner = (args: string[]) => {
      commands.push(args);
      if (args.slice(0, 2).join(" ") === "ecs list-tasks") {
        return okAwsCommand(JSON.stringify({ taskArns: ["arn:aws:ecs:task/runtime/task-123"] }));
      }
      if (args.slice(0, 2).join(" ") === "ecs execute-command") {
        const correlationId = /checkpoint ([0-9a-f-]+)$/.exec(args.at(-1) || "")?.[1];
        return okAwsCommand(`checkpoint-complete:${correlationId} checksum=abc123`);
      }
      return okAwsCommand();
    };

    const correlationId = checkpointRuntimeBeforeMutation(
      commandRunner,
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-123456789abc",
      },
      {
        region: "us-east-1",
        cluster: "eternum-runtime",
        snsTopicArn: "arn:aws:sns:us-east-1:123456789012:runtime-alerts",
        image: `runtime@sha256:${"a".repeat(64)}`,
        imageDigest: `sha256:${"a".repeat(64)}`,
        executionRoleArn: "arn:aws:iam::123456789012:role/runtime-execution",
        taskRoleArn: "arn:aws:iam::123456789012:role/runtime-task",
        subnetIds: ["subnet-a"],
        securityGroupIds: ["sg-runtime"],
        efsFileSystemId: "fs-123",
        vpcId: "vpc-123",
        listenerArn: "arn:aws:elasticloadbalancing:listener/app/runtime/123/456",
        assignPublicIp: "DISABLED",
        logGroup: "/ecs/runtime",
        containerName: "runtime",
      },
      {
        provider: "aws",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        serviceName: "slot-blitz-torii-bltz-fire-gate-42",
        status: "existing",
      },
      "deploy",
    );

    expect(correlationId).toMatch(/^[0-9a-f-]{36}$/);
    const executeCommand = findCommand(commands, "ecs execute-command");
    expect(executeCommand[executeCommand.indexOf("--container") + 1]).toBe("runtime-checkpoint");
    expect(executeCommand[executeCommand.indexOf("--command") + 1]).toContain(`checkpoint ${correlationId}`);
  });

  test("maps fixed runtime tiers to conservative Fargate sizing", () => {
    expect(resolveAwsRuntimeTier("basic")).toEqual({
      cpu: 1024,
      memory: 2048,
      desiredCount: 1,
      ephemeralStorageGib: 25,
    });

    expect(resolveAwsRuntimeTier("epic")).toEqual({
      cpu: 4096,
      memory: 8192,
      desiredCount: 1,
      ephemeralStorageGib: 100,
    });
  });

  test("uses engine-specific default versions in runtime metadata", () => {
    expect(resolveRuntimeVersion({ environmentId: "slot.blitz", runtimeKind: "torii", runtimeName: "factory" })).toBe(
      "v1.8.16",
    );
    expect(resolveRuntimeVersion({ environmentId: "slot.blitz", runtimeKind: "katana", runtimeName: "shared" })).toBe(
      "v1.7.1",
    );
  });

  test("rejects runtime tiers that would run multiple database writers", () => {
    expect(() =>
      resolveAwsRuntimeTier("basic", {
        basic: {
          ...resolveAwsRuntimeTier("basic"),
          desiredCount: 2,
        },
      } as never),
    ).toThrow('AWS runtime tier "basic" must keep desiredCount pinned to 1');
  });

  test("turns live AWS state into run-store artifacts", () => {
    expect(
      toAwsRuntimeArtifact({
        provider: "aws",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        serviceName: "slot-blitz-torii-bltz-fire-gate-42",
        status: "existing",
        endpointUrl: "https://runtime.realms.world/x/bltz-fire-gate-42/torii",
        tier: "basic",
        version: "v1.8.16",
        region: "us-east-1",
        clusterArn: "arn:aws:ecs:cluster/runtime",
        serviceArn: "arn:aws:ecs:service/runtime/bltz",
        taskDefinitionArn: "arn:aws:ecs:task-definition/torii:1",
        targetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/torii",
        efsAccessPointId: "fsap-123",
        imageDigest: `sha256:${"a".repeat(64)}`,
        health: {
          status: "healthy",
          checkedAt: "2026-06-22T00:00:00.000Z",
          endpoint: "https://runtime.realms.world/x/bltz-fire-gate-42/torii/health",
        },
      }),
    ).toEqual({
      schemaVersion: 2,
      provider: "aws",
      identity: undefined,
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      serviceName: "slot-blitz-torii-bltz-fire-gate-42",
      region: "us-east-1",
      clusterArn: "arn:aws:ecs:cluster/runtime",
      serviceArn: "arn:aws:ecs:service/runtime/bltz",
      taskDefinitionArn: "arn:aws:ecs:task-definition/torii:1",
      targetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/torii",
      efsAccessPointId: "fsap-123",
      endpointUrl: "https://runtime.realms.world/x/bltz-fire-gate-42/torii",
      tier: "basic",
      version: "v1.8.16",
      imageDigest: `sha256:${"a".repeat(64)}`,
      health: {
        status: "healthy",
        checkedAt: "2026-06-22T00:00:00.000Z",
        endpoint: "https://runtime.realms.world/x/bltz-fire-gate-42/torii/health",
      },
      environmentId: undefined,
      runtimeInstanceId: undefined,
      exposurePolicy: undefined,
      lifecycleClass: undefined,
      autoTeardown: undefined,
      deleteAfter: undefined,
      routingShard: undefined,
      routeHost: undefined,
      endpoints: undefined,
      snapshotStatus: {
        state: "unknown",
        restoredFromSnapshot: undefined,
      },
      deploymentTimestamps: {
        serviceCreatedAt: undefined,
        observedAt: undefined,
      },
      restoredFromSnapshot: undefined,
    });
  });

  test("inspect probes public runtime health instead of reporting unknown", async () => {
    configureAwsRuntimeEnv();
    const probedEndpoints: string[] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      return okAwsCommand();
    });

    const liveState = await describeAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
      },
      {
        backend,
        async healthProbe(endpoint) {
          probedEndpoints.push(endpoint);
          return {
            status: "healthy",
            checkedAt: "2026-07-04T00:00:00.000Z",
            endpoint,
          };
        },
      },
    );

    expect(probedEndpoints).toEqual(["https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/torii/health"]);
    expect(liveState.health).toEqual({
      status: "healthy",
      checkedAt: "2026-07-04T00:00:00.000Z",
      endpoint: "https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/torii/health",
    });
  });

  test("katana inspect probes the public rpc endpoint after health", async () => {
    configureAwsRuntimeEnv();
    const probedEndpoints: string[] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      return okAwsCommand();
    });

    const liveState = await describeAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "katana",
        runtimeName: "bltz-fire-gate-42",
      },
      {
        backend,
        async healthProbe(endpoint) {
          probedEndpoints.push(endpoint);
          return {
            status: "healthy",
            checkedAt: "2026-07-04T00:00:00.000Z",
            endpoint,
          };
        },
      },
    );

    expect(probedEndpoints).toEqual([
      "https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/katana/health",
      "https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/katana/rpc/v0_9",
    ]);
    expect(liveState.health).toMatchObject({
      status: "healthy",
      endpoint: "https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/katana/health",
    });
  });

  test("default katana rpc probe posts starknet_chainId", async () => {
    configureAwsRuntimeEnv();
    const fetchCalls: Array<{ url: string; method: string; body?: string }> = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({
        url: String(input),
        method: init?.method || "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });

      if (String(input).endsWith("/rpc/v0_9")) {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "SN_SEPOLIA" }), { status: 200 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      return okAwsCommand();
    });

    const liveState = await describeAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "katana",
        runtimeName: "bltz-fire-gate-42",
      },
      { backend },
    );

    expect(liveState.health?.status).toBe("healthy");
    expect(typeof liveState.health?.latencyMs).toBe("number");
    expect(liveState.health?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchCalls).toEqual([
      {
        url: "https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/katana/health",
        method: "GET",
        body: undefined,
      },
      {
        url: "https://runtime.realms.world/x/slot-blitz/bltz-fire-gate-42/katana/rpc/v0_9",
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_chainId", params: [] }),
      },
    ]);
  });

  test("inspect surfaces restored snapshot timestamps in the runtime artifact", async () => {
    configureAwsRuntimeEnv();
    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "logs filter-log-events") {
        return okAwsCommand(
          JSON.stringify({
            events: [
              {
                timestamp: 1783123200000,
                message:
                  "snapshot-restored: 2026-07-04T00:00:00.000Z environment=slot.blitz runtime=bltz-fire-gate-42 kind=torii",
              },
            ],
          }),
        );
      }

      return okAwsCommand();
    });

    const liveState = await describeAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
      },
      {
        backend,
        async healthProbe(endpoint) {
          return {
            status: "healthy",
            checkedAt: "2026-07-04T00:00:01.000Z",
            endpoint,
          };
        },
      },
    );

    expect(liveState.restoredFromSnapshot).toBe("2026-07-04T00:00:00.000Z");
    expect(toAwsRuntimeArtifact(liveState).restoredFromSnapshot).toBe("2026-07-04T00:00:00.000Z");
  });

  test("inspect ignores restored snapshot logs from an older service incarnation", async () => {
    configureAwsRuntimeEnv();
    const oldRestoreEvent = {
      timestamp: Date.parse("2026-07-04T00:00:00.000Z"),
      message:
        "snapshot-restored: 2026-07-04T00:00:00.000Z environment=slot.blitz runtime=bltz-fire-gate-42 kind=torii",
    };
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        const payload = JSON.parse(activeRuntimeServicePayload()) as { services: Array<Record<string, unknown>> };
        payload.services[0]!.createdAt = "2026-07-04T00:10:00.000Z";
        return okAwsCommand(JSON.stringify(payload));
      }

      if (args.slice(0, 2).join(" ") === "logs filter-log-events") {
        const startTime = Number(args[args.indexOf("--start-time") + 1] || "0");
        return okAwsCommand(
          JSON.stringify({
            events: startTime > oldRestoreEvent.timestamp ? [] : [oldRestoreEvent],
          }),
        );
      }

      return okAwsCommand();
    });

    const liveState = await describeAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
      },
      {
        backend,
        async healthProbe(endpoint) {
          return {
            status: "healthy",
            checkedAt: "2026-07-04T00:10:01.000Z",
            endpoint,
          };
        },
      },
    );

    const logCommand = commands.find((command) => command.slice(0, 2).join(" ") === "logs filter-log-events");
    expect(logCommand).toContain("--start-time");
    expect(liveState.restoredFromSnapshot).toBeUndefined();
  });

  test("builds create commands with EFS, task definition, ALB routing, and ECS service", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const serviceState = createServiceStateTracker();
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return serviceState.describe();
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs create-service") {
        serviceState.markCreated();
      }

      return okAwsCommand();
    });

    await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      rpcUrl: "https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9",
      worldAddress: "0x123",
      worldBlock: "98765",
      namespaces: "s1_eternum",
      tier: "basic",
    });

    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "efs describe-access-points",
      "efs create-access-point",
      "ecs describe-task-definition",
      "ecr describe-images",
      "ecs register-task-definition",
      "elbv2 describe-target-groups",
      "elbv2 create-target-group",
      "elbv2 describe-rules",
      "elbv2 describe-rules",
      "elbv2 create-rule",
      "ecs describe-services",
      "ecs create-service",
      "ecs describe-services",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "ecs list-task-definitions",
    ]);
    expect(commands[1]).toContain(
      "Path=/runtimes/slot-blitz-torii-bltz-fire-gate-42,CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=750}",
    );
    const registerCommand = findCommand(commands, "ecs register-task-definition");
    expect(registerCommand).toContain("--volumes");
    expect(registerCommand).toContain("--ephemeral-storage");
    expect(registerCommand).toContain(JSON.stringify({ sizeInGiB: 25 }));
    expect(registerCommand).toContain("--runtime-platform");
    expect(registerCommand).toContain("cpuArchitecture=X86_64,operatingSystemFamily=LINUX");
    expect(registerCommand).toContain("--pid-mode");
    expect(registerCommand).toContain("task");
    const containerDefinitions = JSON.parse(
      registerCommand[registerCommand.indexOf("--container-definitions") + 1],
    ) as Array<Record<string, unknown>>;
    const runtimeContainer = containerDefinitions.find((container) => container.name === "runtime");
    const checkpointContainer = containerDefinitions.find((container) => container.name === "runtime-checkpoint");
    expect(runtimeContainer).toMatchObject({
      essential: true,
      user: "1000:1000",
      readonlyRootFilesystem: true,
      stopTimeout: 120,
      linuxParameters: { capabilities: { drop: ["ALL"] } },
      healthCheck: { startPeriod: 90 },
    });
    expect(runtimeContainer?.environment).toContainEqual({ name: "TORII_WORLD_BLOCK", value: "98765" });
    expect(runtimeContainer?.mountPoints).toEqual(
      expect.arrayContaining([
        { sourceVolume: "runtime-working-data", containerPath: "/data", readOnly: false },
        { sourceVolume: "runtime-data", containerPath: "/snapshots", readOnly: false },
        { sourceVolume: "runtime-tmp", containerPath: "/tmp", readOnly: false },
        { sourceVolume: "runtime-control", containerPath: "/runtime-control", readOnly: false },
      ]),
    );
    expect(checkpointContainer).toMatchObject({
      essential: false,
      user: "1000:1000",
      readonlyRootFilesystem: false,
      entryPoint: ["/usr/local/bin/checkpoint-agent.sh", "serve"],
      linuxParameters: { capabilities: { drop: ["ALL"] } },
    });
    const volumes = readJsonArg<Array<{ name: string }>>(registerCommand, "--volumes");
    expect(volumes.map((volume) => volume.name)).toEqual([
      "runtime-working-data",
      "runtime-data",
      "runtime-tmp",
      "checkpoint-tmp",
      "runtime-control",
    ]);
    expect(findCommand(commands, "elbv2 create-target-group")).toContain(
      "/x/slot-blitz/bltz-fire-gate-42/torii/health",
    );
    expect(commands[9]).toContain(
      "Field=path-pattern,Values=/x/slot-blitz/bltz-fire-gate-42/torii,/x/slot-blitz/bltz-fire-gate-42/torii/*",
    );
    expect(commands[11]).toContain(
      "awsvpcConfiguration={subnets=[subnet-a,subnet-b],securityGroups=[sg-runtime],assignPublicIp=DISABLED}",
    );
    expect(commands[11]).toContain(
      "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=100,minimumHealthyPercent=0",
    );
    expect(commands[11]).toContain("--health-check-grace-period-seconds");
    expect(commands[11]).toContain("90");
    expect(commands[13]).toContain("slot-blitz-torii-bltz-fire-gate-42-unhealthy-hosts");
    expect(commands[13]).toContain("UnHealthyHostCount");
    expect(commands[13]).toContain("Name=LoadBalancer,Value=app/runtime/123");
    expect(commands[13]).toContain("Name=TargetGroup,Value=targetgroup/runtime/123");
    expect(commands[14]).toContain("slot-blitz-torii-bltz-fire-gate-42-target-5xx");
    expect(commands[14]).toContain("HTTPCode_Target_5XX_Count");
    expect(commands[14]).toContain("Name=LoadBalancer,Value=app/runtime/123");
    expect(commands[14]).toContain("Name=TargetGroup,Value=targetgroup/runtime/123");
    expect(commands[15]).toContain("slot-blitz-torii-bltz-fire-gate-42-running-tasks");
    expect(commands[15]).toContain("RunningTaskCount");
    expect(commands[15]).toContain("arn:aws:sns:us-east-1:123456789012:runtime-alerts");
  });

  test("sizes ECS health check start period for snapshot restore", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS = "240";
    const commands: string[][] = [];
    const serviceState = createServiceStateTracker();
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return serviceState.describe();
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs create-service") {
        serviceState.markCreated();
      }

      return okAwsCommand();
    });

    await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      rpcUrl: "https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9",
      worldAddress: "0x123",
      namespaces: "s1_eternum",
      tier: "basic",
    });

    const registerCommand = findCommand(commands, "ecs register-task-definition");
    const containerDefinitions = readJsonArg<Array<{ healthCheck: { startPeriod: number } }>>(
      registerCommand,
      "--container-definitions",
    );
    expect(containerDefinitions[0]?.healthCheck.startPeriod).toBe(240);
  });

  test("keeps ECS health check start period at least 90 seconds", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS = "30";
    const commands: string[][] = [];
    const serviceState = createServiceStateTracker();
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return serviceState.describe();
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs create-service") {
        serviceState.markCreated();
      }

      return okAwsCommand();
    });

    await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      rpcUrl: "https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9",
      worldAddress: "0x123",
      namespaces: "s1_eternum",
      tier: "basic",
    });

    const registerCommand = findCommand(commands, "ecs register-task-definition");
    const containerDefinitions = readJsonArg<Array<{ healthCheck: { startPeriod: number } }>>(
      registerCommand,
      "--container-definitions",
    );
    expect(containerDefinitions[0]?.healthCheck.startPeriod).toBe(90);
  });

  test("uses five second default timeout for public runtime health probes", () => {
    delete process.env.AWS_RUNTIME_HEALTH_TIMEOUT_MS;
    expect(resolveRuntimeHealthTimeoutMs()).toBe(5_000);

    process.env.AWS_RUNTIME_HEALTH_TIMEOUT_MS = "2500";
    expect(resolveRuntimeHealthTimeoutMs()).toBe(2_500);

    process.env.AWS_RUNTIME_HEALTH_TIMEOUT_MS = "not-a-number";
    expect(resolveRuntimeHealthTimeoutMs()).toBe(5_000);
  });

  test("uses runtime-specific default ECS service stability deadlines", () => {
    expect(resolveRuntimeStabilityDeadlineMs("katana")).toBe(10 * 60 * 1_000);
    expect(resolveRuntimeStabilityDeadlineMs("torii")).toBe(15 * 60 * 1_000);
  });

  test("polls ECS service state until one completed deployment reaches desired count", () => {
    const commands: string[][] = [];
    const serviceStates = [
      runtimeServiceStabilityPayload({
        deploymentRolloutState: "IN_PROGRESS",
        runningCount: 0,
        pendingCount: 1,
      }),
      runtimeServiceStabilityPayload({
        deploymentRolloutState: "COMPLETED",
        runningCount: 1,
        pendingCount: 0,
      }),
    ];

    waitForRuntimeServiceStable(
      (args) => {
        commands.push(args);
        return okAwsCommand(serviceStates.shift());
      },
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
      },
      { region: "us-east-1", cluster: "eternum-game-runtime" } as never,
      { deadlineMs: 1_000, pollIntervalMs: 0 },
    );

    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "ecs describe-services",
      "ecs describe-services",
    ]);
    expect(commands.map((command) => command.slice(0, 3).join(" "))).not.toContain("ecs wait services-stable");
  });

  test("classifies failed ECS rollouts before the stability deadline expires", () => {
    expect(() =>
      waitForRuntimeServiceStable(
        () =>
          okAwsCommand(
            runtimeServiceStabilityPayload({
              deploymentRolloutState: "FAILED",
              runningCount: 0,
              pendingCount: 0,
              rolloutStateReason: "ECS deployment circuit breaker was triggered",
            }),
          ),
        {
          environmentId: "slot.blitz",
          runtimeKind: "torii",
          runtimeName: "bltz-fire-gate-42",
        },
        { region: "us-east-1", cluster: "eternum-game-runtime" } as never,
        { deadlineMs: 1_000, pollIntervalMs: 0 },
      ),
    ).toThrow('AWS runtime "bltz-fire-gate-42" rollout failed: ECS deployment circuit breaker was triggered');
  });

  test("classifies ECS service stability polling deadline misses", () => {
    expect(() =>
      waitForRuntimeServiceStable(
        () =>
          okAwsCommand(
            runtimeServiceStabilityPayload({
              deploymentRolloutState: "IN_PROGRESS",
              runningCount: 0,
              pendingCount: 1,
            }),
          ),
        {
          environmentId: "slot.blitz",
          runtimeKind: "katana",
          runtimeName: "bltz-fire-gate-42",
        },
        { region: "us-east-1", cluster: "eternum-game-runtime" } as never,
        { deadlineMs: 0, pollIntervalMs: 0 },
      ),
    ).toThrow('wait for AWS runtime service stability "bltz-fire-gate-42" timed out after 0ms');
  });

  test("verifies immutable runtime image digests in ECR before registering task definitions", async () => {
    configureAwsRuntimeEnv();
    delete process.env.AWS_RUNTIME_ECR_IMAGE;
    process.env.AWS_RUNTIME_ECR_REPOSITORY_URL = "123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime";
    const imageDigest = `sha256:${"d".repeat(64)}`;

    const commands: string[][] = [];
    const serviceState = createServiceStateTracker();
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return serviceState.describe();
      }

      if (args.slice(0, 2).join(" ") === "ecr describe-images") {
        return okAwsCommand(JSON.stringify({ imageDetails: [{ imageDigest }] }));
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs create-service") {
        serviceState.markCreated();
      }

      return okAwsCommand();
    });

    await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      worldAddress: "0x123",
      version: "v1.8.17",
      imageDigest,
    });

    const ecrCommand = findCommand(commands, "ecr describe-images");
    expect(ecrCommand).toContain("--repository-name");
    expect(ecrCommand).toContain("eternum-runtime");
    expect(ecrCommand).toContain(`imageDigest=${imageDigest}`);

    const registerCommand = findCommand(commands, "ecs register-task-definition");
    const containers = readJsonArg<Array<{ image: string }>>(registerCommand, "--container-definitions");
    expect(containers[0].image).toBe(`123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime@${imageDigest}`);

    const createServiceCommand = findCommand(commands, "ecs create-service");
    expect(createServiceCommand).toContain(`key=ImageDigest,value=${imageDigest}`);
  });

  test("classifies missing immutable runtime images", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_ECR_REPOSITORY_URL = "123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime";
    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "ecr describe-images") {
        return failedAwsCommand(
          "An error occurred (ImageNotFoundException) when calling the DescribeImages operation: image not found",
        );
      }

      return okAwsCommand();
    });

    await expect(
      backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        imageDigest: `sha256:${"e".repeat(64)}`,
      }),
    ).rejects.toThrow(/image not found/i);

    expect(classifyAwsRuntimeFailure(new Error("AWS runtime image not found: v9.9.9"))).toBe("image-not-found");
  });

  test("rejects tag-only emergency runtime images", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_ECR_IMAGE = "123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime:v1.8.17";
    const backend = createAwsRuntimeCommandBackend(() => okAwsCommand());

    await expect(
      backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        version: "v1.8.17",
      }),
    ).rejects.toThrow("AWS_RUNTIME_ECR_IMAGE must be pinned");
  });

  test("classifies ECS service-stability polling timeouts separately from health failures", () => {
    expect(
      classifyAwsRuntimeFailure(
        new Error('Failed to wait for AWS runtime service stability "bltz-fire-gate-42": Waiter ServicesStable failed'),
      ),
    ).toBe("stabilization-timeout");

    expect(
      classifyAwsRuntimeFailure(new Error('AWS runtime "bltz-fire-gate-42" rollout failed health check at /health')),
    ).toBe("rollout-failed");
  });

  test("allocates the first free listener rule priority", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const serviceState = createServiceStateTracker();
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return serviceState.describe();
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [{ Priority: "10000" }, { Priority: "10001" }] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs create-service") {
        serviceState.markCreated();
      }

      return okAwsCommand();
    });

    await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      worldAddress: "0x123",
    });

    const createRuleCommand = findCommand(commands, "elbv2 create-rule");
    expect(createRuleCommand[createRuleCommand.indexOf("--priority") + 1]).toBe("10002");
  });

  test("deploys two runtimes that share the same listener rule priority base with distinct priorities", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const createdServices = new Set<string>();
    const listenerRules: Array<Record<string, unknown>> = [];

    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);
      const command = args.slice(0, 2).join(" ");

      if (command === "ecs describe-services") {
        const serviceName = args[args.indexOf("--services") + 1];
        return okAwsCommand(
          createdServices.has(serviceName || "")
            ? runtimeServiceStabilityPayload({
                deploymentRolloutState: "COMPLETED",
                runningCount: 1,
                pendingCount: 0,
              })
            : JSON.stringify({ services: [] }),
        );
      }

      if (command === "ecs create-service") {
        createdServices.add(args[args.indexOf("--service-name") + 1] || "");
      }

      if (command === "efs create-access-point") {
        return okAwsCommand(`fsap-${commands.length}\n`);
      }

      if (command === "ecs register-task-definition") {
        const family = args[args.indexOf("--family") + 1] || "runtime";
        return okAwsCommand(`arn:aws:ecs:task-definition/${family}:1\n`);
      }

      if (command === "elbv2 describe-target-groups") {
        return okAwsCommand(JSON.stringify({ TargetGroups: [] }));
      }

      if (command === "elbv2 create-target-group") {
        const targetGroupName = args[args.indexOf("--name") + 1] || "runtime";
        return okAwsCommand(`arn:aws:elasticloadbalancing:targetgroup/${targetGroupName}/123\n`);
      }

      if (command === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: listenerRules }));
      }

      if (command === "elbv2 create-rule") {
        const ruleArn = `arn:aws:elasticloadbalancing:listener-rule/runtime/${listenerRules.length + 1}`;
        listenerRules.push({
          RuleArn: ruleArn,
          Priority: args[args.indexOf("--priority") + 1],
          Conditions: [{ Field: "path-pattern", Values: extractCreateRulePathValues(args) }],
          Actions: [{ Type: "forward", TargetGroupArn: extractForwardTargetGroupArn(args) }],
        });
      }

      return okAwsCommand();
    });

    for (const runtimeName of ["priority-alpha", "priority-beta"]) {
      await backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName,
        worldAddress: "0x123",
      });
    }

    const createRulePriorities = commands
      .filter((command) => command.slice(0, 2).join(" ") === "elbv2 create-rule")
      .map((command) => command[command.indexOf("--priority") + 1]);

    expect(createRulePriorities).toEqual(["10000", "10001"]);
  });

  test("retries listener rule creation when a concurrent deploy claims the allocated priority", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const serviceState = createServiceStateTracker();
    let describeRulesCalls = 0;
    let createRuleCalls = 0;
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return serviceState.describe();
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        describeRulesCalls += 1;
        const priorities = describeRulesCalls >= 3 ? [{ Priority: "10000" }] : [];
        return okAwsCommand(JSON.stringify({ Rules: priorities }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-rule") {
        createRuleCalls += 1;
        return createRuleCalls === 1
          ? failedAwsCommand("An error occurred (PriorityInUse) when calling the CreateRule operation")
          : okAwsCommand();
      }

      if (args.slice(0, 2).join(" ") === "ecs create-service") {
        serviceState.markCreated();
      }

      return okAwsCommand();
    });

    await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      worldAddress: "0x123",
    });

    const createRulePriorities = commands
      .filter((command) => command.slice(0, 2).join(" ") === "elbv2 create-rule")
      .map((command) => command[command.indexOf("--priority") + 1]);
    expect(createRulePriorities).toEqual(["10000", "10001"]);
  });

  test("fails a create rollout when public runtime health is unhealthy after ECS stability", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_VERIFY_PUBLIC_HEALTH = "1";
    const serviceState = createServiceStateTracker();
    const backend = createAwsRuntimeCommandBackend(
      (args) => {
        if (args.slice(0, 2).join(" ") === "ecs describe-services") {
          return serviceState.describe();
        }

        if (args.slice(0, 2).join(" ") === "efs create-access-point") {
          return okAwsCommand("fsap-123\n");
        }

        if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
          return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
        }

        if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
          return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
        }

        if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
          return okAwsCommand(JSON.stringify({ Rules: [] }));
        }

        if (args.slice(0, 2).join(" ") === "ecs create-service") {
          serviceState.markCreated();
        }

        return okAwsCommand();
      },
      {
        async healthProbe(endpoint) {
          return {
            status: "unhealthy",
            checkedAt: "2026-07-04T00:00:00.000Z",
            endpoint,
            details: "http 503",
          };
        },
      },
    );

    await expect(
      backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        worldAddress: "0x123",
      }),
    ).rejects.toThrow(/rollout failed health check.*http 503/);
  });

  test("create adopts existing runtime resources instead of duplicating them", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(
          JSON.stringify({
            AccessPoints: [
              {
                AccessPointId: "fsap-123",
                RootDirectory: {
                  Path: "/runtimes/slot-blitz-torii-bltz-fire-gate-42",
                },
                Tags: [
                  { Key: "Project", Value: "eternum" },
                  { Key: "Environment", Value: "slot.blitz" },
                  { Key: "RuntimeKind", Value: "torii" },
                  { Key: "RuntimeName", Value: "bltz-fire-gate-42" },
                  { Key: "RuntimeServiceName", Value: "slot-blitz-torii-bltz-fire-gate-42" },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(
          JSON.stringify({
            TargetGroups: [
              {
                TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(
          JSON.stringify({
            Rules: [
              {
                RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/123",
                Conditions: [
                  {
                    Field: "path-pattern",
                    Values: ["/x/slot-blitz/bltz-fire-gate-42/torii", "/x/slot-blitz/bltz-fire-gate-42/torii/*"],
                  },
                ],
                Actions: [
                  {
                    Type: "forward",
                    TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
                  },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      return okAwsCommand();
    });

    const adopted = await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      worldAddress: "0x123",
    });

    expect(adopted).toEqual(["access-point", "target-group", "listener-rule", "service"]);
    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "efs describe-access-points",
      "ecs describe-task-definition",
      "ecr describe-images",
      "ecs register-task-definition",
      "elbv2 describe-target-groups",
      "elbv2 describe-tags",
      "elbv2 describe-rules",
      "elbv2 describe-tags",
      "ecs describe-services",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "ecs list-task-definitions",
    ]);
  });

  test("create does not adopt an EFS access point owned by another runtime", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const serviceState = createServiceStateTracker();
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return serviceState.describe();
      }

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(
          JSON.stringify({
            AccessPoints: [
              {
                AccessPointId: "fsap-foreign",
                RootDirectory: {
                  Path: "/runtimes/slot-blitz-torii-bltz-fire-gate-42",
                },
                Tags: [{ Key: "RuntimeServiceName", Value: "slot-blitz-torii-other-runtime" }],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs create-service") {
        serviceState.markCreated();
      }

      return okAwsCommand();
    });

    const adopted = await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      worldAddress: "0x123",
    });

    expect(adopted).not.toContain("access-point");
    expect(commands.map((command) => command.slice(0, 2).join(" "))).toContain("efs create-access-point");
  });

  test("create rejects a target group owned by another runtime", async () => {
    configureAwsRuntimeEnv();
    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(JSON.stringify({ AccessPoints: [] }));
      }

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(
          JSON.stringify({
            TargetGroups: [
              {
                TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/foreign",
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-tags") {
        return okAwsCommand(
          JSON.stringify({
            TagDescriptions: [
              {
                Tags: [{ Key: "RuntimeServiceName", Value: "slot-blitz-torii-other-runtime" }],
              },
            ],
          }),
        );
      }

      return okAwsCommand();
    });

    await expect(
      backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        worldAddress: "0x123",
      }),
    ).rejects.toThrow(/target group.*belongs to "slot-blitz-torii-other-runtime"/);
  });

  test("create retries after partial failure without duplicating runtime resources", async () => {
    const failureSteps = ["access-point", "task-definition", "target-group", "listener-rule", "service"] as const;

    for (const failureStep of failureSteps) {
      configureAwsRuntimeEnv();
      const commands: string[][] = [];
      const created = {
        accessPoint: false,
        taskDefinition: false,
        targetGroup: false,
        listenerRule: false,
        service: false,
      };
      let failurePending = true;
      const backend = createAwsRuntimeCommandBackend((args) => {
        commands.push(args);
        const command = args.slice(0, 2).join(" ");

        if (command === "efs describe-access-points") {
          return okAwsCommand(
            JSON.stringify({ AccessPoints: created.accessPoint ? [taggedAccessPointPayload()] : [] }),
          );
        }

        if (command === "efs create-access-point") {
          created.accessPoint = true;
          return completeCreateStep("access-point", failureStep, failurePending, () => {
            failurePending = false;
          });
        }

        if (command === "ecs describe-task-definition") {
          return created.taskDefinition
            ? okAwsCommand(activeRuntimeTaskDefinitionPayload("fsap-123", { worldAddress: "0x123" }))
            : failedAwsCommand("ClientException: Unable to describe task definition");
        }

        if (command === "ecs register-task-definition") {
          created.taskDefinition = true;
          return completeCreateStep("task-definition", failureStep, failurePending, () => {
            failurePending = false;
          });
        }

        if (command === "elbv2 describe-target-groups") {
          return okAwsCommand(
            JSON.stringify({
              TargetGroups: created.targetGroup
                ? [{ TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123" }]
                : [],
            }),
          );
        }

        if (command === "elbv2 create-target-group") {
          created.targetGroup = true;
          return completeCreateStep("target-group", failureStep, failurePending, () => {
            failurePending = false;
          });
        }

        if (command === "elbv2 describe-rules") {
          return okAwsCommand(
            JSON.stringify({
              Rules: created.listenerRule
                ? [
                    {
                      RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/123",
                      Conditions: [
                        {
                          Field: "path-pattern",
                          Values: ["/x/slot-blitz/bltz-fire-gate-42/torii", "/x/slot-blitz/bltz-fire-gate-42/torii/*"],
                        },
                      ],
                      Actions: [
                        {
                          Type: "forward",
                          TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
                        },
                      ],
                    },
                  ]
                : [],
            }),
          );
        }

        if (command === "elbv2 describe-tags") {
          return okAwsCommand(
            JSON.stringify({
              TagDescriptions: [
                {
                  Tags: [{ Key: "RuntimeServiceName", Value: "slot-blitz-torii-bltz-fire-gate-42" }],
                },
              ],
            }),
          );
        }

        if (command === "elbv2 create-rule") {
          created.listenerRule = true;
          return completeCreateStep("listener-rule", failureStep, failurePending, () => {
            failurePending = false;
          });
        }

        if (command === "ecs describe-services") {
          return okAwsCommand(created.service ? activeRuntimeServicePayload() : JSON.stringify({ services: [] }));
        }

        if (command === "ecs create-service") {
          created.service = true;
          return completeCreateStep("service", failureStep, failurePending, () => {
            failurePending = false;
          });
        }

        return okAwsCommand();
      });

      await expect(createBlitzToriiRuntime(backend)).rejects.toThrow(`${failureStep} interrupted`);
      const adopted = await createBlitzToriiRuntime(backend);

      expect(Array.isArray(adopted), failureStep).toBe(true);
      expect(countCommands(commands, "efs create-access-point"), failureStep).toBeLessThanOrEqual(1);
      expect(countCommands(commands, "ecs register-task-definition"), failureStep).toBeLessThanOrEqual(1);
      expect(countCommands(commands, "elbv2 create-target-group"), failureStep).toBeLessThanOrEqual(1);
      expect(countCommands(commands, "elbv2 create-rule"), failureStep).toBeLessThanOrEqual(1);
      expect(countCommands(commands, "ecs create-service"), failureStep).toBeLessThanOrEqual(1);
      expect(failurePending, failureStep).toBe(false);
    }
  });

  test("create rejects listener rules whose path belongs to another runtime", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(
          JSON.stringify({
            AccessPoints: [
              {
                AccessPointId: "fsap-123",
                RootDirectory: {
                  Path: "/runtimes/slot-blitz-torii-bltz-fire-gate-42",
                },
                Tags: [
                  { Key: "Project", Value: "eternum" },
                  { Key: "Environment", Value: "slot.blitz" },
                  { Key: "RuntimeKind", Value: "torii" },
                  { Key: "RuntimeName", Value: "bltz-fire-gate-42" },
                  { Key: "RuntimeServiceName", Value: "slot-blitz-torii-bltz-fire-gate-42" },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(
          JSON.stringify({
            TargetGroups: [
              {
                TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(
          JSON.stringify({
            Rules: [
              {
                RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/conflict",
                Conditions: [
                  {
                    Field: "path-pattern",
                    Values: ["/x/slot-blitz/bltz-fire-gate-42/torii", "/x/slot-blitz/bltz-fire-gate-42/torii/*"],
                  },
                ],
                Actions: [
                  {
                    Type: "forward",
                    TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/other",
                  },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-tags") {
        return okAwsCommand(
          JSON.stringify({
            TagDescriptions: [
              {
                ResourceArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/conflict",
                Tags: [{ Key: "RuntimeServiceName", Value: "slot-blitz-torii-other-runtime" }],
              },
            ],
          }),
        );
      }

      return okAwsCommand();
    });

    await expect(
      backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        worldAddress: "0x123",
      }),
    ).rejects.toThrow(/listener rule.*belongs to "slot-blitz-torii-other-runtime"/);

    expect(commands.map((command) => command.slice(0, 2).join(" "))).not.toContain("ecs describe-services");
  });

  test("created runtime result includes adopted resources", async () => {
    const states = [
      {
        provider: "aws" as const,
        runtimeKind: "torii" as const,
        runtimeName: "bltz",
        serviceName: "svc",
        status: "missing" as const,
      },
      {
        provider: "aws" as const,
        runtimeKind: "torii" as const,
        runtimeName: "bltz",
        serviceName: "svc",
        status: "existing" as const,
      },
    ];

    const result = await ensureAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz",
        runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-000000000010",
        imageDigest: `sha256:${"a".repeat(64)}`,
        exposurePolicy: "public-read",
      },
      {
        backend: {
          async describeRuntime() {
            return states.shift()!;
          },
          async createRuntime() {
            return ["access-point"];
          },
          async updateRuntimeTier() {},
          async deleteRuntime() {
            return [];
          },
        },
      },
    );

    expect(result.action).toBe("created");
    expect(result.adopted).toEqual(["access-point"]);
  });

  test("CLI carries external contracts into the Torii task definition", () => {
    configureAwsRuntimeEnv();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-cli-"));
    const commandLogPath = path.join(tempDir, "commands.jsonl");
    const statePath = path.join(tempDir, "state.json");
    writeFakeAwsCli(tempDir);

    const result = spawnSync(
      "bun",
      [
        "config/deployer/clean/cli/aws-runtime.ts",
        "--operation",
        "deploy",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "torii",
        "--runtime-name",
        "bltz-fire-gate-42",
        "--runtime-instance-id",
        "018f6e54-5f4a-7ae2-a0ff-000000000001",
        "--rpc-url",
        "https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9",
        "--world-address",
        "0x123",
        "--external-contracts",
        "erc20:0xabc\nerc721:0xdef",
        "--image-digest",
        `sha256:${"a".repeat(64)}`,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_COMMAND_LOG: commandLogPath,
          AWS_STATE_FILE: statePath,
          PATH: `${tempDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(0);
    const registerCommand = findCommand(readLoggedAwsCommands(commandLogPath), "ecs register-task-definition");
    const containers = readJsonArg<Array<{ environment: Array<{ name: string; value: string }> }>>(
      registerCommand,
      "--container-definitions",
    );
    expect(containers[0]?.environment).toContainEqual({
      name: "TORII_EXTERNAL_CONTRACTS",
      value: "erc20:0xabc\nerc721:0xdef",
    });
  });

  test("CLI request files preserve shell-like payloads without executing them", () => {
    configureAwsRuntimeEnv();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-cli-request-"));
    const commandLogPath = path.join(tempDir, "commands.jsonl");
    const statePath = path.join(tempDir, "state.json");
    const markerPath = path.join(tempDir, "payload-executed");
    const requestPath = path.join(tempDir, "request.json");
    const injectedVersion = `v1.8.17; touch ${markerPath}`;
    writeFakeAwsCli(tempDir);
    fs.writeFileSync(
      requestPath,
      JSON.stringify({
        version: injectedVersion,
        worldAddress: "0x123",
        externalContracts: ["erc20:0xabc", "$(touch should-not-run)\n`uname`"],
      }),
    );

    const result = spawnSync(
      "bun",
      [
        "config/deployer/clean/cli/aws-runtime.ts",
        "--operation",
        "deploy",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "torii",
        "--runtime-name",
        "bltz-fire-gate-42",
        "--runtime-instance-id",
        "018f6e54-5f4a-7ae2-a0ff-000000000002",
        "--request-file",
        requestPath,
        "--image-digest",
        `sha256:${"a".repeat(64)}`,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_COMMAND_LOG: commandLogPath,
          AWS_STATE_FILE: statePath,
          PATH: `${tempDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(fs.existsSync(markerPath)).toBe(false);
    const registerCommand = findCommand(readLoggedAwsCommands(commandLogPath), "ecs register-task-definition");
    const containers = readJsonArg<Array<{ environment: Array<{ name: string; value: string }> }>>(
      registerCommand,
      "--container-definitions",
    );
    expect(containers[0]?.environment).toContainEqual({
      name: "TORII_EXTERNAL_CONTRACTS",
      value: "erc20:0xabc\n$(touch should-not-run)\n`uname`",
    });
    expect(registerCommand).toContain(`key=RuntimeVersion,value=${injectedVersion}`);
  });

  test("CLI rejects unsupported request-file fields before invoking AWS", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-cli-request-"));
    const requestPath = path.join(tempDir, "request.json");
    fs.writeFileSync(requestPath, JSON.stringify({ worldAddress: "0x123", unexpectedCommand: "uname" }));

    const result = spawnSync(
      "bun",
      [
        "config/deployer/clean/cli/aws-runtime.ts",
        "--operation",
        "deploy",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "torii",
        "--runtime-name",
        "bltz-fire-gate-42",
        "--runtime-instance-id",
        "018f6e54-5f4a-7ae2-a0ff-000000000003",
        "--request-file",
        requestPath,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
      },
    );

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      failureClassification: "runtime-validation",
      errorMessage: 'AWS runtime request file contains unsupported field "unexpectedCommand"',
    });
  });

  test("CLI validates torii deploy after applying environment rpc defaults", () => {
    configureAwsRuntimeEnv();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-cli-"));
    const commandLogPath = path.join(tempDir, "commands.jsonl");
    const statePath = path.join(tempDir, "state.json");
    writeFakeAwsCli(tempDir);

    const result = spawnSync(
      "bun",
      [
        "config/deployer/clean/cli/aws-runtime.ts",
        "--operation",
        "deploy",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "torii",
        "--runtime-name",
        "bltz-fire-gate-42",
        "--runtime-instance-id",
        "018f6e54-5f4a-7ae2-a0ff-000000000004",
        "--world-address",
        "0x123",
        "--image-digest",
        `sha256:${"a".repeat(64)}`,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_COMMAND_LOG: commandLogPath,
          AWS_STATE_FILE: statePath,
          PATH: `${tempDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(0);
    const registerCommand = findCommand(readLoggedAwsCommands(commandLogPath), "ecs register-task-definition");
    const containers = readJsonArg<Array<{ environment: Array<{ name: string; value: string }> }>>(
      registerCommand,
      "--container-definitions",
    );
    expect(containers[0]?.environment).toContainEqual({
      name: "RPC_URL",
      value: "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
    });
  });

  test("CLI success stdout includes the validated artifact health contract", () => {
    configureAwsRuntimeEnv();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-cli-"));
    const commandLogPath = path.join(tempDir, "commands.jsonl");
    const statePath = path.join(tempDir, "state.json");
    writeFakeAwsCli(tempDir);

    const result = spawnSync(
      "bun",
      [
        "config/deployer/clean/cli/aws-runtime.ts",
        "--operation",
        "deploy",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "torii",
        "--runtime-name",
        "bltz-fire-gate-42",
        "--runtime-instance-id",
        "018f6e54-5f4a-7ae2-a0ff-000000000005",
        "--world-address",
        "0x123",
        "--image-digest",
        `sha256:${"a".repeat(64)}`,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_COMMAND_LOG: commandLogPath,
          AWS_STATE_FILE: statePath,
          PATH: `${tempDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.health).toEqual(payload.liveState.health);
    expect(payload.health).toEqual(payload.artifact.health);
    expect(["healthy", "unhealthy", "unknown"]).toContain(payload.health.status);
  });

  test("CLI failure stdout includes the validated failure contract", () => {
    const result = spawnSync(
      "bun",
      [
        "config/deployer/clean/cli/aws-runtime.ts",
        "--operation",
        "deploy",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "torii",
        "--runtime-name",
        "bltz-fire-gate-42",
        "--runtime-instance-id",
        "018f6e54-5f4a-7ae2-a0ff-000000000006",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
      },
    );

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({
      operation: "deploy",
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      failureClassification: "runtime-validation",
    });
    expect(payload.errorMessage).toContain("Torii AWS runtime deploy requires --world-address");
    expect(Number.isFinite(Date.parse(payload.failedAt))).toBe(true);
  });

  test("CLI failure schema accepts every failure classification and rejects unknown enum values", () => {
    const classifiedErrors = [
      ["missing-foundation-config", new Error("Missing AWS runtime foundation config: AWS_RUNTIME_ECR_IMAGE")],
      ["aws-command-failed", new Error("Failed to run aws ecs create-service: aws exited with code 255")],
      ["image-not-found", new Error("AWS runtime image not found: v9.9.9")],
      ["rollout-failed", new Error("rollout failed health check for https://runtime.example.test/health")],
      ["stabilization-timeout", new Error("wait for AWS runtime service stability timed out after 600000ms")],
      ["runtime-state-indeterminate", new Error("Unable to verify AWS runtime after describe-services")],
      ["runtime-validation", new Error("Torii AWS runtime deploy requires --world-address")],
      ["unknown", new Error("unexpected runtime error")],
    ] as const;

    for (const [classification, error] of classifiedErrors) {
      const result = buildFailureResult(error, {
        operation: "deploy",
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
      });

      expect(result.failureClassification).toBe(classification);
      expect(() => validateCliResult(result)).not.toThrow();
    }

    expect(() =>
      validateCliResult({
        failureClassification: "not-a-real-classification",
        errorMessage: "bad schema",
        failedAt: new Date().toISOString(),
      } as never),
    ).toThrow("AWS runtime CLI failure result has unsupported classification");
  });

  test("CLI success schema rejects unsupported enum values", () => {
    const liveState = {
      provider: "aws",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      serviceName: "slot-blitz-torii-bltz-fire-gate-42",
      status: "existing",
    } as const;
    const validResult = {
      operation: "deploy",
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
      action: "created",
      mode: "aws-ecs",
      requestedTier: "basic",
      liveState,
      artifact: toAwsRuntimeArtifact(liveState),
    };

    expect(() => validateCliResult({ ...validResult, operation: "promote" } as never)).toThrow(
      "AWS runtime CLI result has unsupported operation",
    );
    expect(() => validateCliResult({ ...validResult, environmentId: "slot.unlisted" } as never)).toThrow(
      "AWS runtime CLI result has unsupported environmentId",
    );
    expect(() => validateCliResult({ ...validResult, runtimeKind: "server" } as never)).toThrow(
      "AWS runtime CLI result has unsupported runtimeKind",
    );
    expect(() => validateCliResult({ ...validResult, action: "promoted" } as never)).toThrow(
      "AWS runtime CLI result has unsupported action",
    );
    expect(() => validateCliResult({ ...validResult, requestedTier: "extreme" } as never)).toThrow(
      "AWS runtime CLI result has unsupported requestedTier",
    );
    expect(() =>
      validateCliResult({
        ...validResult,
        artifact: {
          ...validResult.artifact,
          status: "missing",
        },
      } as never),
    ).toThrow("AWS runtime CLI result artifact does not match live state");
  });

  test("updates service tags when resizing a runtime tier", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-task-definition") {
        return okAwsCommand(activeTaskDefinitionPayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      return okAwsCommand();
    });

    await backend.updateRuntimeTier({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      tier: "epic",
    });

    const tagCommand = findCommand(commands, "ecs tag-resource");
    expect(tagCommand).toContain("arn:aws:ecs:service/runtime/bltz-fire-gate-42");
    expect(tagCommand).toContain("key=RuntimeTier,value=epic");
  });

  test("resizes by cloning live task definition configuration", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-task-definition") {
        return okAwsCommand(activeTaskDefinitionPayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      return okAwsCommand();
    });

    await backend.updateRuntimeTier({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      tier: "epic",
    });

    const registerCommand = findCommand(commands, "ecs register-task-definition");
    const taskDefinition = readJsonArg<{
      cpu: string;
      memory: string;
      ephemeralStorage: { sizeInGiB: number };
      pidMode?: string;
      runtimePlatform?: { cpuArchitecture: string; operatingSystemFamily: string };
      containerDefinitions: Array<{ environment: Array<{ name: string; value: string }> }>;
      taskDefinitionArn?: string;
      revision?: number;
      status?: string;
    }>(registerCommand, "--cli-input-json");

    expect(taskDefinition.cpu).toBe("4096");
    expect(taskDefinition.memory).toBe("8192");
    expect(taskDefinition.ephemeralStorage).toEqual({ sizeInGiB: 100 });
    expect(taskDefinition.pidMode).toBe("task");
    expect(taskDefinition.runtimePlatform).toEqual({
      cpuArchitecture: "X86_64",
      operatingSystemFamily: "LINUX",
    });
    expect(taskDefinition.containerDefinitions[0]?.environment).toContainEqual({
      name: "RPC_URL",
      value: "https://rpc.example.test",
    });
    expect(taskDefinition.containerDefinitions[0]?.environment).toContainEqual({
      name: "WORLD_ADDRESS",
      value: "0xabc",
    });
    expect(taskDefinition.taskDefinitionArn).toBeUndefined();
    expect(taskDefinition.revision).toBeUndefined();
    expect(taskDefinition.status).toBeUndefined();
    expect(commands.some((command) => command.slice(0, 2).join(" ") === "ecs list-task-definitions")).toBe(true);
  });

  test("rejects resize requests that would silently ignore an image change", async () => {
    configureAwsRuntimeEnv();
    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }
      if (args.slice(0, 2).join(" ") === "ecs describe-task-definition") {
        return okAwsCommand(activeTaskDefinitionPayload());
      }
      return okAwsCommand();
    });

    await expect(
      backend.updateRuntimeTier({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        tier: "epic",
        imageDigest: `sha256:${"b".repeat(64)}`,
      }),
    ).rejects.toThrow("resize must use its live image digest");
  });

  test("deploy reconciles existing runtime environment drift", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS = "240";
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-task-definition") {
        return okAwsCommand(activeTaskDefinitionPayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs list-tasks") {
        return okAwsCommand(JSON.stringify({ taskArns: ["arn:aws:ecs:task/runtime/task-123"] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs execute-command") {
        const correlationId = /checkpoint ([0-9a-f-]+)$/.exec(args.at(-1) || "")?.[1];
        return okAwsCommand(`checkpoint-complete:${correlationId} checksum=abc123`);
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      return okAwsCommand();
    });

    const result = await ensureAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        rpcUrl: "https://rpc.changed.example.test",
        worldAddress: "0xabc",
        tier: "basic",
        imageDigest: `sha256:${"a".repeat(64)}`,
        exposurePolicy: "public-read",
      },
      { backend },
    );

    expect(result.action).toBe("updated");
    expect(result.diff).toEqual({
      envChangedKeys: ["RPC_URL"],
    });

    const registerCommand = findCommand(commands, "ecs register-task-definition");
    const containers = readJsonArg<Array<{ environment: Array<{ name: string; value: string }> }>>(
      registerCommand,
      "--container-definitions",
    );
    expect(containers[0]?.environment).toContainEqual({
      name: "RPC_URL",
      value: "https://rpc.changed.example.test",
    });
    expect(findCommand(commands, "ecs update-service")).toContain(
      "arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2",
    );
    expect(findCommand(commands, "ecs update-service")).toContain(
      "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=100,minimumHealthyPercent=0",
    );
    expect(findCommand(commands, "ecs update-service")).toContain("--health-check-grace-period-seconds");
    expect(findCommand(commands, "ecs update-service")).toContain("240");
    expect(commands.map((command) => command.slice(0, 3).join(" "))).not.toContain("ecs wait services-stable");
    expect(countCommands(commands, "ecs describe-services")).toBe(3);
  });

  test("deploy leaves existing runtime unchanged when desired state matches", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-task-definition") {
        return okAwsCommand(activeTaskDefinitionPayload());
      }

      return okAwsCommand();
    });

    const result = await ensureAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        rpcUrl: "https://rpc.example.test",
        worldAddress: "0xabc",
        tier: "basic",
        imageDigest: `sha256:${"a".repeat(64)}`,
        exposurePolicy: "public-read",
      },
      { backend },
    );

    expect(result.action).toBe("already-live");
    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "ecs describe-services",
      "ecs describe-task-definition",
      "ecs tag-resource",
      "ecs untag-resource",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "cloudwatch put-metric-alarm",
      "logs filter-log-events",
    ]);
    expect(findCommand(commands, "ecs untag-resource")).toContain("RetainRuntime");
  });

  test("deploy reconciles existing runtime tier drift", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-task-definition") {
        return okAwsCommand(activeTaskDefinitionPayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs list-tasks") {
        return okAwsCommand(JSON.stringify({ taskArns: ["arn:aws:ecs:task/runtime/task-123"] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs execute-command") {
        const correlationId = /checkpoint ([0-9a-f-]+)$/.exec(args.at(-1) || "")?.[1];
        return okAwsCommand(`checkpoint-complete:${correlationId} checksum=abc123`);
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      return okAwsCommand();
    });

    const result = await ensureAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        rpcUrl: "https://rpc.example.test",
        worldAddress: "0xabc",
        tier: "epic",
        imageDigest: `sha256:${"a".repeat(64)}`,
        exposurePolicy: "public-read",
      },
      { backend },
    );

    expect(result.action).toBe("updated");
    expect(result.diff).toEqual({
      tier: { from: "basic", to: "epic" },
    });
    expect(findCommand(commands, "ecs register-task-definition")).toContain(JSON.stringify({ sizeInGiB: 100 }));
  });

  test("deletes AWS routing, storage, and ECS resources for a runtime", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(
          activeRuntimeServicePayload([
            { key: "RuntimeInstanceId", value: TEST_RUNTIME_INSTANCE_ID },
            { key: "DeleteAfter", value: EXPIRED_DELETE_AFTER },
            { key: "LifecycleClass", value: "ephemeral" },
            { key: "AutoTeardown", value: "true" },
          ]),
        );
      }

      if (args.slice(0, 2).join(" ") === "ecs list-tasks") {
        return okAwsCommand(JSON.stringify({ taskArns: ["arn:aws:ecs:task/runtime/task-123"] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs execute-command") {
        const checkpointCommand = args[args.indexOf("--command") + 1] || "";
        const correlationId = checkpointCommand.split(" ").at(-1);
        return okAwsCommand(`checkpoint-complete:${correlationId}`);
      }

      if (args.slice(0, 2).join(" ") === "cloudwatch describe-alarms") {
        return okAwsCommand(JSON.stringify({ MetricAlarms: [{ AlarmName: "runtime-alarm" }] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(
          JSON.stringify({
            Rules: [
              {
                RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/123",
                Priority: "10234",
                Conditions: [
                  {
                    Field: "path-pattern",
                    Values: ["/x/slot-blitz/bltz-fire-gate-42/torii", "/x/slot-blitz/bltz-fire-gate-42/torii/*"],
                  },
                ],
                Actions: [
                  {
                    Type: "forward",
                    TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
                  },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "ecs run-task") {
        return okAwsCommand("arn:aws:ecs:us-east-1:123456789012:task/runtime/cleanup-task\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-tasks") {
        return okAwsCommand(
          JSON.stringify({
            tasks: [
              {
                containers: [
                  {
                    name: "runtime",
                    exitCode: 0,
                  },
                ],
              },
            ],
          }),
        );
      }

      return okAwsCommand();
    });

    await backend.deleteRuntime({
      ...TEST_DELETE_IDENTITY,
      expectedDeleteAfter: EXPIRED_DELETE_AFTER,
    });

    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "ecs describe-services",
      "ecs list-tasks",
      "ecs execute-command",
      "cloudwatch describe-alarms",
      "cloudwatch delete-alarms",
      "elbv2 describe-rules",
      "elbv2 describe-tags",
      "elbv2 delete-rule",
      "ecs delete-service",
      "ecs wait",
      "elbv2 delete-target-group",
      "ecs run-task",
      "ecs wait",
      "ecs describe-tasks",
      "efs delete-access-point",
      "ecs list-task-definitions",
      "ecs list-task-definitions",
    ]);
  });

  test("deletes the matching expired runtime while protecting shared owner-tagged runtimes", async () => {
    configureAwsRuntimeEnv();
    const runtimeInstanceId = "018f6e54-5f4a-7ae2-a0ff-000000000011";
    const expectedDeleteAfter = new Date(Date.now() - 60_000).toISOString();
    const deletedRequests: Array<{ runtimeKind: string; runtimeName: string }> = [];
    const commandRunner = (args: string[]) => {
      if (args.slice(0, 2).join(" ") === "ecs list-services") {
        return okAwsCommand(
          JSON.stringify({
            serviceArns: [
              "arn:aws:ecs:service/runtime/bltz-owned-torii",
              "arn:aws:ecs:service/runtime/bltz-owned-katana",
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(
          JSON.stringify({
            services: [
              buildTaggedRuntimeService("torii", "bltz-owned-torii", "bltz-owned", {
                runtimeInstanceId,
                deleteAfter: expectedDeleteAfter,
              }),
              buildTaggedRuntimeService("katana", "bltz-owned-katana", "bltz-owned", {
                runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-000000000012",
                deleteAfter: expectedDeleteAfter,
                lifecycleClass: "shared",
                autoTeardown: false,
              }),
            ],
          }),
        );
      }

      return okAwsCommand();
    };
    const backend = {
      async describeRuntime(request: {
        runtimeKind: "torii" | "katana";
        runtimeName: string;
        environmentId: "slot.blitz";
      }) {
        return {
          ...buildTaggedRuntimeService(request.runtimeKind, request.runtimeName, "bltz-owned"),
          provider: "aws",
          runtimeKind: request.runtimeKind,
          runtimeName: request.runtimeName,
          status: "existing",
          tier: "basic",
          serviceName: `slot-blitz-${request.runtimeKind}-${request.runtimeName}`,
          endpointUrl: "https://runtime.example",
          describedAt: "2026-07-04T00:00:00.000Z",
        };
      },
      async createRuntime() {
        throw new Error("unexpected create");
      },
      async resizeRuntime() {
        throw new Error("unexpected resize");
      },
      async deleteRuntime(request: { runtimeKind: string; runtimeName: string }) {
        deletedRequests.push({
          runtimeKind: request.runtimeKind,
          runtimeName: request.runtimeName,
        });
        return [];
      },
    };

    const result = await deleteAwsRuntimeGroup(
      {
        environmentId: "slot.blitz",
        runtimeInstanceId,
        expectedDeleteAfter,
        gameName: "bltz-owned",
        runKind: "game",
        runName: "bltz-owned",
      },
      { commandRunner, backend },
    );

    expect(result.failed).toHaveLength(0);
    expect(result.deleted).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.outcomes.map((outcome) => outcome.status).sort()).toEqual(["deleted", "skipped-stale"]);
    expect(deletedRequests).toEqual([
      {
        runtimeKind: "torii",
        runtimeName: "bltz-owned-torii",
      },
    ]);
  });

  test("returns skipped-stale when teardown lifecycle or immutable identity changes", async () => {
    configureAwsRuntimeEnv();
    const requestedRuntimeInstanceId = "018f6e54-5f4a-7ae2-a0ff-000000000020";
    const expectedDeleteAfter = new Date(Date.now() - 60_000).toISOString();
    const scenarios = [
      {
        name: "duration-extension",
        runtimeInstanceId: requestedRuntimeInstanceId,
        deleteAfter: new Date(Date.now() + 60 * 60_000).toISOString(),
        autoTeardown: true,
        lifecycleClass: "ephemeral" as const,
      },
      {
        name: "relaunch",
        runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-000000000021",
        deleteAfter: expectedDeleteAfter,
        autoTeardown: true,
        lifecycleClass: "ephemeral" as const,
      },
      {
        name: "auto-teardown-removed",
        runtimeInstanceId: requestedRuntimeInstanceId,
        deleteAfter: expectedDeleteAfter,
        autoTeardown: false,
        lifecycleClass: "ephemeral" as const,
      },
      {
        name: "shared-runtime",
        runtimeInstanceId: requestedRuntimeInstanceId,
        deleteAfter: expectedDeleteAfter,
        autoTeardown: true,
        lifecycleClass: "shared" as const,
      },
    ];

    for (const scenario of scenarios) {
      const runtimeName = `bltz-${scenario.name}`;
      const commandRunner = (args: string[]) => {
        if (args.slice(0, 2).join(" ") === "ecs list-services") {
          return okAwsCommand(
            JSON.stringify({
              serviceArns: [`arn:aws:ecs:service/runtime/${runtimeName}`],
            }),
          );
        }
        if (args.slice(0, 2).join(" ") === "ecs describe-services") {
          return okAwsCommand(
            JSON.stringify({
              services: [buildTaggedRuntimeService("torii", runtimeName, "bltz-stale", scenario)],
            }),
          );
        }
        return okAwsCommand();
      };
      const result = await deleteAwsRuntimeGroup(
        {
          environmentId: "slot.blitz",
          runtimeInstanceId: requestedRuntimeInstanceId,
          expectedDeleteAfter,
          gameName: "bltz-stale",
          runKind: "game",
          runName: "bltz-stale",
        },
        {
          commandRunner,
          backend: {
            async describeRuntime() {
              throw new Error("stale teardown must not describe for deletion");
            },
            async createRuntime() {
              throw new Error("unexpected create");
            },
            async updateRuntimeTier() {
              throw new Error("unexpected resize");
            },
            async deleteRuntime() {
              throw new Error("stale teardown must not delete");
            },
          },
        },
      );

      expect(result.deleted).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.outcomes).toMatchObject([{ status: "skipped-stale" }]);
    }
  });

  test("single-runtime delete returns skipped-stale when lifecycle changes after its initial read", async () => {
    const liveState = {
      provider: "aws" as const,
      environmentId: "slot.blitz" as const,
      runtimeKind: "torii" as const,
      runtimeName: "bltz-fire-gate-42",
      runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
      serviceName: "slot-blitz-torii-bltz-fire-gate-42",
      status: "existing" as const,
      lifecycleClass: "ephemeral" as const,
      autoTeardown: true,
      deleteAfter: "2024-01-02T00:00:00.000Z",
    };
    const backend = {
      describeRuntime: async () => liveState,
      createRuntime: async () => [],
      updateRuntimeTier: async () => undefined,
      deleteRuntime: async () => {
        const error = new Error("runtime duration was extended");
        error.name = "AwsRuntimeStaleTeardownError";
        throw error;
      },
    };

    const result = await deleteAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        expectedDeleteAfter: EXPIRED_DELETE_AFTER,
      },
      { backend },
    );

    expect(result.action).toBe("skipped-stale");
    expect(result.liveState.deleteAfter).toBe("2024-01-02T00:00:00.000Z");
  });

  test("single-runtime delete rejects requests without the exact expected expiry", async () => {
    const backend = {
      describeRuntime: async () => {
        throw new Error("delete validation should run before AWS reads");
      },
      createRuntime: async () => [],
      updateRuntimeTier: async () => undefined,
      deleteRuntime: async () => [],
    };

    await expect(
      deleteAwsRuntime(
        {
          environmentId: "slot.blitz",
          runtimeKind: "torii",
          runtimeName: "bltz-fire-gate-42",
          runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        },
        { backend },
      ),
    ).rejects.toThrow("expectedDeleteAfter");
  });

  test("orphan cleanup returns skipped-stale before the expected expiry", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);
      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(JSON.stringify({ services: [] }));
      }
      return okAwsCommand();
    });

    const result = await deleteAwsRuntime(
      {
        ...TEST_DELETE_IDENTITY,
        expectedDeleteAfter: new Date(Date.now() + 60_000).toISOString(),
      },
      { backend },
    );

    expect(result.action).toBe("skipped-stale");
    expect(commands.map((command) => command.slice(0, 2).join(" "))).not.toContain("elbv2 delete-target-group");
  });

  test("finds expired fallback runtimes while skipping mainnet, protected, and future delete-after services", async () => {
    configureAwsRuntimeEnv();
    const oldCreatedAt = new Date(Date.now() - 25 * 60 * 60_000).toISOString();
    const youngCreatedAt = new Date(Date.now() - 60_000).toISOString();
    const expiredDeleteAfter = new Date(Date.now() - 60_000).toISOString();
    const futureDeleteAfter = new Date(Date.now() + 60 * 60_000).toISOString();
    const commandRunner = (args: string[]) => {
      if (args.slice(0, 2).join(" ") === "ecs list-services") {
        return okAwsCommand(
          JSON.stringify({
            serviceArns: [
              "arn:aws:ecs:service/runtime/slot-old",
              "arn:aws:ecs:service/runtime/slot-young",
              "arn:aws:ecs:service/runtime/mainnet-old",
              "arn:aws:ecs:service/runtime/protected-old",
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(
          JSON.stringify({
            services: [
              buildTaggedRuntimeService("torii", "slot-old", "bltz-old", {
                createdAt: oldCreatedAt,
                deleteAfter: expiredDeleteAfter,
              }),
              buildTaggedRuntimeService("torii", "slot-young", "bltz-young", {
                createdAt: youngCreatedAt,
                deleteAfter: futureDeleteAfter,
              }),
              buildTaggedRuntimeService("torii", "mainnet-old", "bltz-mainnet", {
                environment: "mainnet.blitz",
                createdAt: oldCreatedAt,
                deleteAfter: expiredDeleteAfter,
              }),
              buildTaggedRuntimeService("torii", "protected-old", "bltz-protected", {
                createdAt: oldCreatedAt,
                deleteAfter: expiredDeleteAfter,
                retainRuntime: true,
              }),
            ],
          }),
        );
      }

      return okAwsCommand();
    };

    const expiredRuntimes = await findExpiredAwsRuntimes(
      {
        environmentId: "slot.blitz",
      },
      { commandRunner },
    );

    expect(expiredRuntimes.map((runtime) => runtime.runtimeName)).toEqual(["slot-old"]);
  });

  test("delete sweeps runtime orphans when the ECS service is already missing", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(JSON.stringify({ services: [] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(
          JSON.stringify({
            TargetGroups: [
              {
                TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(
          JSON.stringify({
            Rules: [
              {
                RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/123",
                Conditions: [
                  {
                    Field: "path-pattern",
                    Values: ["/x/slot-blitz/bltz-fire-gate-42/torii", "/x/slot-blitz/bltz-fire-gate-42/torii/*"],
                  },
                ],
                Actions: [
                  {
                    Type: "forward",
                    TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
                  },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(
          JSON.stringify({
            AccessPoints: [
              {
                AccessPointId: "fsap-123",
                RootDirectory: {
                  Path: TEST_RUNTIME_ROOT_PATH,
                },
                Tags: [
                  { Key: "Project", Value: "eternum" },
                  { Key: "Environment", Value: "slot.blitz" },
                  { Key: "RuntimeKind", Value: "torii" },
                  { Key: "RuntimeName", Value: "bltz-fire-gate-42" },
                  { Key: "RuntimeServiceName", Value: TEST_RUNTIME_SERVICE_NAME },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "cloudwatch describe-alarms") {
        return okAwsCommand(JSON.stringify({ MetricAlarms: [{ AlarmName: "runtime-alarm" }] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs run-task") {
        return okAwsCommand("arn:aws:ecs:us-east-1:123456789012:task/runtime/cleanup-task\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs describe-tasks") {
        return okAwsCommand(
          JSON.stringify({
            tasks: [
              {
                containers: [
                  {
                    name: "runtime",
                    exitCode: 0,
                  },
                ],
              },
            ],
          }),
        );
      }

      return okAwsCommand();
    });

    const result = await deleteAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        expectedDeleteAfter: EXPIRED_DELETE_AFTER,
      },
      { backend },
    );

    expect(result.action).toBe("deleted");
    expect(result.swept).toEqual(["alarms", "listener-rule", "target-group", "snapshots", "access-point"]);
    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "ecs describe-services",
      "ecs describe-services",
      "elbv2 describe-target-groups",
      "elbv2 describe-tags",
      "efs describe-access-points",
      "cloudwatch describe-alarms",
      "cloudwatch delete-alarms",
      "elbv2 describe-rules",
      "elbv2 describe-tags",
      "elbv2 delete-rule",
      "elbv2 delete-target-group",
      "ecs run-task",
      "ecs wait",
      "ecs describe-tasks",
      "efs delete-access-point",
      "ecs list-task-definitions",
      "ecs list-task-definitions",
    ]);

    const cleanupTask = findCommand(commands, "ecs run-task");
    const overrides = readJsonArg<{
      containerOverrides: Array<{ environment: Array<{ name: string; value: string }> }>;
    }>(cleanupTask, "--overrides");
    expect(overrides.containerOverrides[0]?.environment).toContainEqual({
      name: "RUNTIME_CLEANUP_PATH",
      value: "/snapshots",
    });
  });

  test("delete resolves a missing runtime's sticky shard before checking listener-rule orphans", async () => {
    configureAwsRuntimeEnv();
    process.env.AWS_RUNTIME_CONTROL_TABLE_NAME = "runtime-control";
    process.env.AWS_RUNTIME_REQUIRE_CONTROL_TABLE = "true";
    const listeners = [
      "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/runtime-s0/1/0",
      "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/runtime-s1/1/1",
    ];
    process.env.AWS_RUNTIME_ALB_LISTENER_ARNS = JSON.stringify(listeners);
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);
      const command = args.slice(0, 2).join(" ");
      if (command === "ecs describe-services") {
        return okAwsCommand(JSON.stringify({ services: [] }));
      }
      if (command === "dynamodb get-item") {
        const key = readJsonArg<{ ControlKey: { S: string } }>(args, "--key").ControlKey.S;
        if (key.startsWith("ROUTE#")) {
          return okAwsCommand(
            JSON.stringify({
              Item: {
                RoutingShard: { N: "1" },
                RuntimeInstanceId: { S: TEST_RUNTIME_INSTANCE_ID },
              },
            }),
          );
        }
        if (key.startsWith("SHARD#")) {
          return okAwsCommand(JSON.stringify({ Item: { RuntimeCount: { N: "0" } } }));
        }
      }
      if (command === "elbv2 describe-target-groups") {
        return okAwsCommand(JSON.stringify({ TargetGroups: [] }));
      }
      if (command === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [] }));
      }
      if (command === "efs describe-access-points") {
        return okAwsCommand(JSON.stringify({ AccessPoints: [] }));
      }
      if (command === "cloudwatch describe-alarms") {
        return okAwsCommand(JSON.stringify({ MetricAlarms: [] }));
      }
      if (command === "ecs list-task-definitions") {
        return okAwsCommand(JSON.stringify({ taskDefinitionArns: [] }));
      }
      return okAwsCommand();
    });

    const result = await deleteAwsRuntime(
      {
        ...TEST_DELETE_IDENTITY,
        expectedDeleteAfter: EXPIRED_DELETE_AFTER,
      },
      { backend },
    );

    expect(result.action).toBe("already-missing");
    const listenerRuleCheck = findCommand(commands, "elbv2 describe-rules");
    expect(listenerRuleCheck[listenerRuleCheck.indexOf("--listener-arn") + 1]).toBe(listeners[1]);
  });

  test("delete skips a target-group matched listener rule tagged for another runtime", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(JSON.stringify({ services: [] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(
          JSON.stringify({
            TargetGroups: [
              {
                TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-tags") {
        const resourceArn = args.at(-3);
        const runtimeServiceName =
          resourceArn === "arn:aws:elasticloadbalancing:targetgroup/runtime/123"
            ? TEST_RUNTIME_SERVICE_NAME
            : "slot-blitz-torii-other-runtime";
        return okAwsCommand(
          JSON.stringify({
            TagDescriptions: [
              {
                ResourceArn: resourceArn,
                Tags: [{ Key: "RuntimeServiceName", Value: runtimeServiceName }],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(
          JSON.stringify({
            Rules: [
              {
                RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/foreign",
                Conditions: [
                  {
                    Field: "path-pattern",
                    Values: ["/x/slot-blitz/other-runtime/torii", "/x/slot-blitz/other-runtime/torii/*"],
                  },
                ],
                Actions: [
                  {
                    Type: "forward",
                    TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
                  },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(JSON.stringify({ AccessPoints: [] }));
      }

      if (args.slice(0, 2).join(" ") === "cloudwatch describe-alarms") {
        return okAwsCommand(JSON.stringify({ MetricAlarms: [] }));
      }

      return okAwsCommand();
    });

    const result = await deleteAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        expectedDeleteAfter: EXPIRED_DELETE_AFTER,
      },
      { backend },
    );

    expect(result.swept).toEqual(["target-group"]);
    expect(commands.map((command) => command.slice(0, 2).join(" "))).not.toContain("elbv2 delete-rule");
  });

  test("delete continues sweeping an access-point-only orphan when no cleanup task definition exists", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(JSON.stringify({ services: [] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(JSON.stringify({ TargetGroups: [] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [] }));
      }

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(
          JSON.stringify({
            AccessPoints: [
              {
                AccessPointId: "fsap-123",
                RootDirectory: {
                  Path: TEST_RUNTIME_ROOT_PATH,
                },
                Tags: [
                  { Key: "Project", Value: "eternum" },
                  { Key: "Environment", Value: "slot.blitz" },
                  { Key: "RuntimeKind", Value: "torii" },
                  { Key: "RuntimeName", Value: "bltz-fire-gate-42" },
                  { Key: "RuntimeServiceName", Value: TEST_RUNTIME_SERVICE_NAME },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "cloudwatch describe-alarms") {
        return okAwsCommand(JSON.stringify({ MetricAlarms: [] }));
      }

      if (args.slice(0, 2).join(" ") === "ecs run-task") {
        return failedAwsCommand("ClientException: Unable to describe task definition");
      }

      return okAwsCommand();
    });

    const result = await deleteAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        expectedDeleteAfter: EXPIRED_DELETE_AFTER,
      },
      { backend },
    );

    expect(result.action).toBe("deleted");
    expect(result.swept).toEqual(["access-point"]);
    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "ecs describe-services",
      "ecs describe-services",
      "elbv2 describe-target-groups",
      "efs describe-access-points",
      "cloudwatch describe-alarms",
      "elbv2 describe-rules",
      "ecs run-task",
      "efs delete-access-point",
      "ecs list-task-definitions",
      "ecs list-task-definitions",
    ]);
  });

  test("delete retainData skips snapshot cleanup while sweeping runtime resources", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(JSON.stringify({ services: [] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(
          JSON.stringify({
            TargetGroups: [{ TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123" }],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(
          JSON.stringify({
            Rules: [
              {
                RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/123",
                Conditions: [
                  {
                    Field: "path-pattern",
                    Values: ["/x/slot-blitz/bltz-fire-gate-42/torii", "/x/slot-blitz/bltz-fire-gate-42/torii/*"],
                  },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(
          JSON.stringify({
            AccessPoints: [
              {
                AccessPointId: "fsap-123",
                RootDirectory: {
                  Path: TEST_RUNTIME_ROOT_PATH,
                },
                Tags: [
                  { Key: "Project", Value: "eternum" },
                  { Key: "Environment", Value: "slot.blitz" },
                  { Key: "RuntimeKind", Value: "torii" },
                  { Key: "RuntimeName", Value: "bltz-fire-gate-42" },
                  { Key: "RuntimeServiceName", Value: TEST_RUNTIME_SERVICE_NAME },
                ],
              },
            ],
          }),
        );
      }

      if (args.slice(0, 2).join(" ") === "cloudwatch describe-alarms") {
        return okAwsCommand(JSON.stringify({ MetricAlarms: [{ AlarmName: "runtime-alarm" }] }));
      }

      return okAwsCommand();
    });

    const result = await deleteAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        expectedDeleteAfter: EXPIRED_DELETE_AFTER,
        retainData: true,
      },
      { backend },
    );

    expect(result.action).toBe("deleted");
    expect(result.swept).toEqual(["alarms", "listener-rule", "target-group", "access-point"]);
    expect(commands.some((command) => command.slice(0, 2).join(" ") === "ecs run-task")).toBe(false);
  });

  test("delete reports already-missing when no runtime resources remain", async () => {
    configureAwsRuntimeEnv();
    const backend = createAwsRuntimeCommandBackend((args) => {
      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(JSON.stringify({ services: [] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-target-groups") {
        return okAwsCommand(JSON.stringify({ TargetGroups: [] }));
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(JSON.stringify({ Rules: [] }));
      }

      if (args.slice(0, 2).join(" ") === "efs describe-access-points") {
        return okAwsCommand(JSON.stringify({ AccessPoints: [] }));
      }

      return okAwsCommand();
    });

    const result = await deleteAwsRuntime(
      {
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        runtimeInstanceId: TEST_RUNTIME_INSTANCE_ID,
        expectedDeleteAfter: EXPIRED_DELETE_AFTER,
      },
      { backend },
    );

    expect(result.action).toBe("already-missing");
    expect(result.swept).toBeUndefined();
  });

  test("retains three exact-family task definition revisions and ignores prefix matches", () => {
    configureAwsRuntimeEnv();
    const request = TEST_DELETE_IDENTITY;
    const config = resolveAwsRuntimeCommandConfig(request);
    const family = buildAwsRuntimeServiceName(request);
    const commands: string[][] = [];
    const commandRunner = (args: string[]) => {
      commands.push(args);
      if (args.slice(0, 2).join(" ") === "ecs list-task-definitions") {
        return okAwsCommand(
          JSON.stringify({
            taskDefinitionArns: [5, 4, 3, 2, 1]
              .map((revision) => `arn:aws:ecs:us-east-1:123456789012:task-definition/${family}:${revision}`)
              .concat(`arn:aws:ecs:us-east-1:123456789012:task-definition/${family}-other:99`),
          }),
        );
      }
      return okAwsCommand();
    };

    pruneRuntimeTaskDefinitionRevisions(commandRunner, request, config);

    const deregistered = commands
      .filter((command) => command.slice(0, 2).join(" ") === "ecs deregister-task-definition")
      .map((command) => command.at(-1));
    expect(deregistered).toEqual([
      `arn:aws:ecs:us-east-1:123456789012:task-definition/${family}:2`,
      `arn:aws:ecs:us-east-1:123456789012:task-definition/${family}:1`,
    ]);
  });

  test("destructive deletion removes only exact-family task definition revisions", () => {
    configureAwsRuntimeEnv();
    const request = TEST_DELETE_IDENTITY;
    const config = resolveAwsRuntimeCommandConfig(request);
    const family = buildAwsRuntimeServiceName(request);
    const commands: string[][] = [];
    const commandRunner = (args: string[]) => {
      commands.push(args);
      if (args.slice(0, 2).join(" ") !== "ecs list-task-definitions") {
        return okAwsCommand();
      }

      const status = args[args.indexOf("--status") + 1];
      const revision = status === "ACTIVE" ? 2 : 1;
      return okAwsCommand(
        JSON.stringify({
          taskDefinitionArns: [
            `arn:aws:ecs:us-east-1:123456789012:task-definition/${family}:${revision}`,
            `arn:aws:ecs:us-east-1:123456789012:task-definition/${family}-other:99`,
          ],
        }),
      );
    };

    expect(deleteRuntimeTaskDefinitionRevisions(commandRunner, request, config)).toBe(true);

    const deregisterCommand = findCommand(commands, "ecs deregister-task-definition");
    const deleteCommand = findCommand(commands, "ecs delete-task-definitions");
    const mutatedTaskDefinitions = [
      deregisterCommand[deregisterCommand.indexOf("--task-definition") + 1],
      ...deleteCommand.slice(deleteCommand.indexOf("--task-definitions") + 1),
    ];
    expect(mutatedTaskDefinitions).toEqual([
      `arn:aws:ecs:us-east-1:123456789012:task-definition/${family}:2`,
      `arn:aws:ecs:us-east-1:123456789012:task-definition/${family}:1`,
    ]);
    expect(mutatedTaskDefinitions.some((value) => value?.includes(`${family}-other`))).toBe(false);
  });

  test("classifies missing AWS foundation configuration failures", async () => {
    restoreAwsEnv();
    const backend = createAwsRuntimeCommandBackend(() => okAwsCommand());

    await expect(
      backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
      }),
    ).rejects.toThrow("Missing AWS runtime foundation config");

    expect(classifyAwsRuntimeFailure(new Error("Missing AWS runtime foundation config: AWS_RUNTIME_ECR_IMAGE"))).toBe(
      "missing-foundation-config",
    );
  });
});
