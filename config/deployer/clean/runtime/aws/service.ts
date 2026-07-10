import {
  buildAwsCommandOutput,
  buildAwsCommandFailureMessage,
  commandOutputText,
  parseJsonOutput,
  runOptionalAwsCleanupCommand,
  runRequiredAwsCommand,
  type AwsCommandRunner,
  type AwsCommandTag,
} from "./commands";
import {
  buildAwsRuntimeTags,
  resolveAwsRuntimeTier,
  resolveHealthStartPeriodSeconds,
  resolveRuntimeContainerPort,
  shouldVerifyPublicRuntimeHealth,
  toEcsTagList,
  type AwsRuntimeCommandConfig,
} from "./config";
import { probeRuntimePublicHealth, waitForRuntimeServiceStable, type AwsRuntimeHealthProbe } from "./health";
import { buildAwsRuntimeServiceName } from "./naming";
import { buildResizedTaskDefinition, describeLiveTaskDefinition } from "./task-definition";
import type { AwsRuntimeLiveState, AwsRuntimeRequest } from "../aws-runtime";

export interface AwsRuntimeRegisteredTask {
  taskDefinitionArn: string;
  efsAccessPointId: string;
}

export async function ensureEcsService(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  runtimeTask: AwsRuntimeRegisteredTask,
  targetGroupArn: string,
  healthProbe: AwsRuntimeHealthProbe,
  describeRuntime: () => AwsRuntimeLiveState,
): Promise<boolean> {
  const liveState = describeRuntime();
  if (liveState.status === "existing") {
    return true;
  }

  if (liveState.status === "indeterminate") {
    throw new Error(`Unable to verify AWS runtime "${request.runtimeName}": ${liveState.describeError}`);
  }

  createEcsService(commandRunner, request, config, runtimeTask, targetGroupArn);
  waitForRuntimeServiceStable(commandRunner, request, config);
  await verifyRuntimePublicHealth(request, healthProbe);
  return false;
}

export function registerTaskDefinitionFromLiveRuntime(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): string {
  if (!liveState.taskDefinitionArn) {
    throw new Error(`AWS runtime "${request.runtimeName}" is missing task definition metadata`);
  }

  const liveTaskDefinition = describeLiveTaskDefinition(commandRunner, request, config, liveState.taskDefinitionArn);
  assertResizeKeepsLiveImageDigest(request, config, liveTaskDefinition);
  const nextTaskDefinition = buildResizedTaskDefinition(liveTaskDefinition, request);
  const result = runRequiredAwsCommand(commandRunner, `register resized task definition for "${request.runtimeName}"`, [
    "ecs",
    "register-task-definition",
    "--region",
    config.region,
    "--cli-input-json",
    JSON.stringify(nextTaskDefinition),
    "--query",
    "taskDefinition.taskDefinitionArn",
    "--output",
    "text",
  ]);

  return commandOutputText(result);
}

function assertResizeKeepsLiveImageDigest(
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveTaskDefinition: Record<string, unknown>,
): void {
  if (!request.imageDigest) {
    return;
  }

  const containerDefinitions = Array.isArray(liveTaskDefinition.containerDefinitions)
    ? (liveTaskDefinition.containerDefinitions as Array<Record<string, unknown>>)
    : [];
  const runtimeContainer = containerDefinitions.find((container) => container.name === config.containerName);
  const liveDigest = /@(sha256:[a-f0-9]{64})$/.exec(`${runtimeContainer?.image || ""}`)?.[1];
  if (liveDigest !== request.imageDigest) {
    throw new Error(
      `AWS runtime "${request.runtimeName}" resize must use its live image digest; deploy first to change images`,
    );
  }
}

export async function updateRuntimeServiceTaskDefinition(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  taskDefinitionArn: string,
  healthProbe: AwsRuntimeHealthProbe,
): Promise<void> {
  const tier = resolveAwsRuntimeTier(request.tier);
  runRequiredAwsCommand(commandRunner, `update AWS runtime "${request.runtimeName}"`, [
    "ecs",
    "update-service",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--service",
    buildAwsRuntimeServiceName(request),
    "--task-definition",
    taskDefinitionArn,
    "--desired-count",
    `${tier.desiredCount}`,
    "--deployment-configuration",
    buildDeploymentConfiguration(),
    "--health-check-grace-period-seconds",
    `${resolveHealthStartPeriodSeconds()}`,
  ]);
  waitForRuntimeServiceStable(commandRunner, request, config);
  await verifyRuntimePublicHealth(request, healthProbe);
  pruneRuntimeTaskDefinitionRevisions(commandRunner, request, config);
}

