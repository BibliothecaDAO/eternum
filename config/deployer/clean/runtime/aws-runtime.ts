import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { DEFAULT_TORII_VERSION } from "../constants";
import type { DeploymentEnvironmentId, IndexerRequest, IndexerTier } from "../types";

const DEFAULT_AWS_RUNTIME_REGION = "us-east-1";
const DEFAULT_AWS_RUNTIME_DOMAIN = "runtime.realms.world";
const DEFAULT_AWS_RUNTIME_CLUSTER = "eternum-game-runtime";
const DEFAULT_AWS_RUNTIME_CONTAINER_NAME = "runtime";
const DEFAULT_AWS_RUNTIME_LOG_GROUP = "/ecs/eternum-game-runtime";
const DEFAULT_AWS_RUNTIME_ASSIGN_PUBLIC_IP = "DISABLED";
const DEFAULT_AWS_RUNTIME_RULE_PRIORITY_BASE = 10_000;
const AWS_COMMAND_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export type AwsRuntimeKind = "katana" | "torii";
export type AwsRuntimeStatus = "existing" | "missing" | "indeterminate";
export type AwsRuntimeHealthStatus = "healthy" | "unhealthy" | "unknown";
export type AwsRuntimeAction = "created" | "already-live" | "updated" | "deleted" | "already-missing";
export type AwsRuntimeFailureClassification =
  | "missing-foundation-config"
  | "aws-command-failed"
  | "runtime-state-indeterminate"
  | "runtime-validation"
  | "unknown";

export interface AwsRuntimeTierConfig {
  cpu: number;
  memory: number;
  desiredCount: number;
  efsProvisionedThroughputMibps: number;
}

export interface AwsRuntimeHealth {
  status: AwsRuntimeHealthStatus;
  checkedAt: string;
  endpoint: string;
  details?: string;
}

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
}

export interface AwsRuntimeRequest {
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  rpcUrl?: string;
  worldAddress?: string;
  namespaces?: string;
  externalContracts?: string[];
  tier?: IndexerTier;
  version?: string;
  region?: string;
  domain?: string;
}

export interface AwsRuntimeActionResult {
  mode: "aws-ecs";
  action: AwsRuntimeAction;
  requestedTier: IndexerTier;
  liveState: AwsRuntimeLiveState;
  previousTier?: IndexerTier;
}

export interface AwsRuntimeBackend {
  describeRuntime(request: AwsRuntimeRequest): Promise<AwsRuntimeLiveState>;
  createRuntime(request: AwsRuntimeRequest): Promise<void>;
  updateRuntimeTier(request: AwsRuntimeRequest): Promise<void>;
  deleteRuntime(request: AwsRuntimeRequest): Promise<void>;
}

interface AwsRuntimeCommandConfig {
  region: string;
  cluster: string;
  image: string;
  executionRoleArn: string;
  taskRoleArn?: string;
  subnetIds: string[];
  securityGroupIds: string[];
  efsFileSystemId: string;
  vpcId: string;
  listenerArn: string;
  assignPublicIp: "ENABLED" | "DISABLED";
  logGroup: string;
  containerName: string;
}

interface AwsRuntimeRegisteredTask {
  taskDefinitionArn: string;
  efsAccessPointId: string;
}

type AwsRuntimeEndpointKind = "base" | "health" | "rpc" | "sql" | "wss";
type AwsCommandRunner = (args: string[]) => SpawnSyncReturns<string>;
type AwsCommandTag = { key: string; value: string };

const AWS_RUNTIME_TIERS: Record<IndexerTier, AwsRuntimeTierConfig> = {
  basic: {
    cpu: 1024,
    memory: 2048,
    desiredCount: 1,
    efsProvisionedThroughputMibps: 8,
  },
  pro: {
    cpu: 2048,
    memory: 4096,
    desiredCount: 1,
    efsProvisionedThroughputMibps: 16,
  },
  epic: {
    cpu: 4096,
    memory: 8192,
    desiredCount: 1,
    efsProvisionedThroughputMibps: 32,
  },
  legendary: {
    cpu: 8192,
    memory: 16384,
    desiredCount: 1,
    efsProvisionedThroughputMibps: 64,
  },
};

