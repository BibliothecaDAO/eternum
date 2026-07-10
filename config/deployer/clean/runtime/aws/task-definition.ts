import type { RuntimeKind as AwsRuntimeKind } from "../../../../../common/factory/runtime-endpoints";
import type { DeploymentEnvironmentId, IndexerTier, RuntimeExposurePolicy } from "../../types";
import { parseJsonOutput, runRequiredAwsCommand, type AwsCommandRunner } from "./commands";
import {
  resolveAwsRuntimeTier,
  resolveHealthStartPeriodSeconds,
  resolveRuntimeContainerPort,
  resolveRuntimeVersion,
  type AwsRuntimeCommandConfig,
} from "./config";
import { buildAwsRuntimeBasePath } from "./naming";

export const AWS_RUNTIME_CHECKPOINT_CONTAINER_NAME = "runtime-checkpoint";

export interface AwsRuntimeTaskDefinitionRequest {
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  runtimeInstanceId?: string;
  imageDigest?: string;
  exposurePolicy?: RuntimeExposurePolicy;
  rpcUrl?: string;
  upstreamRpcSecretArn?: string;
  worldAddress?: string;
  worldBlock?: string;
  namespaces?: string;
  externalContracts?: string[];
  tier?: IndexerTier;
  version?: string;
}

export function buildRuntimeEnvironment(
  request: AwsRuntimeTaskDefinitionRequest,
): Array<{ name: string; value: string }> {
  return [
    { name: "RUNTIME_ENVIRONMENT_ID", value: request.environmentId },
    { name: "RUNTIME_KIND", value: request.runtimeKind },
    { name: "RUNTIME_NAME", value: request.runtimeName },
    ...(request.runtimeInstanceId ? [{ name: "RUNTIME_INSTANCE_ID", value: request.runtimeInstanceId }] : []),
    ...(request.imageDigest ? [{ name: "RUNTIME_IMAGE_DIGEST", value: request.imageDigest }] : []),
    ...(request.exposurePolicy ? [{ name: "RUNTIME_EXPOSURE_POLICY", value: request.exposurePolicy }] : []),
    { name: "RUNTIME_BASE_PATH", value: buildAwsRuntimeBasePath(request) },
    { name: "RUNTIME_VERSION", value: resolveRuntimeVersion(request) },
    ...(!request.upstreamRpcSecretArn ? [{ name: "RPC_URL", value: request.rpcUrl || "" }] : []),
    { name: "WORLD_ADDRESS", value: request.worldAddress || "" },
    { name: "TORII_WORLD_BLOCK", value: request.worldBlock || "" },
    { name: "TORII_NAMESPACES", value: request.namespaces || "" },
    { name: "TORII_EXTERNAL_CONTRACTS", value: (request.externalContracts || []).join("\n") },
    { name: "DATA_DIR", value: "/data" },
    { name: "SNAPSHOT_DIR", value: "/snapshots" },
    { name: "SNAPSHOT_INTERVAL_SECONDS", value: process.env.AWS_RUNTIME_SNAPSHOT_INTERVAL_SECONDS || "300" },
    { name: "SNAPSHOT_RETAIN", value: process.env.AWS_RUNTIME_SNAPSHOT_RETAIN || "12" },
    { name: "SNAPSHOT_MAX_CONSECUTIVE_FAILURES", value: "3" },
    { name: "PROXY_CORS_ORIGINS", value: process.env.AWS_RUNTIME_CORS_ORIGINS || "" },
    { name: "PROXY_MAX_BODY_BYTES", value: process.env.AWS_RUNTIME_PROXY_MAX_BODY_BYTES || "1048576" },
    { name: "PROXY_MAX_URL_BYTES", value: process.env.AWS_RUNTIME_PROXY_MAX_URL_BYTES || "8192" },
    { name: "PROXY_UPSTREAM_TIMEOUT_MS", value: process.env.AWS_RUNTIME_PROXY_UPSTREAM_TIMEOUT_MS || "30000" },
    {
      name: "PROXY_MAX_WEBSOCKET_CONNECTIONS",
      value: process.env.AWS_RUNTIME_PROXY_MAX_WEBSOCKET_CONNECTIONS || "100",
    },
    { name: "PUBLIC_PORT", value: `${resolveRuntimeContainerPort(request.runtimeKind)}` },
    { name: "INTERNAL_PORT", value: `${request.runtimeKind === "katana" ? 5051 : 8081}` },
  ];
}