export function pruneRuntimeTaskDefinitionRevisions(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): void {
  const activeTaskDefinitions = listRuntimeTaskDefinitions(commandRunner, request, config, "ACTIVE");
  for (const taskDefinitionArn of activeTaskDefinitions.slice(3)) {
    runRequiredAwsCommand(commandRunner, `deregister old task definition for "${request.runtimeName}"`, [
      "ecs",
      "deregister-task-definition",
      "--region",
      config.region,
      "--task-definition",
      taskDefinitionArn,
    ]);
  }
}

export function deleteRuntimeTaskDefinitionRevisions(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): boolean {
  const activeTaskDefinitions = listRuntimeTaskDefinitions(commandRunner, request, config, "ACTIVE");
  for (const taskDefinitionArn of activeTaskDefinitions) {
    runOptionalAwsCleanupCommand(commandRunner, `deregister task definition for "${request.runtimeName}"`, [
      "ecs",
      "deregister-task-definition",
      "--region",
      config.region,
      "--task-definition",
      taskDefinitionArn,
    ]);
  }

  const inactiveTaskDefinitions = listRuntimeTaskDefinitions(commandRunner, request, config, "INACTIVE");
  for (let index = 0; index < inactiveTaskDefinitions.length; index += 10) {
    runOptionalAwsCleanupCommand(commandRunner, `delete task definitions for "${request.runtimeName}"`, [
      "ecs",
      "delete-task-definitions",
      "--region",
      config.region,
      "--task-definitions",
      ...inactiveTaskDefinitions.slice(index, index + 10),
    ]);
  }

  return activeTaskDefinitions.length > 0 || inactiveTaskDefinitions.length > 0;
}

export function updateRuntimeServiceTags(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): void {
  if (!liveState.serviceArn) {
    throw new Error(`AWS runtime "${request.runtimeName}" is missing ECS service metadata`);
  }

  const desiredTags = buildMutableRuntimeTags(request, config, liveState);
  runRequiredAwsCommand(commandRunner, `tag AWS runtime service "${request.runtimeName}"`, [
    "ecs",
    "tag-resource",
    "--region",
    config.region,
    "--resource-arn",
    liveState.serviceArn,
    "--tags",
    ...toEcsTagList(desiredTags),
  ]);

  removeObsoleteRuntimeServiceTags(commandRunner, request, config, liveState, desiredTags);
}

export function deleteEcsService(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): boolean {
  runOptionalAwsCleanupCommand(commandRunner, `delete AWS runtime "${request.runtimeName}"`, [
    "ecs",
    "delete-service",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--service",
    buildAwsRuntimeServiceName(request),
    "--force",
  ]);
  return true;
}

export function waitForRuntimeServiceDeletion(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): void {
  runOptionalAwsCleanupCommand(commandRunner, `wait for AWS runtime service deletion "${request.runtimeName}"`, [
    "ecs",
    "wait",
    "services-inactive",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--services",
    buildAwsRuntimeServiceName(request),
  ]);
}

export function cleanupRuntimeSnapshotStore(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
  efsAccessPointId?: string,
): boolean {
  if (request.retainData || !efsAccessPointId) {
    return false;
  }

  const taskArn = startRuntimeSnapshotCleanupTask(commandRunner, request, config, liveState);
  if (!taskArn) {
    return false;
  }

  waitForRuntimeSnapshotCleanupTask(commandRunner, request, config, taskArn);
  assertRuntimeSnapshotCleanupSucceeded(commandRunner, request, config, taskArn);
  return true;
}

