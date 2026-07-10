import type { SpawnSyncReturns } from "node:child_process";
import {
  buildRuntimeEndpointUrl,
  type RuntimeEndpointKind as AwsRuntimeEndpointKind,
} from "../../../../common/factory/runtime-endpoints";
import type { DeploymentEnvironmentId, IndexerTier, RuntimeExposurePolicy, RuntimeLifecycleClass } from "../types";
import {
  buildAwsRuntimeTags,
  readTag,
  resolveAwsRuntimeClusterName,
  resolveAwsRuntimeCommandConfig,
  resolveAwsRuntimeTier,
  resolveRuntimeDomain,
  resolveRuntimeLogGroup,
  resolveRuntimeRegion,
  resolveRuntimeRouteHost,
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
  AWS_RUNTIME_CHECKPOINT_CONTAINER_NAME,
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
  deleteRuntimeTaskDefinitionRevisions,
  ensureEcsService,
  pruneRuntimeTaskDefinitionRevisions,
  registerTaskDefinitionFromLiveRuntime,
  updateRuntimeServiceTags,
  updateRuntimeServiceTaskDefinition,
  waitForRuntimeServiceDeletion,
  type AwsRuntimeRegisteredTask,
} from "./aws/service";
import { deleteAwsRuntime as deleteAwsRuntimeFromReconcile } from "./aws/reconcile";
import {
  checkpointRuntimeBeforeMutation,
  ensureRuntimeRouteAssignment,
  recordRuntimeDeletionAudit,
  resolveExistingRuntimeRouteAssignment,
  withRuntimeMutationLease,
} from "./aws/control";
import { requireRuntimeInstanceId, type RuntimeIdentity } from "./runtime-identity";
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
export type AwsRuntimeAction = "created" | "already-live" | "updated" | "deleted" | "already-missing" | "skipped-stale";
export type AwsRuntimeAdoptedResource = "access-point" | "target-group" | "listener-rule" | "service";
export type AwsRuntimeSweptResource =
  | "alarms"
  | "snapshots"
  | "listener-rule"
  | "service"
  | "task-definitions"
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
  environmentId?: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  runtimeInstanceId?: string;
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
  exposurePolicy?: RuntimeExposurePolicy;
  lifecycleClass?: RuntimeLifecycleClass;
  autoTeardown?: boolean;
  deleteAfter?: string;
  routingShard?: number;
  routeHost?: string;
  health?: AwsRuntimeHealth;
  restoredFromSnapshot?: string;
  serviceCreatedAt?: string;
  describeError?: string;
  describedAt?: string;
}

export interface AwsRuntimeArtifact {
  schemaVersion: 2;
  provider: "aws";
  identity?: RuntimeIdentity;
  environmentId?: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  runtimeInstanceId?: string;
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
  exposurePolicy?: RuntimeExposurePolicy;
  lifecycleClass?: RuntimeLifecycleClass;
  autoTeardown?: boolean;
  deleteAfter?: string;
  routingShard?: number;
  routeHost?: string;
  endpoints?: Partial<Record<AwsRuntimeEndpointKind, string>>;
  snapshotStatus: {
    state: "unknown" | "restored";
    restoredFromSnapshot?: string;
  };
  deploymentTimestamps: {
    serviceCreatedAt?: string;
    observedAt?: string;
  };
  health?: AwsRuntimeHealth;
  restoredFromSnapshot?: string;
}

export interface AwsRuntimeRequest {
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  runtimeInstanceId?: string;
  rpcUrl?: string;
  worldAddress?: string;
  worldBlock?: string;
  namespaces?: string;
  externalContracts?: string[];
  tier?: IndexerTier;
  version?: string;
  imageDigest?: string;
  exposurePolicy?: RuntimeExposurePolicy;
  lifecycleClass?: RuntimeLifecycleClass;
  upstreamRpcSecretArn?: string;
  routingShard?: number;
  routeHost?: string;
  region?: string;
  domain?: string;
  retainData?: boolean;
  expectedDeleteAfter?: string;
  owner?: AwsRuntimeOwnerMetadata;
}

export interface AwsRuntimeOwnerMetadata {
  runtimeInstanceId?: string;
  gameName: string;
  runKind: "game" | "series" | "rotation";
  runName: string;
  autoTeardown?: boolean;
  deleteAfter?: string;
  lifecycleClass?: RuntimeLifecycleClass;
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
  upstreamRpcSecretChanged?: boolean;
  taskDefinitionContractChanged?: boolean;
}