export function buildContainerDefinitions(
  request: AwsRuntimeTaskDefinitionRequest,
  config: AwsRuntimeCommandConfig,
): Array<Record<string, unknown>> {
  return [buildRuntimeContainerDefinition(request, config), buildCheckpointContainerDefinition(request, config)];
}

function buildRuntimeContainerDefinition(
  request: AwsRuntimeTaskDefinitionRequest,
  config: AwsRuntimeCommandConfig,
): Record<string, unknown> {
  const containerPort = resolveRuntimeContainerPort(request.runtimeKind);

  return {
    name: config.containerName,
    image: config.image,
    essential: true,
    user: "1000:1000",
    readonlyRootFilesystem: true,
    stopTimeout: 120,
    portMappings: [
      {
        containerPort,
        hostPort: containerPort,
        protocol: "tcp",
      },
    ],
    environment: buildRuntimeEnvironment(request),
    secrets: request.upstreamRpcSecretArn
      ? [
          {
            name: "RPC_URL",
            valueFrom: request.upstreamRpcSecretArn,
          },
        ]
      : [],
    mountPoints: buildRuntimeMountPoints(),
    linuxParameters: buildHardenedLinuxParameters(),
    logConfiguration: buildAwsLogsConfiguration(request, config, request.runtimeKind),
    healthCheck: {
      command: ["CMD-SHELL", "/usr/local/bin/healthcheck.sh"],
      interval: 30,
      timeout: 5,
      retries: 3,
      startPeriod: resolveHealthStartPeriodSeconds(),
    },
  };
}

function buildCheckpointContainerDefinition(
  request: AwsRuntimeTaskDefinitionRequest,
  config: AwsRuntimeCommandConfig,
): Record<string, unknown> {
  return {
    name: AWS_RUNTIME_CHECKPOINT_CONTAINER_NAME,
    image: config.image,
    essential: false,
    user: "1000:1000",
    readonlyRootFilesystem: false,
    entryPoint: ["/usr/local/bin/checkpoint-agent.sh", "serve"],
    environment: buildSnapshotEnvironment(request),
    mountPoints: buildCheckpointMountPoints(),
    linuxParameters: buildHardenedLinuxParameters(),
    logConfiguration: buildAwsLogsConfiguration(request, config, `${request.runtimeKind}-checkpoint`),
  };
}

function buildSnapshotEnvironment(request: AwsRuntimeTaskDefinitionRequest): Array<{ name: string; value: string }> {
  return [
    { name: "RUNTIME_ENVIRONMENT_ID", value: request.environmentId },
    { name: "RUNTIME_KIND", value: request.runtimeKind },
    { name: "RUNTIME_NAME", value: request.runtimeName },
    ...(request.runtimeInstanceId ? [{ name: "RUNTIME_INSTANCE_ID", value: request.runtimeInstanceId }] : []),
    ...(request.imageDigest ? [{ name: "RUNTIME_IMAGE_DIGEST", value: request.imageDigest }] : []),
    { name: "RUNTIME_VERSION", value: resolveRuntimeVersion(request) },
    { name: "WORLD_ADDRESS", value: request.worldAddress || "" },
    { name: "DATA_DIR", value: "/data" },
    { name: "SNAPSHOT_DIR", value: "/snapshots" },
    { name: "SNAPSHOT_RETAIN", value: process.env.AWS_RUNTIME_SNAPSHOT_RETAIN || "12" },
  ];
}