async function verifyRuntimePublicHealth(
  request: AwsRuntimeRequest,
  healthProbe: AwsRuntimeHealthProbe,
): Promise<void> {
  if (!shouldVerifyPublicRuntimeHealth()) {
    return;
  }

  const health = await probeRuntimePublicHealth(request, healthProbe);
  if (health.status === "healthy") {
    return;
  }

  throw new Error(
    `AWS runtime "${request.runtimeName}" rollout failed health check at ${health.endpoint}: ${
      health.details || health.status
    }`,
  );
}

function createEcsService(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  runtimeTask: AwsRuntimeRegisteredTask,
  targetGroupArn: string,
): void {
  const tier = resolveAwsRuntimeTier(request.tier);

  runRequiredAwsCommand(commandRunner, `create ECS service for "${request.runtimeName}"`, [
    "ecs",
    "create-service",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--service-name",
    buildAwsRuntimeServiceName(request),
    "--desired-count",
    `${tier.desiredCount}`,
    "--launch-type",
    "FARGATE",
    "--platform-version",
    "LATEST",
    "--task-definition",
    runtimeTask.taskDefinitionArn,
    "--network-configuration",
    buildNetworkConfiguration(config),
    "--load-balancers",
    buildLoadBalancerConfiguration(config, request, targetGroupArn),
    "--deployment-configuration",
    buildDeploymentConfiguration(),
    "--health-check-grace-period-seconds",
    `${resolveHealthStartPeriodSeconds()}`,
    "--enable-execute-command",
    "--tags",
    ...toEcsTagList(
      buildAwsRuntimeTags(request, [
        { key: "EfsAccessPointId", value: runtimeTask.efsAccessPointId },
        { key: "TargetGroupArn", value: targetGroupArn },
        { key: "ImageDigest", value: config.imageDigest || config.image },
      ]),
    ),
  ]);
}

function buildNetworkConfiguration(config: AwsRuntimeCommandConfig): string {
  return `awsvpcConfiguration={subnets=[${config.subnetIds.join(",")}],securityGroups=[${config.securityGroupIds.join(",")}],assignPublicIp=${config.assignPublicIp}}`;
}

function buildLoadBalancerConfiguration(
  config: AwsRuntimeCommandConfig,
  request: AwsRuntimeRequest,
  targetGroupArn: string,
): string {
  return [
    `targetGroupArn=${targetGroupArn}`,
    `containerName=${config.containerName}`,
    `containerPort=${resolveRuntimeContainerPort(request.runtimeKind)}`,
  ].join(",");
}

function buildDeploymentConfiguration(): string {
  return "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=100,minimumHealthyPercent=0";
}