export interface AwsRuntimeBackend {
  describeRuntime(request: AwsRuntimeRequest): Promise<AwsRuntimeLiveState>;
  createRuntime(request: AwsRuntimeRequest): Promise<AwsRuntimeAdoptedResource[]>;
  reconcileRuntime?(request: AwsRuntimeRequest, liveState: AwsRuntimeLiveState): Promise<AwsRuntimeDiff | undefined>;
  inspectSnapshotRestore?(request: AwsRuntimeRequest, liveState: AwsRuntimeLiveState): Promise<string | undefined>;
  updateRuntimeTier(request: AwsRuntimeRequest): Promise<void>;
  deleteRuntime(request: AwsRuntimeRequest, liveState?: AwsRuntimeLiveState): Promise<AwsRuntimeSweptResource[]>;
}

export interface AwsRuntimeOwnerTagQuery {
  environmentId: DeploymentEnvironmentId;
  runtimeInstanceId?: string;
  expectedDeleteAfter?: string;
  gameName: string;
  runKind?: "game" | "series" | "rotation";
  runName?: string;
  region?: string;
  domain?: string;
}

export interface AwsRuntimeOwnerTagRequest extends AwsRuntimeOwnerTagQuery {
  runtimeInstanceId: string;
  expectedDeleteAfter: string;
}

export type AwsRuntimeTeardownStatus = "deleted" | "already-missing" | "skipped-stale" | "failed";

export interface AwsRuntimeTeardownOutcome {
  status: AwsRuntimeTeardownStatus;
  runtimeKind?: AwsRuntimeKind;
  runtimeName?: string;
  runtimeInstanceId: string;
  reason?: string;
}

export interface AwsRuntimeGroupDeleteResult {
  outcomes: AwsRuntimeTeardownOutcome[];
  deleted: AwsRuntimeActionResult[];
  skipped: AwsRuntimeLiveState[];
  failed: Array<{ runtime: AwsRuntimeLiveState; errorMessage: string }>;
}

interface AwsRuntimeCommandBackendOptions {
  healthProbe?: AwsRuntimeHealthProbe;
}

