import type { SpawnSyncReturns } from "node:child_process";
import {
  buildRuntimeEndpointUrl,
  type RuntimeEndpointKind as AwsRuntimeEndpointKind,
} from "../../../../common/factory/runtime-endpoints";
import type { DeploymentEnvironmentId, IndexerTier } from "../types";
import {
  buildAwsRuntimeTags,
  readTag,
  resolveAwsRuntimeClusterName,
  resolveAwsRuntimeCommandConfig,
  resolveAwsRuntimeTier,
  resolveRuntimeDomain,
  resolveRuntimeLogGroup,
  resolveRuntimeRegion,
  resolveRuntimeTier,
  resolveRuntimeVersion,
  toEcsTagList,
  type AwsRuntimeCommandConfig,
  type AwsRuntimeTierConfig,
} from "./aws/config";
import {
  buildAwsCommandOutput,
  buildAwsCommandFailureMessage,
  commandOutputText,
  isMissingAwsCleanupOutput,
  isMissingAwsServiceOutput,
  parseJsonOutput,
  runAwsCommand,
  runRequiredAwsCommand,
  type AwsCommandRunner,
} from "./aws/commands";
import {
  buildHealthFromEndpoint,
  probePublicRuntimeHealth,
  type AwsRuntimeHealth,
  type AwsRuntimeHealthProbe,
} from "./aws/health";
import { buildAwsRuntimeServiceName } from "./aws/naming";
import {
  deleteEfsAccessPointIfPresent,
  ensureEfsAccessPoint,
  resolveEfsAccessPointIdByRootPath,
} from "./aws/resources";
import {
  buildContainerDefinitions,
  buildEfsVolume,
  describeLiveTaskDefinition,
  buildRuntimeEnvironment,
} from "./aws/task-definition";
import { deleteRuntimeAlarms, ensureRuntimeAlarms } from "./aws/alarms";
import {
  deleteListenerRuleIfPresent,
  deleteTargetGroupIfPresent,
  ensureListenerRule,
  ensureTargetGroup,
  resolveTargetGroupArnByName,
} from "./aws/routing";
import {
  cleanupRuntimeSnapshotStore,
  deleteEcsService,
  ensureEcsService,
  registerTaskDefinitionFromLiveRuntime,
  updateRuntimeServiceTags,
  updateRuntimeServiceTaskDefinition,
  waitForRuntimeServiceDeletion,
  type AwsRuntimeRegisteredTask,
} from "./aws/service";
export { resolveAwsRuntimeTier } from "./aws/config";
export type { AwsRuntimeTierConfig } from "./aws/config";
export type { AwsRuntimeHealth, AwsRuntimeHealthProbe, AwsRuntimeHealthStatus } from "./aws/health";
export { buildAwsRuntimeServiceName } from "./aws/naming";
export {
  buildAwsToriiRuntimeRequest,
  deleteAwsRuntime,
  describeAwsRuntime,
  ensureAwsKatanaRuntime,
  ensureAwsRuntime,
  ensureAwsToriiRuntime,
  resizeAwsRuntime,
} from "./aws/reconcile";

export type AwsRuntimeKind = "katana" | "torii";
export type AwsRuntimeStatus = "existing" | "missing" | "indeterminate";
export type AwsRuntimeAction = "created" | "already-live" | "updated" | "deleted" | "already-missing";
export type AwsRuntimeAdoptedResource = "access-point" | "target-group" | "listener-rule" | "service";
export type AwsRuntimeSweptResource =
  | "alarms"
  | "snapshots"
  | "listener-rule"
  | "service"
  | "target-group"
  | "access-point";
export type AwsRuntimeFailureClassification =
  | "missing-foundation-config"
  | "aws-command-failed"
  | "image-not-found"
  | "rollout-failed"
  | "stabilization-timeout"
  | "runtime-state-indeterminate"
  | "runtime-validation"
  | "unknown";