function listRuntimeTaskDefinitions(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  status: "ACTIVE" | "INACTIVE",
): string[] {
  const taskDefinitionFamily = buildAwsRuntimeServiceName(request);
  const result = runRequiredAwsCommand(commandRunner, `list task definitions for "${request.runtimeName}"`, [
    "ecs",
    "list-task-definitions",
    "--region",
    config.region,
    "--family-prefix",
    taskDefinitionFamily,
    "--status",
    status,
    "--sort",
    "DESC",
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ taskDefinitionArns?: string[] }>(result.stdout || "", {});
  return (payload.taskDefinitionArns || []).filter(
    (taskDefinitionArn) => readTaskDefinitionFamily(taskDefinitionArn) === taskDefinitionFamily,
  );
}

function readTaskDefinitionFamily(taskDefinitionArn: string): string | undefined {
  return /\/([^/:]+):\d+$/.exec(taskDefinitionArn)?.[1];
}

function buildMutableRuntimeTags(
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): AwsCommandTag[] {
  const extraTags: AwsCommandTag[] = [];

  if (liveState.efsAccessPointId) {
    extraTags.push({ key: "EfsAccessPointId", value: liveState.efsAccessPointId });
  }

  if (liveState.targetGroupArn) {
    extraTags.push({ key: "TargetGroupArn", value: liveState.targetGroupArn });
  }

  extraTags.push({
    key: "ImageDigest",
    value: config.imageDigest || liveState.imageDigest || config.image,
  });

  return buildAwsRuntimeTags(
    request,
    extraTags.filter((tag) => tag.value),
  );
}

function removeObsoleteRuntimeServiceTags(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
  desiredTags: AwsCommandTag[],
): void {
  const desiredKeys = new Set(desiredTags.map((tag) => tag.key));
  const obsoleteKeys = [
    "AutoTeardown",
    "DeleteAfter",
    "ExposurePolicy",
    "GameName",
    "LifecycleClass",
    "RetainRuntime",
    "RoutingShard",
    "RunKind",
    "RunName",
  ].filter((key) => !desiredKeys.has(key));

  if (obsoleteKeys.length === 0) {
    return;
  }

  runRequiredAwsCommand(commandRunner, `remove obsolete tags from AWS runtime service "${request.runtimeName}"`, [
    "ecs",
    "untag-resource",
    "--region",
    config.region,
    "--resource-arn",
    liveState.serviceArn!,
    "--tag-keys",
    ...obsoleteKeys,
  ]);
}

function startRuntimeSnapshotCleanupTask(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): string | undefined {
  const result = commandRunner([
    "ecs",
    "run-task",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--launch-type",
    "FARGATE",
    "--task-definition",
    liveState.taskDefinitionArn || buildAwsRuntimeServiceName(request),
    "--count",
    "1",
    "--network-configuration",
    buildNetworkConfiguration(config),
    "--overrides",
    JSON.stringify(buildSnapshotCleanupTaskOverrides(config)),
    "--started-by",
    "aws-runtime-cleanup",
    "--tags",
    ...toEcsTagList(buildAwsRuntimeTags(request, [{ key: "RuntimeOperation", value: "snapshot-cleanup" }])),
    "--query",
    "tasks[0].taskArn",
    "--output",
    "text",
  ]);

  if ((result.status ?? 1) !== 0) {
    const output = buildAwsCommandOutput(result);
    if (isMissingCleanupTaskDefinitionOutput(output)) {
      return undefined;
    }

    throw new Error(buildAwsCommandFailureMessage(`start snapshot cleanup task for "${request.runtimeName}"`, result));
  }

  const taskArn = commandOutputText(result);
  if (!taskArn || taskArn === "None") {
    throw new Error(`AWS runtime snapshot cleanup task did not start for "${request.runtimeName}"`);
  }

  return taskArn;
}

function isMissingCleanupTaskDefinitionOutput(output: string): boolean {
  return /Unable to describe task definition|TaskDefinition.*not found|task definition.*does not exist/i.test(output);
}

function buildSnapshotCleanupTaskOverrides(config: AwsRuntimeCommandConfig): Record<string, unknown> {
  return {
    containerOverrides: [
      {
        name: config.containerName,
        environment: [{ name: "RUNTIME_CLEANUP_PATH", value: "/snapshots" }],
      },
    ],
  };
}

function waitForRuntimeSnapshotCleanupTask(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  taskArn: string,
): void {
  runRequiredAwsCommand(commandRunner, `wait for snapshot cleanup task for "${request.runtimeName}"`, [
    "ecs",
    "wait",
    "tasks-stopped",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--tasks",
    taskArn,
  ]);
}

function assertRuntimeSnapshotCleanupSucceeded(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  taskArn: string,
): void {
  const result = runRequiredAwsCommand(commandRunner, `describe snapshot cleanup task for "${request.runtimeName}"`, [
    "ecs",
    "describe-tasks",
    "--region",
    config.region,
    "--cluster",
    config.cluster,
    "--tasks",
    taskArn,
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ tasks?: Array<{ containers?: Array<Record<string, unknown>> }> }>(
    result.stdout || "",
    {},
  );
  const cleanupContainer = payload.tasks?.[0]?.containers?.find((container) => container.name === config.containerName);

  if (cleanupContainer?.exitCode === 0) {
    return;
  }

  throw new Error(
    `AWS runtime snapshot cleanup task failed for "${request.runtimeName}"` +
      formatCleanupContainerFailure(cleanupContainer),
  );
}

function formatCleanupContainerFailure(container: Record<string, unknown> | undefined): string {
  if (!container) {
    return ": container result missing";
  }

  const exitCode = typeof container.exitCode === "number" ? container.exitCode : "unknown";
  const reason = typeof container.reason === "string" && container.reason ? ` (${container.reason})` : "";
  return `: exitCode=${exitCode}${reason}`;
}
