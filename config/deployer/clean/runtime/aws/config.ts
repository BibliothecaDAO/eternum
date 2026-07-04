import { type RuntimeKind as AwsRuntimeKind } from "../../../../../common/factory/runtime-endpoints";
import { DEFAULT_TORII_VERSION } from "../../constants";
import type { DeploymentEnvironmentId, IndexerTier } from "../../types";
import type { AwsCommandTag } from "./commands";
import { buildAwsRuntimeServiceName } from "./naming";

const DEFAULT_AWS_RUNTIME_REGION = "us-east-1";
const DEFAULT_AWS_RUNTIME_DOMAIN = "runtime.realms.world";
const DEFAULT_AWS_RUNTIME_CLUSTER = "eternum-game-runtime";
const DEFAULT_AWS_RUNTIME_CONTAINER_NAME = "runtime";
const DEFAULT_AWS_RUNTIME_LOG_GROUP = "/ecs/eternum-game-runtime";
const DEFAULT_AWS_RUNTIME_ASSIGN_PUBLIC_IP = "DISABLED";

const AWS_RUNTIME_TIERS: Record<IndexerTier, AwsRuntimeTierConfig> = {
  basic: {
    cpu: 1024,
    memory: 2048,
    desiredCount: 1,
    ephemeralStorageGib: 25,
  },
  pro: {
    cpu: 2048,
    memory: 4096,
    desiredCount: 1,
    ephemeralStorageGib: 50,
  },
  epic: {
    cpu: 4096,
    memory: 8192,
    desiredCount: 1,
    ephemeralStorageGib: 100,
  },
  legendary: {
    cpu: 8192,
    memory: 16384,
    desiredCount: 1,
    ephemeralStorageGib: 200,
  },
};

export interface AwsRuntimeConfigRequest {
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
  tier?: IndexerTier;
  version?: string;
  region?: string;
}