function buildLiveStateFromService(request: AwsRuntimeRequest, service: Record<string, unknown>): AwsRuntimeLiveState {
  const tags = service.tags;
  const tier = readTag(tags, "RuntimeTier") as IndexerTier | undefined;
  const version = readTag(tags, "RuntimeVersion");
  const efsAccessPointId = readTag(tags, "EfsAccessPointId");
  const imageDigest =
    readTag(tags, "ImageDigest") || /@(sha256:[a-f0-9]{64})$/i.exec(process.env.AWS_RUNTIME_ECR_IMAGE || "")?.[1];
  const runtimeInstanceId = readTag(tags, "RuntimeInstanceId") || request.runtimeInstanceId;
  const exposurePolicy = (readTag(tags, "ExposurePolicy") || request.exposurePolicy) as
    | RuntimeExposurePolicy
    | undefined;
  const lifecycleClass = (readTag(tags, "LifecycleClass") || request.lifecycleClass) as
    | RuntimeLifecycleClass
    | undefined;
  const routingShardValue = readTag(tags, "RoutingShard");
  const autoTeardown = readTag(tags, "AutoTeardown") === "true";
  const deleteAfter = readTag(tags, "DeleteAfter");
  const routingShard = routingShardValue === undefined ? request.routingShard : Number(routingShardValue);
  const routeHost = resolveRuntimeRouteHost({
    ...request,
    runtimeInstanceId,
    routingShard: Number.isInteger(routingShard) ? routingShard : undefined,
  });
  const loadBalancers = Array.isArray(service.loadBalancers)
    ? (service.loadBalancers as Record<string, unknown>[])
    : [];
  const targetGroupArn = `${loadBalancers[0]?.targetGroupArn || ""}` || readTag(tags, "TargetGroupArn");
  const endpointUrl = buildAwsRuntimeEndpointUrl({
    domain: routeHost,
    environmentId: request.environmentId,
    runtimeName: request.runtimeName,
    runtimeKind: request.runtimeKind,
    endpointKind: "base",
  });

  return {
    provider: "aws",
    environmentId: request.environmentId,
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
    runtimeInstanceId,
    exposurePolicy,
    lifecycleClass,
    autoTeardown,
    deleteAfter,
    routingShard: Number.isInteger(routingShard) ? routingShard : undefined,
    routeHost,
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
    environmentId: request.environmentId,
    runtimeKind: request.runtimeKind,
    runtimeName: request.runtimeName,
    runtimeInstanceId: request.runtimeInstanceId,
    serviceName: buildAwsRuntimeServiceName(request),
    status: "missing",
    region: resolveRuntimeRegion(request.region),
    imageDigest: request.imageDigest,
    exposurePolicy: request.exposurePolicy,
    lifecycleClass: request.lifecycleClass,
    routingShard: request.routingShard,
    routeHost: resolveRuntimeRouteHost(request),
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

function toAwsRuntimeRequestFromTags(
  tags: unknown,
  fallback: Pick<AwsRuntimeRequest, "environmentId" | "region" | "domain">,
): AwsRuntimeRequest | undefined {
  const runtimeKind = readTag(tags, "RuntimeKind") as AwsRuntimeKind | undefined;
  const runtimeName = readTag(tags, "RuntimeName");
  const environmentId = readTag(tags, "Environment");
  const gameName = readTag(tags, "GameName");
  const runKind = readTag(tags, "RunKind") as "game" | "series" | "rotation" | undefined;
  const runName = readTag(tags, "RunName");
  const deleteAfter = readTag(tags, "DeleteAfter");
  const autoTeardown = readTag(tags, "AutoTeardown") === "true";
  const runtimeInstanceId = readTag(tags, "RuntimeInstanceId");
  const lifecycleClass = readTag(tags, "LifecycleClass") as RuntimeLifecycleClass | undefined;

  if (
    (runtimeKind !== "katana" && runtimeKind !== "torii") ||
    !runtimeName ||
    environmentId !== fallback.environmentId
  ) {
    return undefined;
  }

  return {
    environmentId: fallback.environmentId,
    runtimeKind,
    runtimeName,
    runtimeInstanceId,
    lifecycleClass,
    region: fallback.region,
    domain: fallback.domain,
    ...(gameName && runKind && runName
      ? {
          owner: {
            gameName,
            runKind,
            runName,
            autoTeardown,
            runtimeInstanceId,
            lifecycleClass,
            ...(deleteAfter ? { deleteAfter } : {}),
          },
        }
      : {}),
  };
}

function listEnvironmentRuntimeServiceArns(
  commandRunner: AwsCommandRunner,
  request: Pick<AwsRuntimeRequest, "environmentId" | "region">,
): string[] {
  const result = runRequiredAwsCommand(commandRunner, "list environment AWS runtime services", [
    "ecs",
    "list-services",
    "--region",
    resolveRuntimeRegion(request.region),
    "--cluster",
    resolveAwsRuntimeClusterName(),
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ serviceArns?: string[] }>(result.stdout || "", {});
  return payload.serviceArns || [];
}

interface TaggedRuntimeService {
  liveState: AwsRuntimeLiveState;
  tags: unknown;
}

function describeEnvironmentRuntimeServices(
  commandRunner: AwsCommandRunner,
  request: Pick<AwsRuntimeRequest, "environmentId" | "region" | "domain">,
  serviceArns: string[],
): TaggedRuntimeService[] {
  if (serviceArns.length === 0) {
    return [];
  }

  const services = [];

  for (let index = 0; index < serviceArns.length; index += 10) {
    const serviceBatch = serviceArns.slice(index, index + 10);
    const result = runRequiredAwsCommand(commandRunner, "describe environment AWS runtime services", [
      "ecs",
      "describe-services",
      "--region",
      resolveRuntimeRegion(request.region),
      "--cluster",
      resolveAwsRuntimeClusterName(),
      "--services",
      ...serviceBatch,
      "--include",
      "TAGS",
      "--output",
      "json",
    ]);
    const payload = parseJsonOutput<{ services?: Array<Record<string, unknown>> }>(result.stdout || "", {});
    services.push(...(payload.services || []));
  }

  return services
    .map((service) => {
      const tags = service.tags || [];
      const runtimeRequest = toAwsRuntimeRequestFromTags(tags, request);
      if (!runtimeRequest || service.status === "INACTIVE") {
        return undefined;
      }

      return {
        liveState: buildLiveStateFromService(runtimeRequest, { ...service, tags }),
        tags,
      };
    })
    .filter((state): state is TaggedRuntimeService => Boolean(state));
}

function tagsMatchFilters(tags: unknown, filters: Array<{ key: string; values: string[] }>): boolean {
  return filters.every((filter) => {
    const value = readTag(tags, filter.key);
    return value !== undefined && filter.values.includes(value);
  });
}

function isProtectedRuntime(tags: unknown): boolean {
  return readTag(tags, "RetainRuntime") === "true" || readTag(tags, "LifecycleClass") === "shared";
}

function isMainnetRuntime(tags: unknown): boolean {
  return (readTag(tags, "Environment") || "").startsWith("mainnet.");
}

function isRuntimePastDeleteAfter(liveState: AwsRuntimeLiveState): boolean {
  const deleteAfterMs = Date.parse(liveState.deleteAfter || "");
  return (
    liveState.autoTeardown === true &&
    liveState.lifecycleClass !== "shared" &&
    Number.isFinite(deleteAfterMs) &&
    deleteAfterMs <= Date.now()
  );
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
    "--pid-mode",
    "task",
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
  if (!config.ecrRepositoryName) {
    return;
  }

  const imageId = config.imageDigest ? `imageDigest=${config.imageDigest}` : undefined;
  if (!imageId) {
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
    imageId,
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    throw new Error(buildAwsRuntimeImageNotFoundMessage(request, config, result));
  }

  const payload = parseJsonOutput<{ imageDetails?: Array<{ imageDigest?: string }> }>(result.stdout || "", {});
  const imageDigest = payload.imageDetails?.[0]?.imageDigest;
  if (!imageDigest || (config.imageDigest && imageDigest !== config.imageDigest)) {
    throw new Error(`AWS runtime image not found: ${config.ecrRepositoryName}@${config.imageDigest || imageId}`);
  }

  config.imageDigest = imageDigest;
}

function buildAwsRuntimeImageNotFoundMessage(
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  result: SpawnSyncReturns<string>,
): string {
  const output = buildAwsCommandOutput(result);
  const imageName = config.ecrImageTag
    ? `${config.ecrRepositoryName}:${config.ecrImageTag}`
    : `${config.ecrRepositoryName}@${config.imageDigest}`;
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
    taskDefinitionHasDesiredContainers(taskDefinition, request, config)
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
  return (
    runtimePlatform?.cpuArchitecture === "X86_64" &&
    runtimePlatform?.operatingSystemFamily === "LINUX" &&
    taskDefinition.pidMode === "task"
  );
}

function taskDefinitionHasEfsAccessPoint(taskDefinition: Record<string, unknown>, efsAccessPointId: string): boolean {
  const volumes = Array.isArray(taskDefinition.volumes) ? (taskDefinition.volumes as Record<string, unknown>[]) : [];
  return volumes.some((volume) => {
    const efsVolume = volume.efsVolumeConfiguration as Record<string, unknown> | undefined;
    const authorizationConfig = efsVolume?.authorizationConfig as Record<string, unknown> | undefined;
    return authorizationConfig?.accessPointId === efsAccessPointId;
  });
}

function taskDefinitionHasDesiredContainers(
  taskDefinition: Record<string, unknown>,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): boolean {
  const liveContainer = resolvePrimaryContainerDefinition(taskDefinition, config.containerName);
  const checkpointContainer = resolveContainerDefinition(taskDefinition, AWS_RUNTIME_CHECKPOINT_CONTAINER_NAME);
  if (
    !matchesRuntimeContainerContract(liveContainer, config) ||
    !matchesCheckpointContainerContract(checkpointContainer, config)
  ) {
    return false;
  }

  const liveEnvironment = toEnvironmentMap(liveContainer.environment);
  return (
    buildRuntimeEnvironment(request).every((entry) => liveEnvironment.get(entry.name) === entry.value) &&
    matchesUpstreamRpcSecret(liveContainer, request.upstreamRpcSecretArn)
  );
}

function matchesRuntimeContainerContract(container: Record<string, unknown>, config: AwsRuntimeCommandConfig): boolean {
  return (
    container.image === config.image &&
    container.user === "1000:1000" &&
    container.readonlyRootFilesystem === true &&
    dropsAllLinuxCapabilities(container) &&
    hasWritableMount(container, "runtime-working-data", "/data") &&
    hasWritableMount(container, "runtime-data", "/snapshots") &&
    hasWritableMount(container, "runtime-tmp", "/tmp") &&
    hasWritableMount(container, "runtime-control", "/runtime-control")
  );
}

function matchesCheckpointContainerContract(
  container: Record<string, unknown>,
  config: AwsRuntimeCommandConfig,
): boolean {
  return (
    container.image === config.image &&
    container.user === "1000:1000" &&
    container.readonlyRootFilesystem === false &&
    dropsAllLinuxCapabilities(container) &&
    hasWritableMount(container, "runtime-working-data", "/data") &&
    hasWritableMount(container, "runtime-data", "/snapshots") &&
    hasWritableMount(container, "checkpoint-tmp", "/tmp") &&
    hasWritableMount(container, "runtime-control", "/runtime-control")
  );
}

function dropsAllLinuxCapabilities(container: Record<string, unknown>): boolean {
  const linuxParameters = container.linuxParameters as Record<string, unknown> | undefined;
  const capabilities = linuxParameters?.capabilities as Record<string, unknown> | undefined;
  return Array.isArray(capabilities?.drop) && capabilities.drop.includes("ALL");
}

function hasWritableMount(container: Record<string, unknown>, sourceVolume: string, containerPath: string): boolean {
  const mountPoints = Array.isArray(container.mountPoints)
    ? (container.mountPoints as Array<Record<string, unknown>>)
    : [];
  return mountPoints.some(
    (mountPoint) =>
      mountPoint.sourceVolume === sourceVolume &&
      mountPoint.containerPath === containerPath &&
      mountPoint.readOnly === false,
  );
}

function matchesUpstreamRpcSecret(container: Record<string, unknown>, desiredSecretArn?: string): boolean {
  const secrets = Array.isArray(container.secrets) ? (container.secrets as Array<Record<string, unknown>>) : [];
  const rpcSecret = secrets.find((secret) => secret.name === "RPC_URL");
  return desiredSecretArn ? rpcSecret?.valueFrom === desiredSecretArn : rpcSecret === undefined;
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
    updateRuntimeServiceTags(commandRunner, request, config, liveState);
    ensureRuntimeAlarms(commandRunner, request, config, requireRuntimeTargetGroupArn(request, liveState));
    return undefined;
  }

  checkpointRuntimeBeforeMutation(commandRunner, request, config, liveState, "deploy");
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

  if (!matchesUpstreamRpcSecret(liveContainer, request.upstreamRpcSecretArn)) {
    diff.upstreamRpcSecretChanged = true;
  }

  if (
    !taskDefinitionHasRuntimePlatform(liveTaskDefinition) ||
    !matchesRuntimeContainerContract(liveContainer, config) ||
    !matchesCheckpointContainerContract(
      resolveContainerDefinition(liveTaskDefinition, AWS_RUNTIME_CHECKPOINT_CONTAINER_NAME),
      config,
    )
  ) {
    diff.taskDefinitionContractChanged = true;
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

function resolveContainerDefinition(
  taskDefinition: Record<string, unknown>,
  containerName: string,
): Record<string, unknown> {
  const containers = Array.isArray(taskDefinition.containerDefinitions)
    ? (taskDefinition.containerDefinitions as Record<string, unknown>[])
    : [];
  return containers.find((container) => container.name === containerName) || {};
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
  return (
    !diff.tier &&
    !diff.image &&
    !diff.upstreamRpcSecretChanged &&
    !diff.taskDefinitionContractChanged &&
    (!diff.envChangedKeys || diff.envChangedKeys.length === 0)
  );
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

  if (deleteRuntimeTaskDefinitionRevisions(commandRunner, request, config)) {
    swept.push("task-definitions");
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
      return withRuntimeMutationLease(commandRunner, request, "create", async () => {
        const runtimeRequest = withResolvedRuntimeRoute(commandRunner, request);
        const config = resolveAwsRuntimeCommandConfig(runtimeRequest);
        const adopted: AwsRuntimeAdoptedResource[] = [];
        const runtimeTask = registerTaskDefinitionForNewAccessPoint(commandRunner, runtimeRequest, config);
        if (runtimeTask.adopted) {
          adopted.push("access-point");
        }

        const targetGroup = ensureTargetGroup(commandRunner, runtimeRequest, config);
        if (targetGroup.adopted) {
          adopted.push("target-group");
        }

        if (ensureListenerRule(commandRunner, runtimeRequest, config, targetGroup.targetGroupArn)) {
          adopted.push("listener-rule");
        }

        if (
          await ensureEcsService(
            commandRunner,
            runtimeRequest,
            config,
            runtimeTask,
            targetGroup.targetGroupArn,
            healthProbe,
            () => describeRuntimeWithCommandRunner(commandRunner, runtimeRequest),
          )
        ) {
          adopted.push("service");
        }

        ensureRuntimeAlarms(commandRunner, runtimeRequest, config, targetGroup.targetGroupArn);
        pruneRuntimeTaskDefinitionRevisions(commandRunner, runtimeRequest, config);

        return adopted;
      });
    },

    async reconcileRuntime(request, liveState) {
      return withRuntimeMutationLease(commandRunner, request, "deploy", () => {
        const runtimeRequest = withResolvedRuntimeRoute(commandRunner, {
          ...request,
          routingShard: request.routingShard ?? liveState.routingShard,
        });
        const config = resolveAwsRuntimeCommandConfig(runtimeRequest);
        return reconcileRuntimeConfiguration(commandRunner, runtimeRequest, config, liveState, healthProbe);
      });
    },

    async updateRuntimeTier(request) {
      return withRuntimeMutationLease(commandRunner, request, "resize", async () => {
        const liveState = describeRuntimeWithCommandRunner(commandRunner, request);
        const runtimeRequest = withResolvedRuntimeRoute(commandRunner, {
          ...request,
          routingShard: request.routingShard ?? liveState.routingShard,
        });
        const routedConfig = resolveAwsRuntimeCommandConfig(runtimeRequest);
        checkpointRuntimeBeforeMutation(commandRunner, runtimeRequest, routedConfig, liveState, "resize");
        const taskDefinitionArn = registerTaskDefinitionFromLiveRuntime(
          commandRunner,
          runtimeRequest,
          routedConfig,
          liveState,
        );
        await updateRuntimeServiceTaskDefinition(
          commandRunner,
          runtimeRequest,
          routedConfig,
          taskDefinitionArn,
          healthProbe,
        );
        updateRuntimeServiceTags(commandRunner, runtimeRequest, routedConfig, liveState);
        ensureRuntimeAlarms(
          commandRunner,
          runtimeRequest,
          routedConfig,
          requireRuntimeTargetGroupArn(runtimeRequest, liveState),
        );
        pruneRuntimeTaskDefinitionRevisions(commandRunner, runtimeRequest, routedConfig);
      });
    },

    async deleteRuntime(request, _describedLiveState) {
      return withRuntimeMutationLease(commandRunner, request, "delete", () => {
        const liveState = describeRuntimeWithCommandRunner(commandRunner, request);

        if (liveState.status === "indeterminate") {
          throw new Error(`Unable to verify AWS runtime "${request.runtimeName}": ${liveState.describeError}`);
        }

        const runtimeRequest = resolveExistingRuntimeRouteAssignment(commandRunner, {
          ...request,
          routingShard: request.routingShard ?? liveState.routingShard,
          routeHost: request.routeHost ?? liveState.routeHost,
        });
        const config = resolveAwsRuntimeCommandConfig(runtimeRequest);
        assertRuntimeDeleteRequestIsCurrent(runtimeRequest, liveState);
        checkpointRuntimeBeforeMutation(commandRunner, runtimeRequest, config, liveState, "delete");
        const swept = deleteRuntimeResources(commandRunner, runtimeRequest, config, liveState);
        recordRuntimeDeletionAudit(commandRunner, runtimeRequest);
        return swept;
      });
    },
  };
}

function withResolvedRuntimeRoute(commandRunner: AwsCommandRunner, request: AwsRuntimeRequest): AwsRuntimeRequest {
  const routedRequest = ensureRuntimeRouteAssignment(commandRunner, request);
  const routeHost = resolveRuntimeRouteHost(routedRequest);
  return { ...routedRequest, domain: routeHost, routeHost };
}

class AwsRuntimeStaleTeardownError extends Error {
  override name = "AwsRuntimeStaleTeardownError";
}

function assertRuntimeDeleteRequestIsCurrent(request: AwsRuntimeRequest, liveState: AwsRuntimeLiveState): void {
  const expectedDeleteAfterMs = Date.parse(request.expectedDeleteAfter || "");
  if (!Number.isFinite(expectedDeleteAfterMs) || expectedDeleteAfterMs > Date.now()) {
    throw new AwsRuntimeStaleTeardownError(
      `AWS runtime "${request.runtimeName}" teardown expiry is missing, invalid, or still in the future`,
    );
  }

  if (liveState.status !== "existing" || !request.runtimeInstanceId) {
    return;
  }

  if (liveState.runtimeInstanceId !== request.runtimeInstanceId) {
    throw new AwsRuntimeStaleTeardownError(
      `AWS runtime "${request.runtimeName}" instance changed before delete: expected ${request.runtimeInstanceId}, found ${liveState.runtimeInstanceId || "missing"}`,
    );
  }

  const liveDeleteAfterMs = Date.parse(liveState.deleteAfter || "");
  if (
    liveState.lifecycleClass === "shared" ||
    liveState.autoTeardown !== true ||
    !Number.isFinite(expectedDeleteAfterMs) ||
    !Number.isFinite(liveDeleteAfterMs) ||
    expectedDeleteAfterMs !== liveDeleteAfterMs ||
    liveDeleteAfterMs > Date.now()
  ) {
    throw new AwsRuntimeStaleTeardownError(
      `AWS runtime "${request.runtimeName}" teardown preconditions changed before delete`,
    );
  }
}

export async function findAwsRuntimesByOwnerTags(
  request: AwsRuntimeOwnerTagQuery,
  options: { commandRunner?: AwsCommandRunner; includeAllInstances?: boolean } = {},
): Promise<AwsRuntimeLiveState[]> {
  const commandRunner = options.commandRunner || runAwsCommand;
  const filters = [
    { key: "Project", values: ["eternum"] },
    { key: "RuntimeProvider", values: ["aws"] },
    { key: "Environment", values: [request.environmentId] },
    { key: "GameName", values: [request.gameName] },
    ...(request.runKind ? [{ key: "RunKind", values: [request.runKind] }] : []),
    ...(request.runName ? [{ key: "RunName", values: [request.runName] }] : []),
    ...(request.runtimeInstanceId && !options.includeAllInstances
      ? [{ key: "RuntimeInstanceId", values: [request.runtimeInstanceId] }]
      : []),
  ];
  const serviceArns = listEnvironmentRuntimeServiceArns(commandRunner, request);
  return describeEnvironmentRuntimeServices(commandRunner, request, serviceArns)
    .filter((service) => tagsMatchFilters(service.tags, filters))
    .map((service) => service.liveState);
}

export async function findExpiredAwsRuntimes(
  request: { environmentId: DeploymentEnvironmentId; region?: string; domain?: string },
  options: { commandRunner?: AwsCommandRunner } = {},
): Promise<AwsRuntimeLiveState[]> {
  const commandRunner = options.commandRunner || runAwsCommand;
  const filters = [
    { key: "Project", values: ["eternum"] },
    { key: "RuntimeProvider", values: ["aws"] },
    { key: "Environment", values: [request.environmentId] },
    { key: "AutoTeardown", values: ["true"] },
  ];
  const serviceArns = listEnvironmentRuntimeServiceArns(commandRunner, request);
  return describeEnvironmentRuntimeServices(commandRunner, request, serviceArns)
    .filter(
      (service) =>
        tagsMatchFilters(service.tags, filters) && !isMainnetRuntime(service.tags) && !isProtectedRuntime(service.tags),
    )
    .map((service) => service.liveState)
    .filter(isRuntimePastDeleteAfter);
}

export async function deleteAwsRuntimeGroup(
  request: AwsRuntimeOwnerTagRequest,
  options: { commandRunner?: AwsCommandRunner; backend?: AwsRuntimeBackend } = {},
): Promise<AwsRuntimeGroupDeleteResult> {
  validateRuntimeTeardownRequest(request);
  const commandRunner = options.commandRunner;
  const runtimes = await findAwsRuntimesByOwnerTags(request, { commandRunner, includeAllInstances: true });
  const backend = options.backend || (commandRunner ? createAwsRuntimeCommandBackend(commandRunner) : undefined);
  const result: AwsRuntimeGroupDeleteResult = {
    outcomes: [],
    deleted: [],
    skipped: [],
    failed: [],
  };

  if (runtimes.length === 0) {
    result.outcomes.push({
      status: "already-missing",
      runtimeInstanceId: request.runtimeInstanceId,
      reason: "no runtime resources matched the current owner tags",
    });
    return result;
  }

  for (const runtime of runtimes) {
    if (!runtimeMatchesDeletePreconditions(runtime, request)) {
      result.skipped.push(runtime);
      result.outcomes.push(buildRuntimeTeardownOutcome("skipped-stale", request, runtime));
      continue;
    }

    try {
      const deleted = await deleteAwsRuntimeFromReconcile(
        {
          environmentId: request.environmentId,
          runtimeKind: runtime.runtimeKind,
          runtimeName: runtime.runtimeName,
          runtimeInstanceId: runtime.runtimeInstanceId,
          lifecycleClass: runtime.lifecycleClass,
          exposurePolicy: runtime.exposurePolicy,
          expectedDeleteAfter: request.expectedDeleteAfter,
          region: request.region,
          domain: request.domain,
        },
        backend ? { backend } : {},
      );
      if (deleted.action === "skipped-stale") {
        result.skipped.push(deleted.liveState);
        result.outcomes.push(
          buildRuntimeTeardownOutcome(
            "skipped-stale",
            request,
            deleted.liveState,
            `AWS runtime "${runtime.runtimeName}" teardown preconditions changed before delete`,
          ),
        );
        continue;
      }
      result.deleted.push(deleted);
      result.outcomes.push(
        buildRuntimeTeardownOutcome(
          deleted.action === "already-missing" ? "already-missing" : "deleted",
          request,
          runtime,
        ),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (error instanceof AwsRuntimeStaleTeardownError) {
        result.skipped.push(runtime);
        result.outcomes.push(buildRuntimeTeardownOutcome("skipped-stale", request, runtime, errorMessage));
        continue;
      }
      result.failed.push({
        runtime,
        errorMessage,
      });
      result.outcomes.push(buildRuntimeTeardownOutcome("failed", request, runtime, errorMessage));
    }
  }

  return result;
}

function validateRuntimeTeardownRequest(request: AwsRuntimeOwnerTagRequest): void {
  requireRuntimeInstanceId(request.runtimeInstanceId);
  if (!Number.isFinite(Date.parse(request.expectedDeleteAfter))) {
    throw new Error("Runtime teardown requires a valid expectedDeleteAfter timestamp");
  }
}

function buildRuntimeTeardownOutcome(
  status: AwsRuntimeTeardownStatus,
  request: AwsRuntimeOwnerTagRequest,
  runtime: AwsRuntimeLiveState,
  reason?: string,
): AwsRuntimeTeardownOutcome {
  return {
    status,
    runtimeKind: runtime.runtimeKind,
    runtimeName: runtime.runtimeName,
    runtimeInstanceId: request.runtimeInstanceId,
    ...(reason ? { reason } : {}),
  };
}

function runtimeMatchesDeletePreconditions(runtime: AwsRuntimeLiveState, request: AwsRuntimeOwnerTagRequest): boolean {
  if (runtime.status !== "existing" || runtime.lifecycleClass === "shared") {
    return false;
  }

  if (request.runtimeInstanceId && runtime.runtimeInstanceId !== request.runtimeInstanceId) {
    return false;
  }

  if (!request.expectedDeleteAfter) {
    return true;
  }

  const expectedDeleteAtMs = Date.parse(request.expectedDeleteAfter);
  const liveDeleteAtMs = Date.parse(runtime.deleteAfter || "");
  return (
    runtime.autoTeardown === true &&
    Number.isFinite(expectedDeleteAtMs) &&
    Number.isFinite(liveDeleteAtMs) &&
    expectedDeleteAtMs === liveDeleteAtMs &&
    liveDeleteAtMs <= Date.now()
  );
}

export function buildAwsRuntimeEndpointUrl(options: {
  domain?: string;
  environmentId: DeploymentEnvironmentId;
  runtimeName: string;
  runtimeInstanceId?: string;
  runtimeKind: AwsRuntimeKind;
  routingShard?: number;
  routeHost?: string;
  endpointKind: AwsRuntimeEndpointKind;
}): string {
  return buildRuntimeEndpointUrl(
    resolveRuntimeRouteHost(options),
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
    /AWS runtime request file|AWS runtime .* does not exist|missing EFS access point metadata|requires environmentId|requires --|runtimeInstanceId (?:is required|must be a lowercase RFC 9562 UUID)|expectedDeleteAfter|Invalid runtime name|not permitted in production|imageDigest=|exposurePolicy/i.test(
      message,
    )
  ) {
    return "runtime-validation";
  }

  if (/Failed to .*aws|Failed to .*AWS|aws exited with code/i.test(message)) {
    return "aws-command-failed";
  }

  return "unknown";
}

export function toAwsRuntimeArtifact(liveState: AwsRuntimeLiveState): AwsRuntimeArtifact {
  const endpointKinds: AwsRuntimeEndpointKind[] =
    liveState.runtimeKind === "katana" ? ["base", "health", "rpc"] : ["base", "health", "sql"];
  const endpoints =
    liveState.routeHost && liveState.environmentId
      ? Object.fromEntries(
          endpointKinds.map((endpointKind) => [
            endpointKind,
            buildAwsRuntimeEndpointUrl({
              domain: liveState.routeHost,
              environmentId: liveState.environmentId,
              runtimeName: liveState.runtimeName,
              runtimeKind: liveState.runtimeKind,
              endpointKind,
            }),
          ]),
        )
      : undefined;
  const identity =
    liveState.environmentId && liveState.runtimeInstanceId
      ? {
          environmentId: liveState.environmentId,
          runtimeKind: liveState.runtimeKind,
          runtimeName: liveState.runtimeName,
          runtimeInstanceId: liveState.runtimeInstanceId,
        }
      : undefined;

  return {
    schemaVersion: 2,
    provider: "aws",
    identity,
    environmentId: liveState.environmentId,
    runtimeKind: liveState.runtimeKind,
    runtimeName: liveState.runtimeName,
    runtimeInstanceId: liveState.runtimeInstanceId,
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
    exposurePolicy: liveState.exposurePolicy,
    lifecycleClass: liveState.lifecycleClass,
    autoTeardown: liveState.autoTeardown,
    deleteAfter: liveState.deleteAfter,
    routingShard: liveState.routingShard,
    routeHost: liveState.routeHost,
    endpoints,
    snapshotStatus: {
      state: liveState.restoredFromSnapshot ? "restored" : "unknown",
      restoredFromSnapshot: liveState.restoredFromSnapshot,
    },
    deploymentTimestamps: {
      serviceCreatedAt: liveState.serviceCreatedAt,
      observedAt: liveState.describedAt,
    },
    health: liveState.health,
    restoredFromSnapshot: liveState.restoredFromSnapshot,
  };
}