function runAwsCommand(args: string[]): SpawnSyncReturns<string> {
  return spawnSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: AWS_COMMAND_MAX_BUFFER_BYTES,
    env: process.env,
  });
}

function normalizeRuntimeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function truncateWithCleanSuffix(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).replace(/-+$/g, "");
}

function resolveRuntimeDomain(domain?: string): string {
  return (domain || process.env.AWS_RUNTIME_DOMAIN || DEFAULT_AWS_RUNTIME_DOMAIN).replace(/^https?:\/\//, "");
}

function resolveRuntimeRegion(region?: string): string {
  return region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || DEFAULT_AWS_RUNTIME_REGION;
}

function resolveRuntimeTier(tier?: IndexerTier): IndexerTier {
  return tier || "basic";
}

function resolveRuntimeVersion(request: AwsRuntimeRequest): string {
  return request.version || DEFAULT_TORII_VERSION;
}

function resolveRuntimeContainerPort(runtimeKind: AwsRuntimeKind): number {
  return runtimeKind === "katana" ? 5050 : 8080;
}

function buildAwsRuntimeBasePath(runtimeName: string, runtimeKind: AwsRuntimeKind): string {
  return `/x/${normalizeRuntimeSegment(runtimeName)}/${runtimeKind}`;
}

function buildEndpointPath(
  runtimeName: string,
  runtimeKind: AwsRuntimeKind,
  endpointKind: AwsRuntimeEndpointKind,
): string {
  const basePath = buildAwsRuntimeBasePath(runtimeName, runtimeKind);

  if (endpointKind === "base") {
    return basePath;
  }

  if (runtimeKind === "katana" && endpointKind === "rpc") {
    return `${basePath}/rpc/v0_9`;
  }

  return `${basePath}/${endpointKind}`;
}

function normalizeCapturedOutput(output: string | null | undefined): string {
  return `${output || ""}`.trim();
}

function buildAwsCommandOutput(result: Pick<SpawnSyncReturns<string>, "stdout" | "stderr">): string {
  return [normalizeCapturedOutput(result.stderr), normalizeCapturedOutput(result.stdout)].filter(Boolean).join("\n");
}

function buildAwsCommandFailureMessage(action: string, result: SpawnSyncReturns<string>): string {
  if (result.error) {
    return `Failed to ${action}: ${result.error.message}`;
  }

  const exitCode = result.status ?? 1;
  const output = buildAwsCommandOutput(result);
  return output ? `Failed to ${action}: ${output}` : `Failed to ${action}: aws exited with code ${exitCode}`;
}

function parseJsonOutput<T>(output: string, fallback: T): T {
  const normalizedOutput = normalizeCapturedOutput(output);
  if (!normalizedOutput) {
    return fallback;
  }

  return JSON.parse(normalizedOutput) as T;
}

function isMissingAwsServiceOutput(output: string): boolean {
  return /MISSING|ServiceNotFound|not found/i.test(output);
}

function isMissingAwsCleanupOutput(output: string): boolean {
  return /MISSING|NotFound|not found|does not exist|not exist/i.test(output);
}

function parseCsvEnv(name: string): string[] {
  return (process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing AWS runtime foundation config: ${name}`);
  }

  return value;
}

function requireCsvEnv(name: string): string[] {
  const values = parseCsvEnv(name);
  if (values.length === 0) {
    throw new Error(`Missing AWS runtime foundation config: ${name}`);
  }

  return values;
}

function resolveAwsRuntimeClusterName(): string {
  return process.env.AWS_RUNTIME_CLUSTER || DEFAULT_AWS_RUNTIME_CLUSTER;
}

function resolveAwsRuntimeListenerArn(): string {
  const value = process.env.AWS_RUNTIME_ALB_LISTENER_ARN?.trim() || process.env.AWS_RUNTIME_LISTENER_ARN?.trim();
  if (!value) {
    throw new Error("Missing AWS runtime foundation config: AWS_RUNTIME_ALB_LISTENER_ARN");
  }

  return value;
}

function resolveAwsRuntimeCommandConfig(request: AwsRuntimeRequest): AwsRuntimeCommandConfig {
  const assignPublicIp =
    process.env.AWS_RUNTIME_ASSIGN_PUBLIC_IP === "ENABLED" ? "ENABLED" : DEFAULT_AWS_RUNTIME_ASSIGN_PUBLIC_IP;

  return {
    region: resolveRuntimeRegion(request.region),
    cluster: resolveAwsRuntimeClusterName(),
    image: requireEnv("AWS_RUNTIME_ECR_IMAGE"),
    executionRoleArn: requireEnv("AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN"),
    taskRoleArn: process.env.AWS_RUNTIME_TASK_ROLE_ARN?.trim() || undefined,
    subnetIds: requireCsvEnv("AWS_RUNTIME_SUBNET_IDS"),
    securityGroupIds: requireCsvEnv("AWS_RUNTIME_SECURITY_GROUP_IDS"),
    efsFileSystemId: requireEnv("AWS_RUNTIME_EFS_FILE_SYSTEM_ID"),
    vpcId: requireEnv("AWS_RUNTIME_VPC_ID"),
    listenerArn: resolveAwsRuntimeListenerArn(),
    assignPublicIp,
    logGroup: process.env.AWS_RUNTIME_LOG_GROUP || DEFAULT_AWS_RUNTIME_LOG_GROUP,
    containerName: process.env.AWS_RUNTIME_CONTAINER_NAME || DEFAULT_AWS_RUNTIME_CONTAINER_NAME,
  };
}

function buildAwsRuntimeTags(request: AwsRuntimeRequest, extraTags: AwsCommandTag[] = []): AwsCommandTag[] {
  return [
    { key: "Project", value: "eternum" },
    { key: "Environment", value: request.environmentId },
    { key: "RuntimeKind", value: request.runtimeKind },
    { key: "RuntimeName", value: request.runtimeName },
    { key: "RuntimeProvider", value: "aws" },
    { key: "RuntimeTier", value: resolveRuntimeTier(request.tier) },
    { key: "RuntimeVersion", value: resolveRuntimeVersion(request) },
    { key: "RuntimeServiceName", value: buildAwsRuntimeServiceName(request) },
    ...extraTags,
  ];
}

function toEcsTagList(tags: AwsCommandTag[]): string[] {
  return tags.map((tag) => `key=${tag.key},value=${tag.value}`);
}

function toAwsTagList(tags: AwsCommandTag[]): string[] {
  return tags.map((tag) => `Key=${tag.key},Value=${tag.value}`);
}

function readTag(tags: unknown, key: string): string | undefined {
  if (!Array.isArray(tags)) {
    return undefined;
  }

  const found = tags.find((tag) => {
    const record = tag as Record<string, unknown>;
    return record.key === key || record.Key === key;
  }) as Record<string, unknown> | undefined;

  const value = found?.value ?? found?.Value;
  return typeof value === "string" && value ? value : undefined;
}

function buildHealthFromEndpoint(endpointUrl: string | undefined): AwsRuntimeHealth | undefined {
  if (!endpointUrl) {
    return undefined;
  }

  return {
    status: "unknown",
    checkedAt: new Date().toISOString(),
    endpoint: buildAwsRuntimeEndpointUrlFromBase(endpointUrl, "health"),
  };
}

function buildAwsRuntimeEndpointUrlFromBase(baseUrl: string, endpointKind: AwsRuntimeEndpointKind): string {
  if (endpointKind === "base") {
    return baseUrl.replace(/\/+$/, "");
  }

  return `${baseUrl.replace(/\/+$/, "")}/${endpointKind}`;
}

function buildLiveStateFromService(request: AwsRuntimeRequest, service: Record<string, unknown>): AwsRuntimeLiveState {
  const tags = service.tags;
  const tier = readTag(tags, "RuntimeTier") as IndexerTier | undefined;
  const version = readTag(tags, "RuntimeVersion");
  const efsAccessPointId = readTag(tags, "EfsAccessPointId");
  const imageDigest =
    readTag(tags, "ImageDigest") || process.env.AWS_RUNTIME_ECR_IMAGE_DIGEST || process.env.AWS_RUNTIME_ECR_IMAGE;
  const loadBalancers = Array.isArray(service.loadBalancers)
    ? (service.loadBalancers as Record<string, unknown>[])
    : [];
  const targetGroupArn = `${loadBalancers[0]?.targetGroupArn || ""}` || readTag(tags, "TargetGroupArn");
  const endpointUrl = buildAwsRuntimeEndpointUrl({
    domain: request.domain,
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
    describedAt: new Date().toISOString(),
  };
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

function requireExistingRuntime(
  request: AwsRuntimeRequest,
  liveState: AwsRuntimeLiveState,
  action: string,
): AwsRuntimeLiveState {
  if (liveState.status !== "existing") {
    throw new Error(`AWS runtime "${request.runtimeName}" is not available after ${action}`);
  }

  return liveState;
}

function runRequiredAwsCommand(
  commandRunner: AwsCommandRunner,
  action: string,
  args: string[],
): SpawnSyncReturns<string> {
  const result = commandRunner(args);
  if ((result.status ?? 1) !== 0) {
    throw new Error(buildAwsCommandFailureMessage(action, result));
  }

  return result;
}

function runOptionalAwsCleanupCommand(
  commandRunner: AwsCommandRunner,
  action: string,
  args: string[],
): SpawnSyncReturns<string> {
  const result = commandRunner(args);
  if ((result.status ?? 1) === 0) {
    return result;
  }

  const output = buildAwsCommandOutput(result);
  if (isMissingAwsCleanupOutput(output)) {
    return result;
  }

  throw new Error(buildAwsCommandFailureMessage(action, result));
}

function commandOutputText(result: SpawnSyncReturns<string>): string {
  return normalizeCapturedOutput(result.stdout);
}

function buildRuntimeRootPath(request: AwsRuntimeRequest): string {
  return `/runtimes/${buildAwsRuntimeServiceName(request)}`;
}

function buildTargetGroupName(request: AwsRuntimeRequest): string {
  return truncateWithCleanSuffix(`${request.runtimeKind}-${hashString(buildAwsRuntimeServiceName(request))}`, 32);
}

function resolveListenerRulePriority(request: AwsRuntimeRequest): number {
  const base = Number(process.env.AWS_RUNTIME_LISTENER_RULE_PRIORITY_BASE || DEFAULT_AWS_RUNTIME_RULE_PRIORITY_BASE);
  const normalizedBase = Number.isFinite(base)
    ? Math.max(1, Math.min(40_000, Math.floor(base)))
    : DEFAULT_AWS_RUNTIME_RULE_PRIORITY_BASE;
  return normalizedBase + (hashString(buildAwsRuntimeServiceName(request)) % 9_000);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function buildRuntimeEnvironment(request: AwsRuntimeRequest): Array<{ name: string; value: string }> {
  return [
    { name: "RUNTIME_KIND", value: request.runtimeKind },
    { name: "RUNTIME_NAME", value: request.runtimeName },
    { name: "RUNTIME_BASE_PATH", value: buildAwsRuntimeBasePath(request.runtimeName, request.runtimeKind) },
    { name: "RUNTIME_VERSION", value: resolveRuntimeVersion(request) },
    { name: "RPC_URL", value: request.rpcUrl || "" },
    { name: "WORLD_ADDRESS", value: request.worldAddress || "" },
    { name: "TORII_NAMESPACES", value: request.namespaces || "" },
    { name: "TORII_EXTERNAL_CONTRACTS", value: (request.externalContracts || []).join("\n") },
    { name: "DATA_DIR", value: "/data" },
    { name: "PUBLIC_PORT", value: `${resolveRuntimeContainerPort(request.runtimeKind)}` },
    { name: "INTERNAL_PORT", value: `${request.runtimeKind === "katana" ? 5051 : 8081}` },
  ];
}

function buildContainerDefinitions(
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): Array<Record<string, unknown>> {
  const containerPort = resolveRuntimeContainerPort(request.runtimeKind);

  return [
    {
      name: config.containerName,
      image: config.image,
      essential: true,
      portMappings: [
        {
          containerPort,
          hostPort: containerPort,
          protocol: "tcp",
        },
      ],
      environment: buildRuntimeEnvironment(request),
      mountPoints: [
        {
          sourceVolume: "runtime-data",
          containerPath: "/data",
          readOnly: false,
        },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": config.logGroup,
          "awslogs-region": config.region,
          "awslogs-stream-prefix": request.runtimeKind,
        },
      },
      healthCheck: {
        command: ["CMD-SHELL", "/usr/local/bin/healthcheck.sh"],
        interval: 30,
        timeout: 5,
        retries: 3,
        startPeriod: 90,
      },
    },
  ];
}

function buildEfsVolume(config: AwsRuntimeCommandConfig, efsAccessPointId: string): Array<Record<string, unknown>> {
  return [
    {
      name: "runtime-data",
      efsVolumeConfiguration: {
        fileSystemId: config.efsFileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: {
          accessPointId: efsAccessPointId,
          iam: "ENABLED",
        },
      },
    },
  ];
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

function createEfsAccessPoint(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): string {
  const result = runRequiredAwsCommand(commandRunner, `create EFS access point for "${request.runtimeName}"`, [
    "efs",
    "create-access-point",
    "--region",
    config.region,
    "--file-system-id",
    config.efsFileSystemId,
    "--posix-user",
    "Uid=1000,Gid=1000",
    "--root-directory",
    `Path=${buildRuntimeRootPath(request)},CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=750}`,
    "--tags",
    ...toAwsTagList(buildAwsRuntimeTags(request)),
    "--query",
    "AccessPointId",
    "--output",
    "text",
  ]);

  return commandOutputText(result);
}

function registerTaskDefinition(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  efsAccessPointId: string,
): string {
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
    "--cpu",
    `${tier.cpu}`,
    "--memory",
    `${tier.memory}`,
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

function createTargetGroup(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): string {
  const healthPath = buildEndpointPath(request.runtimeName, request.runtimeKind, "health");
  const result = runRequiredAwsCommand(commandRunner, `create target group for "${request.runtimeName}"`, [
    "elbv2",
    "create-target-group",
    "--region",
    config.region,
    "--name",
    buildTargetGroupName(request),
    "--protocol",
    "HTTP",
    "--port",
    `${resolveRuntimeContainerPort(request.runtimeKind)}`,
    "--vpc-id",
    config.vpcId,
    "--target-type",
    "ip",
    "--health-check-enabled",
    "--health-check-protocol",
    "HTTP",
    "--health-check-path",
    healthPath,
    "--matcher",
    "HttpCode=200-399",
    "--tags",
    ...toAwsTagList(buildAwsRuntimeTags(request)),
    "--query",
    "TargetGroups[0].TargetGroupArn",
    "--output",
    "text",
  ]);

  return commandOutputText(result);
}

function createListenerRule(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn: string,
): void {
  const basePath = buildAwsRuntimeBasePath(request.runtimeName, request.runtimeKind);

  runRequiredAwsCommand(commandRunner, `create ALB listener rule for "${request.runtimeName}"`, [
    "elbv2",
    "create-rule",
    "--region",
    config.region,
    "--listener-arn",
    config.listenerArn,
    "--priority",
    `${resolveListenerRulePriority(request)}`,
    "--conditions",
    `Field=path-pattern,Values=${basePath},${basePath}/*`,
    "--actions",
    `Type=forward,TargetGroupArn=${targetGroupArn}`,
  ]);
}

function createEcsService(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  runtimeTask: AwsRuntimeRegisteredTask,
  targetGroupArn: string,
): void {
  const tier = resolveAwsRuntimeTier(request.tier);
  const imageDigest = process.env.AWS_RUNTIME_ECR_IMAGE_DIGEST || config.image;

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
    "--enable-execute-command",
    "--tags",
    ...toEcsTagList(
      buildAwsRuntimeTags(request, [
        { key: "EfsAccessPointId", value: runtimeTask.efsAccessPointId },
        { key: "TargetGroupArn", value: targetGroupArn },
        { key: "ImageDigest", value: imageDigest },
      ]),
    ),
  ]);
}

function registerTaskDefinitionForNewAccessPoint(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): AwsRuntimeRegisteredTask {
  const efsAccessPointId = createEfsAccessPoint(commandRunner, request, config);
  const taskDefinitionArn = registerTaskDefinition(commandRunner, request, config, efsAccessPointId);

  return {
    taskDefinitionArn,
    efsAccessPointId,
  };
}

function registerTaskDefinitionForExistingAccessPoint(
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

function buildMutableRuntimeTags(request: AwsRuntimeRequest, liveState: AwsRuntimeLiveState): AwsCommandTag[] {
  const extraTags: AwsCommandTag[] = [];

  if (liveState.efsAccessPointId) {
    extraTags.push({ key: "EfsAccessPointId", value: liveState.efsAccessPointId });
  }

  if (liveState.targetGroupArn) {
    extraTags.push({ key: "TargetGroupArn", value: liveState.targetGroupArn });
  }

  extraTags.push({
    key: "ImageDigest",
    value: process.env.AWS_RUNTIME_ECR_IMAGE_DIGEST || liveState.imageDigest || process.env.AWS_RUNTIME_ECR_IMAGE || "",
  });

  return buildAwsRuntimeTags(
    request,
    extraTags.filter((tag) => tag.value),
  );
}

function updateRuntimeServiceTags(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): void {
  if (!liveState.serviceArn) {
    throw new Error(`AWS runtime "${request.runtimeName}" is missing ECS service metadata`);
  }

  runRequiredAwsCommand(commandRunner, `tag AWS runtime service "${request.runtimeName}"`, [
    "ecs",
    "tag-resource",
    "--region",
    config.region,
    "--resource-arn",
    liveState.serviceArn,
    "--tags",
    ...toEcsTagList(buildMutableRuntimeTags(request, liveState)),
  ]);
}

function resolveListenerRuleArn(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn: string,
): string | undefined {
  const result = commandRunner([
    "elbv2",
    "describe-rules",
    "--region",
    config.region,
    "--listener-arn",
    config.listenerArn,
    "--output",
    "json",
  ]);

  if ((result.status ?? 1) !== 0) {
    const output = buildAwsCommandOutput(result);
    if (isMissingAwsCleanupOutput(output)) {
      return undefined;
    }

    throw new Error(buildAwsCommandFailureMessage(`describe ALB listener rules for "${request.runtimeName}"`, result));
  }

  const payload = parseJsonOutput<{ Rules?: Array<Record<string, unknown>> }>(result.stdout || "", {});
  const priority = `${resolveListenerRulePriority(request)}`;
  const rule = (payload.Rules || []).find((candidate) => {
    const actions = Array.isArray(candidate.Actions) ? (candidate.Actions as Record<string, unknown>[]) : [];
    const forwardsToTargetGroup = actions.some((action) => action.TargetGroupArn === targetGroupArn);
    return forwardsToTargetGroup || candidate.Priority === priority;
  });

  const ruleArn = rule?.RuleArn;
  return typeof ruleArn === "string" && ruleArn ? ruleArn : undefined;
}

function deleteListenerRuleIfPresent(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): void {
  if (!liveState.targetGroupArn) {
    return;
  }

  const ruleArn = resolveListenerRuleArn(commandRunner, request, config, liveState.targetGroupArn);
  if (!ruleArn) {
    return;
  }

  runOptionalAwsCleanupCommand(commandRunner, `delete ALB listener rule for "${request.runtimeName}"`, [
    "elbv2",
    "delete-rule",
    "--region",
    config.region,
    "--rule-arn",
    ruleArn,
  ]);
}

function deleteEcsService(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
): void {
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
}

function waitForRuntimeServiceDeletion(
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

function deleteTargetGroupIfPresent(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): void {
  if (!liveState.targetGroupArn) {
    return;
  }

  runOptionalAwsCleanupCommand(commandRunner, `delete target group for "${request.runtimeName}"`, [
    "elbv2",
    "delete-target-group",
    "--region",
    config.region,
    "--target-group-arn",
    liveState.targetGroupArn,
  ]);
}

function deleteEfsAccessPointIfPresent(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): void {
  if (!liveState.efsAccessPointId) {
    return;
  }

  runOptionalAwsCleanupCommand(commandRunner, `delete EFS access point for "${request.runtimeName}"`, [
    "efs",
    "delete-access-point",
    "--region",
    config.region,
    "--access-point-id",
    liveState.efsAccessPointId,
  ]);
}

function deleteRuntimeResources(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeRequest,
  config: AwsRuntimeCommandConfig,
  liveState: AwsRuntimeLiveState,
): void {
  deleteListenerRuleIfPresent(commandRunner, request, config, liveState);
  deleteEcsService(commandRunner, request, config);
  waitForRuntimeServiceDeletion(commandRunner, request, config);
  deleteTargetGroupIfPresent(commandRunner, request, config, liveState);
  deleteEfsAccessPointIfPresent(commandRunner, request, config, liveState);
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

export function createAwsRuntimeCommandBackend(commandRunner: AwsCommandRunner = runAwsCommand): AwsRuntimeBackend {
  return {
    async describeRuntime(request) {
      return describeRuntimeWithCommandRunner(commandRunner, request);
    },

    async createRuntime(request) {
      const config = resolveAwsRuntimeCommandConfig(request);
      const runtimeTask = registerTaskDefinitionForNewAccessPoint(commandRunner, request, config);
      const targetGroupArn = createTargetGroup(commandRunner, request, config);
      createListenerRule(commandRunner, request, config, targetGroupArn);
      createEcsService(commandRunner, request, config, runtimeTask, targetGroupArn);
    },

    async updateRuntimeTier(request) {
      const config = resolveAwsRuntimeCommandConfig(request);
      const liveState = describeRuntimeWithCommandRunner(commandRunner, request);
      const taskDefinitionArn = registerTaskDefinitionForExistingAccessPoint(commandRunner, request, config, liveState);
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
      ]);

      updateRuntimeServiceTags(commandRunner, request, config, liveState);
    },

    async deleteRuntime(request) {
      const config = resolveAwsRuntimeCommandConfig(request);
      const liveState = describeRuntimeWithCommandRunner(commandRunner, request);

      if (liveState.status === "missing") {
        return;
      }

      if (liveState.status === "indeterminate") {
        throw new Error(`Unable to verify AWS runtime "${request.runtimeName}": ${liveState.describeError}`);
      }

      deleteRuntimeResources(commandRunner, request, config, liveState);
    },
  };
}

export function buildAwsRuntimeEndpointUrl(options: {
  domain?: string;
  runtimeName: string;
  runtimeKind: AwsRuntimeKind;
  endpointKind: AwsRuntimeEndpointKind;
}): string {
  return `https://${resolveRuntimeDomain(options.domain)}${buildEndpointPath(
    options.runtimeName,
    options.runtimeKind,
    options.endpointKind,
  )}`;
}

export function resolveAwsRuntimeEndpoint(options: {
  domain?: string;
  runtimeId: string;
  runtimeKind: AwsRuntimeKind;
  endpointKind: AwsRuntimeEndpointKind;
}): string {
  return buildAwsRuntimeEndpointUrl({
    domain: options.domain,
    runtimeName: options.runtimeId,
    runtimeKind: options.runtimeKind,
    endpointKind: options.endpointKind,
  });
}

export function buildAwsRuntimeServiceName(options: {
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
}): string {
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

export function resolveAwsRuntimeTier(tier: IndexerTier = "basic"): AwsRuntimeTierConfig {
  return AWS_RUNTIME_TIERS[tier];
}

export function classifyAwsRuntimeFailure(error: unknown): AwsRuntimeFailureClassification {
  const message = error instanceof Error ? error.message : String(error);

  if (/Missing AWS runtime foundation config/i.test(message)) {
    return "missing-foundation-config";
  }

  if (/Unable to verify AWS runtime/i.test(message)) {
    return "runtime-state-indeterminate";
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

export function buildAwsToriiRuntimeRequest(request: IndexerRequest): AwsRuntimeRequest {
  if (!request.environmentId) {
    throw new Error("AWS Torii runtime requests require environmentId");
  }

  return {
    environmentId: request.environmentId,
    runtimeKind: "torii",
    runtimeName: request.worldName,
    rpcUrl: request.rpcUrl,
    worldAddress: request.worldAddress,
    namespaces: request.namespaces,
    externalContracts: request.externalContracts || [],
    tier: request.tier || "basic",
    version: request.toriiVersion || DEFAULT_TORII_VERSION,
    domain: request.runtimeDomain,
  };
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
  };
}

export async function ensureAwsRuntime(
  runtimeRequest: AwsRuntimeRequest,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeActionResult> {
  const backend = options.backend || createAwsRuntimeCommandBackend();
  const requestedTier = resolveRuntimeTier(runtimeRequest.tier);
  const currentState = await backend.describeRuntime(runtimeRequest);

  if (currentState.status === "existing") {
    return {
      mode: "aws-ecs",
      action: "already-live",
      requestedTier,
      liveState: currentState,
      previousTier: currentState.tier,
    };
  }

  if (currentState.status === "indeterminate") {
    throw new Error(`Unable to verify AWS runtime "${runtimeRequest.runtimeName}": ${currentState.describeError}`);
  }

  await backend.createRuntime(runtimeRequest);
  const liveState = requireExistingRuntime(runtimeRequest, await backend.describeRuntime(runtimeRequest), "create");

  return {
    mode: "aws-ecs",
    action: "created",
    requestedTier,
    liveState,
    previousTier: currentState.tier,
  };
}

export async function ensureAwsToriiRuntime(
  request: IndexerRequest,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeActionResult> {
  return ensureAwsRuntime(buildAwsToriiRuntimeRequest(request), options);
}

export async function ensureAwsKatanaRuntime(
  request: Omit<AwsRuntimeRequest, "runtimeKind">,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeActionResult> {
  return ensureAwsRuntime({ ...request, runtimeKind: "katana" }, options);
}

export async function resizeAwsRuntime(
  request: AwsRuntimeRequest,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeActionResult> {
  const backend = options.backend || createAwsRuntimeCommandBackend();
  const requestedTier = resolveRuntimeTier(request.tier);
  const currentState = await backend.describeRuntime(request);

  if (currentState.status !== "existing") {
    throw new Error(`AWS runtime "${request.runtimeName}" does not exist`);
  }

  if (currentState.tier === requestedTier) {
    return {
      mode: "aws-ecs",
      action: "already-live",
      requestedTier,
      liveState: currentState,
      previousTier: currentState.tier,
    };
  }

  await backend.updateRuntimeTier(request);
  const liveState = requireExistingRuntime(request, await backend.describeRuntime(request), "resize");

  return {
    mode: "aws-ecs",
    action: "updated",
    requestedTier,
    liveState,
    previousTier: currentState.tier,
  };
}

export async function describeAwsRuntime(
  request: AwsRuntimeRequest,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeLiveState> {
  const backend = options.backend || createAwsRuntimeCommandBackend();
  return backend.describeRuntime(request);
}

export async function deleteAwsRuntime(
  request: AwsRuntimeRequest,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeActionResult> {
  const backend = options.backend || createAwsRuntimeCommandBackend();
  const requestedTier = resolveRuntimeTier(request.tier);
  const currentState = await backend.describeRuntime(request);

  if (currentState.status === "missing") {
    return {
      mode: "aws-ecs",
      action: "already-missing",
      requestedTier,
      liveState: currentState,
      previousTier: currentState.tier,
    };
  }

  if (currentState.status === "indeterminate") {
    throw new Error(`Unable to verify AWS runtime "${request.runtimeName}": ${currentState.describeError}`);
  }

  await backend.deleteRuntime(request);

  return {
    mode: "aws-ecs",
    action: "deleted",
    requestedTier,
    liveState: buildMissingLiveState(request),
    previousTier: currentState.tier,
  };
}