function buildRuntimeMountPoints(): Array<Record<string, unknown>> {
  return [
    { sourceVolume: "runtime-working-data", containerPath: "/data", readOnly: false },
    { sourceVolume: "runtime-data", containerPath: "/snapshots", readOnly: false },
    { sourceVolume: "runtime-tmp", containerPath: "/tmp", readOnly: false },
    { sourceVolume: "runtime-control", containerPath: "/runtime-control", readOnly: false },
  ];
}

function buildCheckpointMountPoints(): Array<Record<string, unknown>> {
  return [
    { sourceVolume: "runtime-working-data", containerPath: "/data", readOnly: false },
    { sourceVolume: "runtime-data", containerPath: "/snapshots", readOnly: false },
    { sourceVolume: "checkpoint-tmp", containerPath: "/tmp", readOnly: false },
    { sourceVolume: "runtime-control", containerPath: "/runtime-control", readOnly: false },
  ];
}

function buildHardenedLinuxParameters(): Record<string, unknown> {
  return {
    initProcessEnabled: true,
    capabilities: {
      drop: ["ALL"],
    },
  };
}

function buildAwsLogsConfiguration(
  request: AwsRuntimeTaskDefinitionRequest,
  config: AwsRuntimeCommandConfig,
  streamPrefix: string,
): Record<string, unknown> {
  return {
    logDriver: "awslogs",
    options: {
      "awslogs-group": config.logGroup,
      "awslogs-region": config.region,
      "awslogs-stream-prefix": streamPrefix,
    },
  };
}

export function buildEfsVolume(
  config: AwsRuntimeCommandConfig,
  efsAccessPointId: string,
): Array<Record<string, unknown>> {
  return [
    {
      name: "runtime-working-data",
    },
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
    {
      name: "runtime-tmp",
    },
    {
      name: "checkpoint-tmp",
    },
    {
      name: "runtime-control",
    },
  ];
}

export function buildResizedTaskDefinition(
  liveTaskDefinition: Record<string, unknown>,
  request: AwsRuntimeTaskDefinitionRequest,
): Record<string, unknown> {
  const tier = resolveAwsRuntimeTier(request.tier);
  const taskDefinition = stripReadonlyTaskDefinitionFields(liveTaskDefinition);

  return {
    ...taskDefinition,
    cpu: `${tier.cpu}`,
    memory: `${tier.memory}`,
    ephemeralStorage: {
      sizeInGiB: tier.ephemeralStorageGib,
    },
    runtimePlatform: buildRuntimePlatform(),
  };
}

export function describeLiveTaskDefinition(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeTaskDefinitionRequest,
  config: AwsRuntimeCommandConfig,
  taskDefinitionArn: string,
): Record<string, unknown> {
  const result = runRequiredAwsCommand(commandRunner, `describe task definition for "${request.runtimeName}"`, [
    "ecs",
    "describe-task-definition",
    "--region",
    config.region,
    "--task-definition",
    taskDefinitionArn,
    "--include",
    "TAGS",
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{
    taskDefinition?: Record<string, unknown>;
    tags?: Array<Record<string, string>>;
  }>(result.stdout || "", {});

  if (!payload.taskDefinition) {
    throw new Error(`AWS runtime "${request.runtimeName}" task definition could not be described`);
  }

  return {
    ...payload.taskDefinition,
    ...(payload.tags ? { tags: payload.tags } : {}),
  };
}

export function buildRuntimePlatform(): Record<string, string> {
  return {
    cpuArchitecture: "X86_64",
    operatingSystemFamily: "LINUX",
  };
}

export function stripReadonlyTaskDefinitionFields(taskDefinition: Record<string, unknown>): Record<string, unknown> {
  const {
    taskDefinitionArn: _taskDefinitionArn,
    revision: _revision,
    status: _status,
    requiresAttributes: _requiresAttributes,
    compatibilities: _compatibilities,
    registeredAt: _registeredAt,
    registeredBy: _registeredBy,
    deregisteredAt: _deregisteredAt,
    ...registerableTaskDefinition
  } = taskDefinition;

  return registerableTaskDefinition;
}