export interface AwsRuntimeLiveState {
  provider: "aws";
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  serviceName: string;
  status: AwsRuntimeStatus;
  endpointUrl?: string;
  tier?: IndexerTier;
  version?: string;
  region?: string;
  clusterArn?: string;
  serviceArn?: string;
  taskDefinitionArn?: string;
  targetGroupArn?: string;
  efsAccessPointId?: string;
  imageDigest?: string;
  health?: AwsRuntimeHealth;
  restoredFromSnapshot?: string;
  serviceCreatedAt?: string;
  describeError?: string;
  describedAt?: string;
}

export interface AwsRuntimeArtifact {
  provider: "aws";
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  serviceName: string;
  region?: string;
  clusterArn?: string;
  serviceArn?: string;
  taskDefinitionArn?: string;
  targetGroupArn?: string;
  efsAccessPointId?: string;
  endpointUrl?: string;
  tier?: IndexerTier;
  version?: string;
  imageDigest?: string;
  health?: AwsRuntimeHealth;
  restoredFromSnapshot?: string;
}

export interface AwsRuntimeRequest {
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  rpcUrl?: string;
  worldAddress?: string;
  worldBlock?: string;
  namespaces?: string;
  externalContracts?: string[];
  tier?: IndexerTier;
  version?: string;
  region?: string;
  domain?: string;
  retainData?: boolean;
}

export interface AwsRuntimeActionResult {
  mode: "aws-ecs";
  action: AwsRuntimeAction;
  requestedTier: IndexerTier;
  liveState: AwsRuntimeLiveState;
  previousTier?: IndexerTier;
  diff?: AwsRuntimeDiff;
  adopted?: AwsRuntimeAdoptedResource[];
  swept?: AwsRuntimeSweptResource[];
}

export interface AwsRuntimeDiff {
  tier?: {
    from?: IndexerTier;
    to: IndexerTier;
  };
  image?: {
    from?: string;
    to: string;
  };
  envChangedKeys?: string[];
}

export interface AwsRuntimeBackend {
  describeRuntime(request: AwsRuntimeRequest): Promise<AwsRuntimeLiveState>;
  createRuntime(request: AwsRuntimeRequest): Promise<AwsRuntimeAdoptedResource[]>;
  reconcileRuntime?(request: AwsRuntimeRequest, liveState: AwsRuntimeLiveState): Promise<AwsRuntimeDiff | undefined>;
  inspectSnapshotRestore?(request: AwsRuntimeRequest, liveState: AwsRuntimeLiveState): Promise<string | undefined>;
  updateRuntimeTier(request: AwsRuntimeRequest): Promise<void>;
  deleteRuntime(request: AwsRuntimeRequest, liveState?: AwsRuntimeLiveState): Promise<AwsRuntimeSweptResource[]>;
}

interface AwsRuntimeCommandBackendOptions {
  healthProbe?: AwsRuntimeHealthProbe;
}

function buildLiveStateFromService(request: AwsRuntimeRequest, service: Record<string, unknown>): AwsRuntimeLiveState {
  const tags = service.tags;
  const tier = readTag(tags, "RuntimeTier") as IndexerTier | undefined;
  const version = readTag(tags, "RuntimeVersion");
  const efsAccessPointId = readTag(tags, "EfsAccessPointId");
  const imageDigest = readTag(tags, "ImageDigest") || process.env.AWS_RUNTIME_ECR_IMAGE;
  const loadBalancers = Array.isArray(service.loadBalancers)
    ? (service.loadBalancers as Record<string, unknown>[])
    : [];
  const targetGroupArn = `${loadBalancers[0]?.targetGroupArn || ""}` || readTag(tags, "TargetGroupArn");
  const endpointUrl = buildAwsRuntimeEndpointUrl({
    domain: request.domain,
    environmentId: request.environmentId,
    runtimeName: request.runtimeName,
    runtimeKind: request.runtimeKind,
    endpointKind: "base",
  });

  return {
    provider: "aws",
    runtimeKind: request.runtimeKind,
    runtimeName: request.runtimeName,
    serviceName: buildAwsRuntimeServiceName(request),
    status: "existing",
    endpointUrl,
    tier: tier || resolveRuntimeTier(request.tier),
    version: version || resolveRuntimeVersion(request),
    region: resolveRuntimeRegion(request.region),
    clusterArn: `${service.clusterArn || ""}` || undefined,
    serviceArn: `${service.serviceArn || ""}` || undefined,
    taskDefinitionArn: `${service.taskDefinition || ""}` || undefined,
    targetGroupArn: targetGroupArn || undefined,
    efsAccessPointId,
    imageDigest,
    health: buildHealthFromEndpoint(endpointUrl),
    serviceCreatedAt: resolveServiceCreatedAt(service),
    describedAt: new Date().toISOString(),
  };
}