export interface AwsRuntimeCommandConfig {
  region: string;
  cluster: string;
  snsTopicArn: string;
  image: string;
  imageDigest: string;
  ecrRepositoryName?: string;
  ecrImageTag?: string;
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

export interface AwsRuntimeTierConfig {
  cpu: number;
  memory: number;
  desiredCount: number;
  ephemeralStorageGib: number;
}

export function resolveRuntimeDomain(domain?: string): string {
  return (domain || process.env.AWS_RUNTIME_DOMAIN || DEFAULT_AWS_RUNTIME_DOMAIN).replace(/^https?:\/\//, "");
}

export function resolveRuntimeRegion(region?: string): string {
  return region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || DEFAULT_AWS_RUNTIME_REGION;
}

export function resolveRuntimeTier(tier?: IndexerTier): IndexerTier {
  return tier || "basic";
}

export function resolveRuntimeVersion(request: AwsRuntimeConfigRequest): string {
  return request.version || DEFAULT_TORII_VERSION;
}

export function resolveRuntimeContainerPort(runtimeKind: AwsRuntimeKind): number {
  return runtimeKind === "katana" ? 5050 : 8080;
}

export function resolveRuntimeLogGroup(): string {
  return process.env.AWS_RUNTIME_LOG_GROUP || DEFAULT_AWS_RUNTIME_LOG_GROUP;
}

export function resolveHealthStartPeriodSeconds(): number {
  const configuredSeconds = Number(process.env.AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS || "90");
  if (!Number.isFinite(configuredSeconds)) {
    return 90;
  }

  return Math.max(90, Math.floor(configuredSeconds));
}

export function resolveAwsRuntimeClusterName(): string {
  return process.env.AWS_RUNTIME_CLUSTER || DEFAULT_AWS_RUNTIME_CLUSTER;
}

export function resolveAwsRuntimeCommandConfig(request: AwsRuntimeConfigRequest): AwsRuntimeCommandConfig {
  const assignPublicIp =
    process.env.AWS_RUNTIME_ASSIGN_PUBLIC_IP === "ENABLED" ? "ENABLED" : DEFAULT_AWS_RUNTIME_ASSIGN_PUBLIC_IP;
  const image = resolveRuntimeImageReference(request);

  return {
    region: resolveRuntimeRegion(request.region),
    cluster: resolveAwsRuntimeClusterName(),
    snsTopicArn: requireEnv("AWS_RUNTIME_SNS_TOPIC_ARN"),
    image: image.reference,
    imageDigest: image.digest,
    ecrRepositoryName: image.repositoryName,
    ecrImageTag: image.tag,
    executionRoleArn: requireEnv("AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN"),
    taskRoleArn: process.env.AWS_RUNTIME_TASK_ROLE_ARN?.trim() || undefined,
    subnetIds: requireCsvEnv("AWS_RUNTIME_SUBNET_IDS"),
    securityGroupIds: requireCsvEnv("AWS_RUNTIME_SECURITY_GROUP_IDS"),
    efsFileSystemId: requireEnv("AWS_RUNTIME_EFS_FILE_SYSTEM_ID"),
    vpcId: requireEnv("AWS_RUNTIME_VPC_ID"),
    listenerArn: resolveAwsRuntimeListenerArn(),
    assignPublicIp,
    logGroup: resolveRuntimeLogGroup(),
    containerName: process.env.AWS_RUNTIME_CONTAINER_NAME || DEFAULT_AWS_RUNTIME_CONTAINER_NAME,
  };
}

export function buildAwsRuntimeTags(
  request: AwsRuntimeConfigRequest,
  extraTags: AwsCommandTag[] = [],
): AwsCommandTag[] {
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

export function toEcsTagList(tags: AwsCommandTag[]): string[] {
  return tags.map((tag) => `key=${tag.key},value=${tag.value}`);
}

export function toAwsTagList(tags: AwsCommandTag[]): string[] {
  return tags.map((tag) => `Key=${tag.key},Value=${tag.value}`);
}

export function readTag(tags: unknown, key: string): string | undefined {
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

export function shouldVerifyPublicRuntimeHealth(): boolean {
  return process.env.AWS_RUNTIME_VERIFY_PUBLIC_HEALTH !== "0";
}

export function resolveAwsRuntimeTier(
  tier: IndexerTier = "basic",
  tiers: Record<IndexerTier, AwsRuntimeTierConfig> = AWS_RUNTIME_TIERS,
): AwsRuntimeTierConfig {
  const tierConfig = tiers[tier];
  if (!tierConfig) {
    throw new Error(`Unknown AWS runtime tier "${tier}"`);
  }

  validateSingleWriterRuntimeTier(tier, tierConfig);
  return tierConfig;
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

function resolveAwsRuntimeListenerArn(): string {
  const value = process.env.AWS_RUNTIME_ALB_LISTENER_ARN?.trim() || process.env.AWS_RUNTIME_LISTENER_ARN?.trim();
  if (!value) {
    throw new Error("Missing AWS runtime foundation config: AWS_RUNTIME_ALB_LISTENER_ARN");
  }

  return value;
}

function resolveRuntimeImageReference(request: AwsRuntimeConfigRequest): {
  reference: string;
  digest: string;
  repositoryName?: string;
  tag?: string;
} {
  const version = request.version?.trim();

  if (version) {
    const repositoryUrl = requireEnv("AWS_RUNTIME_ECR_REPOSITORY_URL");
    return {
      reference: `${repositoryUrl}:${version}`,
      digest: "",
      repositoryName: resolveEcrRepositoryName(repositoryUrl),
      tag: version,
    };
  }

  const pinnedImage = requireEnv("AWS_RUNTIME_ECR_IMAGE");
  return {
    reference: pinnedImage,
    digest: pinnedImage,
  };
}

function resolveEcrRepositoryName(repositoryUrl: string): string {
  const repositoryName = repositoryUrl
    .replace(/^https?:\/\//, "")
    .split("/")
    .slice(1)
    .join("/");
  if (!repositoryName) {
    throw new Error(`Missing AWS runtime foundation config: AWS_RUNTIME_ECR_REPOSITORY_URL repository name`);
  }

  return repositoryName;
}

function validateSingleWriterRuntimeTier(tier: IndexerTier, tierConfig: AwsRuntimeTierConfig): void {
  if (tierConfig.desiredCount !== 1) {
    throw new Error(`AWS runtime tier "${tier}" must keep desiredCount pinned to 1`);
  }
}
