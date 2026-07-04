import type { RuntimeKind as AwsRuntimeKind } from "../../../../../common/factory/runtime-endpoints";
import type { DeploymentEnvironmentId, IndexerTier } from "../../types";
import { parseJsonOutput, runRequiredAwsCommand, type AwsCommandRunner } from "./commands";
import {
  resolveAwsRuntimeTier,
  resolveHealthStartPeriodSeconds,
  resolveRuntimeContainerPort,
  resolveRuntimeVersion,
  type AwsRuntimeCommandConfig,
} from "./config";
import { buildAwsRuntimeBasePath } from "./naming";

export interface AwsRuntimeTaskDefinitionRequest {
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
}

export function buildRuntimeEnvironment(
  request: AwsRuntimeTaskDefinitionRequest,
): Array<{ name: string; value: string }> {
  return [
    { name: "RUNTIME_ENVIRONMENT_ID", value: request.environmentId },
    { name: "RUNTIME_KIND", value: request.runtimeKind },
    { name: "RUNTIME_NAME", value: request.runtimeName },
    { name: "RUNTIME_BASE_PATH", value: buildAwsRuntimeBasePath(request) },
    { name: "RUNTIME_VERSION", value: resolveRuntimeVersion(request) },
    { name: "RPC_URL", value: request.rpcUrl || "" },
    { name: "WORLD_ADDRESS", value: request.worldAddress || "" },
    { name: "TORII_WORLD_BLOCK", value: request.worldBlock || "" },
    { name: "TORII_NAMESPACES", value: request.namespaces || "" },
    { name: "TORII_EXTERNAL_CONTRACTS", value: (request.externalContracts || []).join("\n") },
    { name: "DATA_DIR", value: "/data" },
    { name: "SNAPSHOT_DIR", value: "/snapshots" },
    { name: "SNAPSHOT_INTERVAL_SECONDS", value: process.env.AWS_RUNTIME_SNAPSHOT_INTERVAL_SECONDS || "300" },
    { name: "SNAPSHOT_RETAIN", value: process.env.AWS_RUNTIME_SNAPSHOT_RETAIN || "3" },
    { name: "PUBLIC_PORT", value: `${resolveRuntimeContainerPort(request.runtimeKind)}` },
    { name: "INTERNAL_PORT", value: `${request.runtimeKind === "katana" ? 5051 : 8081}` },
  ];
}

export function buildContainerDefinitions(
  request: AwsRuntimeTaskDefinitionRequest,
  config: AwsRuntimeCommandConfig,
): Array<Record<string, unknown>> {
  const containerPort = resolveRuntimeContainerPort(request.runtimeKind);

  return [
    {
      name: config.containerName,
      image: config.image,
      essential: true,
      stopTimeout: 120,
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
          containerPath: "/snapshots",
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
        startPeriod: resolveHealthStartPeriodSeconds(),
      },
    },
  ];
}

export function buildEfsVolume(
  config: AwsRuntimeCommandConfig,
  efsAccessPointId: string,
): Array<Record<string, unknown>> {
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
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ taskDefinition?: Record<string, unknown> }>(result.stdout || "", {});

  if (!payload.taskDefinition) {
    throw new Error(`AWS runtime "${request.runtimeName}" task definition could not be described`);
  }

  return payload.taskDefinition;
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