function resolveServiceCreatedAt(service: Record<string, unknown>): string | undefined {
  const createdAt = service.createdAt;
  if (typeof createdAt !== "string") {
    return undefined;
  }

  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function buildRestoredSnapshotFilterPattern(request: AwsRuntimeRequest): string {
  return [
    '"snapshot-restored:"',
    `"environment=${request.environmentId}"`,
    `"runtime=${request.runtimeName}"`,
    `"kind=${request.runtimeKind}"`,
  ].join(" ");
}

function readRestoredSnapshotTimestampFromLogs(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  liveState: AwsRuntimeLiveState,
): string | undefined {
  const result = commandRunner([
    "logs",
    "filter-log-events",
    "--region",
    resolveRuntimeRegion(request.region),
    "--log-group-name",
    resolveRuntimeLogGroup(),
    "--filter-pattern",
    buildRestoredSnapshotFilterPattern(request),
    "--limit",
    "50",
    ...buildRestoreLogStartTimeArgs(liveState),
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    return undefined;
  }

  return selectLatestRestoredSnapshotTimestamp(result.stdout || "");
}

function buildRestoreLogStartTimeArgs(liveState: AwsRuntimeLiveState): string[] {
  const startTime = Date.parse(liveState.serviceCreatedAt || "");
  if (!Number.isFinite(startTime)) {
    return [];
  }

  return ["--start-time", String(startTime)];
}

function selectLatestRestoredSnapshotTimestamp(output: string): string | undefined {
  const payload = parseJsonOutput<{ events?: Array<{ message?: string; timestamp?: number }> }>(output, {});
  const restoredEvents = (payload.events || [])
    .map((event) => ({
      eventTimestamp: typeof event.timestamp === "number" ? event.timestamp : 0,
      restoredFromSnapshot: extractRestoredSnapshotTimestamp(event.message || ""),
    }))
    .filter((event): event is { eventTimestamp: number; restoredFromSnapshot: string } =>
      Boolean(event.restoredFromSnapshot),
    )
    .sort((left, right) => left.eventTimestamp - right.eventTimestamp);

  return restoredEvents.at(-1)?.restoredFromSnapshot;
}

function extractRestoredSnapshotTimestamp(message: string): string | undefined {
  return /\bsnapshot-restored:\s+(\S+)/.exec(message)?.[1];
}

function buildMissingLiveState(request: AwsRuntimeRequest, describeError?: string): AwsRuntimeLiveState {
  return {
    provider: "aws",
    runtimeKind: request.runtimeKind,
    runtimeName: request.runtimeName,
    serviceName: buildAwsRuntimeServiceName(request),
    status: "missing",
    region: resolveRuntimeRegion(request.region),
    describeError,
    describedAt: new Date().toISOString(),
  };
}

function buildIndeterminateLiveState(request: AwsRuntimeRequest, describeError: string): AwsRuntimeLiveState {
  return {
    ...buildMissingLiveState(request, describeError),
    status: "indeterminate",
  };
}

function registerTaskDefinition(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  efsAccessPointId: string,
): string {
  resolveRuntimeImageDigest(commandRunner, request, config);
  const tier = resolveAwsRuntimeTier(request.tier);
  const args = [
    "ecs",
    "register-task-definition",
    "--region",
    config.region,
    "--family",
    buildAwsRuntimeServiceName(request),
    "--network-mode",
    "awsvpc",
    "--requires-compatibilities",
    "FARGATE",
    "--runtime-platform",
    "cpuArchitecture=X86_64,operatingSystemFamily=LINUX",
    "--cpu",
    `${tier.cpu}`,
    "--memory",
    `${tier.memory}`,
    "--ephemeral-storage",
    JSON.stringify({ sizeInGiB: tier.ephemeralStorageGib }),
    "--execution-role-arn",
    config.executionRoleArn,
    "--container-definitions",
    JSON.stringify(buildContainerDefinitions(request, config)),
    "--volumes",
    JSON.stringify(buildEfsVolume(config, efsAccessPointId)),
    "--tags",
    ...toEcsTagList(buildAwsRuntimeTags(request, [{ key: "EfsAccessPointId", value: efsAccessPointId }])),
    "--query",
    "taskDefinition.taskDefinitionArn",
    "--output",
    "text",
  ];

  if (config.taskRoleArn) {
    args.splice(args.indexOf("--container-definitions"), 0, "--task-role-arn", config.taskRoleArn);
  }

  const result = runRequiredAwsCommand(commandRunner, `register task definition for "${request.runtimeName}"`, args);
  return commandOutputText(result);
}

function resolveRuntimeImageDigest(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): void {
  if (!config.ecrRepositoryName || !config.ecrImageTag) {
    return;
  }

  const result = commandRunner([
    "ecr",
    "describe-images",
    "--region",
    config.region,
    "--repository-name",
    config.ecrRepositoryName,
    "--image-ids",
    `imageTag=${config.ecrImageTag}`,
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    throw new Error(buildAwsRuntimeImageNotFoundMessage(request, config, result));
  }

  const payload = parseJsonOutput<{ imageDetails?: Array<{ imageDigest?: string }> }>(result.stdout || "", {});
  const imageDigest = payload.imageDetails?.[0]?.imageDigest;
  if (!imageDigest) {
    throw new Error(`AWS runtime image not found: ${config.ecrRepositoryName}:${config.ecrImageTag}`);
  }

  config.imageDigest = imageDigest;
}

function buildAwsRuntimeImageNotFoundMessage(
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  result: SpawnSyncReturns<string>,
): string {
  const output = buildAwsCommandOutput(result);
  const imageName = `${config.ecrRepositoryName}:${config.ecrImageTag}`;
  return output
    ? `AWS runtime image not found: ${imageName}\n${output}`
    : `AWS runtime image not found for "${request.runtimeName}": ${imageName}`;
}

function registerTaskDefinitionForNewAccessPoint(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): AwsRuntimeRegisteredTask & { adopted: boolean } {
  const accessPoint = ensureEfsAccessPoint(commandRunner, request, config);
  const reusableTaskDefinitionArn = resolveReusableTaskDefinitionArn(
    commandRunner,
    request,
    config,
    accessPoint.efsAccessPointId,
  );
  if (reusableTaskDefinitionArn) {
    resolveRuntimeImageDigest(commandRunner, request, config);
  }
  const taskDefinitionArn =
    reusableTaskDefinitionArn ?? registerTaskDefinition(commandRunner, request, config, accessPoint.efsAccessPointId);

  return {
    taskDefinitionArn,
    efsAccessPointId: accessPoint.efsAccessPointId,
    adopted: accessPoint.adopted,
  };
}

function resolveReusableTaskDefinitionArn(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  efsAccessPointId: string,
): string | undefined {
  const result = commandRunner([
    "ecs",
    "describe-task-definition",
    "--region",
    config.region,
    "--task-definition",
    buildAwsRuntimeServiceName(request),
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    const output = buildAwsCommandOutput(result);
    if (isMissingTaskDefinitionOutput(output)) {
      return undefined;
    }

    throw new Error(buildAwsCommandFailureMessage(`describe task definition for "${request.runtimeName}"`, result));
  }

  const payload = parseJsonOutput<{ taskDefinition?: Record<string, unknown> }>(result.stdout || "", {});
  const taskDefinition = payload.taskDefinition;
  if (!taskDefinition || !taskDefinitionMatchesCreateRequest(taskDefinition, request, config, efsAccessPointId)) {
    return undefined;
  }

  const taskDefinitionArn = taskDefinition.taskDefinitionArn;
  return typeof taskDefinitionArn === "string" && taskDefinitionArn ? taskDefinitionArn : undefined;
}

function isMissingTaskDefinitionOutput(output: string): boolean {
  return isMissingAwsCleanupOutput(output) || /Unable to describe task definition|ClientException/i.test(output);
}

function taskDefinitionMatchesCreateRequest(
  taskDefinition: Record<string, unknown>,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  efsAccessPointId: string,
): boolean {
  return (
    taskDefinitionHasRequestedTier(taskDefinition, request) &&
    taskDefinitionHasRuntimePlatform(taskDefinition) &&
    taskDefinitionHasEfsAccessPoint(taskDefinition, efsAccessPointId) &&
    taskDefinitionHasDesiredContainer(taskDefinition, request, config)
  );
}

function taskDefinitionHasRequestedTier(taskDefinition: Record<string, unknown>, request: AwsRuntimeRequest): boolean {
  const tier = resolveAwsRuntimeTier(request.tier);
  const ephemeralStorage = taskDefinition.ephemeralStorage as Record<string, unknown> | undefined;
  return (
    `${taskDefinition.cpu || ""}` === `${tier.cpu}` &&
    `${taskDefinition.memory || ""}` === `${tier.memory}` &&
    ephemeralStorage?.sizeInGiB === tier.ephemeralStorageGib
  );
}

function taskDefinitionHasRuntimePlatform(taskDefinition: Record<string, unknown>): boolean {
  const runtimePlatform = taskDefinition.runtimePlatform as Record<string, unknown> | undefined;
  return runtimePlatform?.cpuArchitecture === "X86_64" && runtimePlatform?.operatingSystemFamily === "LINUX";
}

function taskDefinitionHasEfsAccessPoint(taskDefinition: Record<string, unknown>, efsAccessPointId: string): boolean {
  const volumes = Array.isArray(taskDefinition.volumes) ? (taskDefinition.volumes as Record<string, unknown>[]) : [];
  return volumes.some((volume) => {
    const efsVolume = volume.efsVolumeConfiguration as Record<string, unknown> | undefined;
    const authorizationConfig = efsVolume?.authorizationConfig as Record<string, unknown> | undefined;
    return authorizationConfig?.accessPointId === efsAccessPointId;
  });
}

function taskDefinitionHasDesiredContainer(
  taskDefinition: Record<string, unknown>,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): boolean {
  const liveContainer = resolvePrimaryContainerDefinition(taskDefinition, config.containerName);
  if (liveContainer.image !== config.image) {
    return false;
  }

  const liveEnvironment = toEnvironmentMap(liveContainer.environment);
  return buildRuntimeEnvironment(request).every((entry) => liveEnvironment.get(entry.name) === entry.value);
}

async function reconcileRuntimeConfiguration(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
  healthProbe: AwsRuntimeHealthProbe,
): Promise<AwsRuntimeDiff | undefined> {
  const liveTaskDefinition = describeRuntimeTaskDefinition(commandRunner, request, config, liveState);
  const diff = diffRuntimeConfiguration(request, config, liveState, liveTaskDefinition);

  if (isRuntimeDiffEmpty(diff)) {
    ensureRuntimeAlarms(commandRunner, request, config, requireRuntimeTargetGroupArn(request, liveState));
    return undefined;
  }

  const taskDefinitionArn = registerTaskDefinitionForExistingRuntime(commandRunner, request, config, liveState);
  await updateRuntimeServiceTaskDefinition(commandRunner, request, config, taskDefinitionArn, healthProbe);
  updateRuntimeServiceTags(commandRunner, request, config, liveState);
  ensureRuntimeAlarms(commandRunner, request, config, requireRuntimeTargetGroupArn(request, liveState));

  return diff;
}

function describeRuntimeTaskDefinition(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): Record<string, unknown> {
  if (!liveState.taskDefinitionArn) {
    throw new Error(`AWS runtime "${request.runtimeName}" is missing task definition metadata`);
  }

  return describeLiveTaskDefinition(commandRunner, request, config, liveState.taskDefinitionArn);
}

function registerTaskDefinitionForExistingRuntime(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): string {
  if (!liveState.efsAccessPointId) {
    throw new Error(`AWS runtime "${request.runtimeName}" is missing EFS access point metadata`);
  }

  return registerTaskDefinition(commandRunner, request, config, liveState.efsAccessPointId);
}

function diffRuntimeConfiguration(
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
  liveTaskDefinition: Record<string, unknown>,
): AwsRuntimeDiff {
  const requestedTier = resolveRuntimeTier(request.tier);
  const liveContainer = resolvePrimaryContainerDefinition(liveTaskDefinition, config.containerName);
  const diff: AwsRuntimeDiff = {};

  if (liveState.tier && liveState.tier !== requestedTier) {
    diff.tier = { from: liveState.tier, to: requestedTier };
  }

  const liveImage = typeof liveContainer.image === "string" ? liveContainer.image : undefined;
  if (liveImage && liveImage !== config.image) {
    diff.image = { from: liveImage, to: config.image };
  }

  const changedEnvKeys = diffRuntimeEnvironment(request, liveContainer);
  if (changedEnvKeys.length > 0) {
    diff.envChangedKeys = changedEnvKeys;
  }

  return diff;
}

function resolvePrimaryContainerDefinition(
  taskDefinition: Record<string, unknown>,
  containerName: string,
): Record<string, unknown> {
  const containers = Array.isArray(taskDefinition.containerDefinitions)
    ? (taskDefinition.containerDefinitions as Record<string, unknown>[])
    : [];
  return containers.find((container) => container.name === containerName) || containers[0] || {};
}

function diffRuntimeEnvironment(request: AwsRuntimeRequest, liveContainer: Record<string, unknown>): string[] {
  const liveEnvironment = toEnvironmentMap(liveContainer.environment);
  return buildRuntimeEnvironment(request)
    .filter((entry) => liveEnvironment.get(entry.name) !== entry.value)
    .map((entry) => entry.name)
    .sort();
}

function toEnvironmentMap(environment: unknown): Map<string, string> {
  const entries = Array.isArray(environment) ? (environment as Array<Record<string, unknown>>) : [];
  return new Map(
    entries
      .map((entry) => [entry.name, entry.value])
      .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"),
  );
}

function isRuntimeDiffEmpty(diff: AwsRuntimeDiff): boolean {
  return !diff.tier && !diff.image && (!diff.envChangedKeys || diff.envChangedKeys.length === 0);
}

function requireRuntimeTargetGroupArn(request: AwsRuntimeRequest, liveState: AwsRuntimeLiveState): string {
  if (liveState.targetGroupArn) {
    return liveState.targetGroupArn;
  }

  throw new Error(`AWS runtime "${request.runtimeName}" is missing target group metadata`);
}

function deleteRuntimeResources(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): AwsRuntimeSweptResource[] {
  const targetGroupArn = liveState.targetGroupArn || resolveTargetGroupArnByName(commandRunner, request, config);
  const efsAccessPointId =
    liveState.efsAccessPointId || resolveEfsAccessPointIdByRootPath(commandRunner, request, config);
  const swept: AwsRuntimeSweptResource[] = [];

  if (deleteRuntimeAlarms(commandRunner, request, config)) {
    swept.push("alarms");
  }

  if (deleteListenerRuleIfPresent(commandRunner, request, config, targetGroupArn)) {
    swept.push("listener-rule");
  }

  if (liveState.status === "existing" && deleteEcsService(commandRunner, request, config)) {
    waitForRuntimeServiceDeletion(commandRunner, request, config);
    swept.push("service");
  }

  if (deleteTargetGroupIfPresent(commandRunner, request, config, targetGroupArn)) {
    swept.push("target-group");
  }

  if (cleanupRuntimeSnapshotStore(commandRunner, request, config, liveState, efsAccessPointId)) {
    swept.push("snapshots");
  }

  if (deleteEfsAccessPointIfPresent(commandRunner, request, config, efsAccessPointId)) {
    swept.push("access-point");
  }

  return swept;
}

function describeRuntimeWithCommandRunner(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
): AwsRuntimeLiveState {
  const describeResult = commandRunner([
    "ecs",
    "describe-services",
    "--region",
    resolveRuntimeRegion(request.region),
    "--cluster",
    resolveAwsRuntimeClusterName(),
    "--services",
    buildAwsRuntimeServiceName(request),
    "--include",
    "TAGS",
    "--output",
    "json",
  ]);

  const output = buildAwsCommandOutput(describeResult);
  if ((describeResult.status ?? 1) !== 0) {
    return isMissingAwsServiceOutput(output)
      ? buildMissingLiveState(request, output)
      : buildIndeterminateLiveState(request, output);
  }

  const payload = parseJsonOutput<{ services?: Array<Record<string, unknown>>; failures?: unknown[] }>(
    describeResult.stdout || "",
    {},
  );
  const service = payload.services?.[0];
  if (!service || service.status === "INACTIVE") {
    return buildMissingLiveState(request, output);
  }

  return buildLiveStateFromService(request, service);
}

export function createAwsRuntimeCommandBackend(
  commandRunner: AwsCommandRunner = runAwsCommand,
  options: AwsRuntimeCommandBackendOptions = {},
): AwsRuntimeBackend {
  const healthProbe = options.healthProbe || probePublicRuntimeHealth;

  return {
    async describeRuntime(request) {
      return describeRuntimeWithCommandRunner(commandRunner, request);
    },

    async inspectSnapshotRestore(request, liveState) {
      return liveState.status === "existing"
        ? readRestoredSnapshotTimestampFromLogs(commandRunner, request, liveState)
        : undefined;
    },

    async createRuntime(request) {
      const config = resolveAwsRuntimeCommandConfig(request);
      const adopted: AwsRuntimeAdoptedResource[] = [];
      const runtimeTask = registerTaskDefinitionForNewAccessPoint(commandRunner, request, config);
      if (runtimeTask.adopted) {
        adopted.push("access-point");
      }

      const targetGroup = ensureTargetGroup(commandRunner, request, config);
      if (targetGroup.adopted) {
        adopted.push("target-group");
      }

      if (ensureListenerRule(commandRunner, request, config, targetGroup.targetGroupArn)) {
        adopted.push("listener-rule");
      }

      if (
        await ensureEcsService(
          commandRunner,
          request,
          config,
          runtimeTask,
          targetGroup.targetGroupArn,
          healthProbe,
          () => describeRuntimeWithCommandRunner(commandRunner, request),
        )
      ) {
        adopted.push("service");
      }

      ensureRuntimeAlarms(commandRunner, request, config, targetGroup.targetGroupArn);

      return adopted;
    },

    async reconcileRuntime(request, liveState) {
      const config = resolveAwsRuntimeCommandConfig(request);
      return reconcileRuntimeConfiguration(commandRunner, request, config, liveState, healthProbe);
    },

    async updateRuntimeTier(request) {
      const config = resolveAwsRuntimeCommandConfig(request);
      const liveState = describeRuntimeWithCommandRunner(commandRunner, request);
      const taskDefinitionArn = registerTaskDefinitionFromLiveRuntime(commandRunner, request, config, liveState);
      await updateRuntimeServiceTaskDefinition(commandRunner, request, config, taskDefinitionArn, healthProbe);
      updateRuntimeServiceTags(commandRunner, request, config, liveState);
      ensureRuntimeAlarms(commandRunner, request, config, requireRuntimeTargetGroupArn(request, liveState));
    },

    async deleteRuntime(request, describedLiveState) {
      const config = resolveAwsRuntimeCommandConfig(request);
      const liveState = describedLiveState || describeRuntimeWithCommandRunner(commandRunner, request);

      if (liveState.status === "indeterminate") {
        throw new Error(`Unable to verify AWS runtime "${request.runtimeName}": ${liveState.describeError}`);
      }

      return deleteRuntimeResources(commandRunner, request, config, liveState);
    },
  };
}

export function buildAwsRuntimeEndpointUrl(options: {
  domain?: string;
  environmentId: DeploymentEnvironmentId;
  runtimeName: string;
  runtimeKind: AwsRuntimeKind;
  endpointKind: AwsRuntimeEndpointKind;
}): string {
  return buildRuntimeEndpointUrl(
    resolveRuntimeDomain(options.domain),
    options.environmentId,
    options.runtimeName,
    options.runtimeKind,
    options.endpointKind,
  );
}

export function resolveAwsRuntimeEndpoint(options: {
  domain?: string;
  environmentId: DeploymentEnvironmentId;
  runtimeId: string;
  runtimeKind: AwsRuntimeKind;
  endpointKind: AwsRuntimeEndpointKind;
}): string {
  return buildAwsRuntimeEndpointUrl({
    domain: options.domain,
    environmentId: options.environmentId,
    runtimeName: options.runtimeId,
    runtimeKind: options.runtimeKind,
    endpointKind: options.endpointKind,
  });
}

export function classifyAwsRuntimeFailure(error: unknown): AwsRuntimeFailureClassification {
  const message = error instanceof Error ? error.message : String(error);

  if (/Missing AWS runtime foundation config/i.test(message)) {
    return "missing-foundation-config";
  }

  if (/AWS runtime image not found|ImageNotFoundException/i.test(message)) {
    return "image-not-found";
  }

  if (/Unable to verify AWS runtime/i.test(message)) {
    return "runtime-state-indeterminate";
  }

  if (/wait for AWS runtime service stability|ServicesStable failed|stabilization.*timed?-?out/i.test(message)) {
    return "stabilization-timeout";
  }

  if (/rollout failed health check/i.test(message)) {
    return "rollout-failed";
  }

  if (
    /AWS runtime .* does not exist|missing EFS access point metadata|requires environmentId|requires --/i.test(message)
  ) {
    return "runtime-validation";
  }

  if (/Failed to .*aws|Failed to .*AWS|aws exited with code/i.test(message)) {
    return "aws-command-failed";
  }

  return "unknown";
}

export function toAwsRuntimeArtifact(liveState: AwsRuntimeLiveState): AwsRuntimeArtifact {
  return {
    provider: "aws",
    runtimeKind: liveState.runtimeKind,
    runtimeName: liveState.runtimeName,
    serviceName: liveState.serviceName,
    region: liveState.region,
    clusterArn: liveState.clusterArn,
    serviceArn: liveState.serviceArn,
    taskDefinitionArn: liveState.taskDefinitionArn,
    targetGroupArn: liveState.targetGroupArn,
    efsAccessPointId: liveState.efsAccessPointId,
    endpointUrl: liveState.endpointUrl,
    tier: liveState.tier,
    version: liveState.version,
    imageDigest: liveState.imageDigest,
    health: liveState.health,
    restoredFromSnapshot: liveState.restoredFromSnapshot,
  };
}
