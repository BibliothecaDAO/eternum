import { type RuntimeKind as AwsRuntimeKind } from "../../../../../common/factory/runtime-endpoints";
import { DEFAULT_KATANA_VERSION, DEFAULT_TORII_VERSION } from "../../constants";
import type { DeploymentEnvironmentId, IndexerTier, RuntimeExposurePolicy, RuntimeLifecycleClass } from "../../types";
import type { AwsCommandTag } from "./commands";
import { buildAwsRuntimeServiceName } from "./naming";
import { normalizeRuntimeSegment } from "../../../../../common/factory/runtime-endpoints";

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
  runtimeInstanceId?: string;
  tier?: IndexerTier;
  version?: string;
  imageDigest?: string;
  exposurePolicy?: RuntimeExposurePolicy;
  lifecycleClass?: RuntimeLifecycleClass;
  routingShard?: number;
  region?: string;
  owner?: RuntimeOwnerTagMetadata;
}

export interface AwsRuntimeCommandConfig {
  region: string;
  cluster: string;
  snsTopicArn: string;
  image: string;
  imageDigest: string;
  ecrRepositoryName?: string;
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
  const runtimeDomain = (domain || process.env.AWS_RUNTIME_DOMAIN || DEFAULT_AWS_RUNTIME_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.$/, "");
  const labels = runtimeDomain.split(".");
  const isValidDomain =
    runtimeDomain.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
  if (!isValidDomain) {
    throw new Error(`Invalid AWS runtime domain "${runtimeDomain}"`);
  }

  return runtimeDomain;
}

export function resolveRuntimeRouteHost(
  request: Pick<AwsRuntimeConfigRequest, "environmentId" | "runtimeInstanceId" | "routingShard"> & {
    domain?: string;
    routeHost?: string;
  },
): string {
  if (request.routeHost) {
    return resolveRuntimeDomain(request.routeHost);
  }

  const runtimeDomain = resolveRuntimeDomain(request.domain);
  if (!request.runtimeInstanceId) {
    return runtimeDomain;
  }

  const shard = request.routingShard ?? 0;
  return `s${shard}.${normalizeRuntimeSegment(request.environmentId)}.${runtimeDomain}`;
}

export function resolveRuntimeRegion(region?: string): string {
  return region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || DEFAULT_AWS_RUNTIME_REGION;
}

export function resolveRuntimeTier(tier?: IndexerTier): IndexerTier {
  return tier || "basic";
}

export function resolveRuntimeVersion(request: AwsRuntimeConfigRequest): string {
  return request.version || (request.runtimeKind === "katana" ? DEFAULT_KATANA_VERSION : DEFAULT_TORII_VERSION);
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
    executionRoleArn: requireEnv("AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN"),
    taskRoleArn: process.env.AWS_RUNTIME_TASK_ROLE_ARN?.trim() || undefined,
    subnetIds: requireCsvEnv("AWS_RUNTIME_SUBNET_IDS"),
    securityGroupIds: requireCsvEnv("AWS_RUNTIME_SECURITY_GROUP_IDS"),
    efsFileSystemId: requireEnv("AWS_RUNTIME_EFS_FILE_SYSTEM_ID"),
    vpcId: requireEnv("AWS_RUNTIME_VPC_ID"),
    listenerArn: resolveAwsRuntimeListenerArn(request.routingShard),
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
    ...(request.runtimeInstanceId ? [{ key: "RuntimeInstanceId", value: request.runtimeInstanceId }] : []),
    { key: "RuntimeProvider", value: "aws" },
    { key: "RuntimeTier", value: resolveRuntimeTier(request.tier) },
    { key: "RuntimeVersion", value: resolveRuntimeVersion(request) },
    { key: "RuntimeServiceName", value: buildAwsRuntimeServiceName(request) },
    ...(request.exposurePolicy ? [{ key: "ExposurePolicy", value: request.exposurePolicy }] : []),
    ...(request.lifecycleClass ? [{ key: "LifecycleClass", value: request.lifecycleClass }] : []),
    ...(request.routingShard !== undefined ? [{ key: "RoutingShard", value: `${request.routingShard}` }] : []),
    ...buildRuntimeOwnerTags(request),
    ...extraTags,
  ];
}

function buildRuntimeOwnerTags(request: AwsRuntimeConfigRequest): AwsCommandTag[] {
  const owner = request.owner;
  if (!owner) {
    return [];
  }

  return [
    ...(owner.runtimeInstanceId ? [{ key: "RuntimeInstanceId", value: owner.runtimeInstanceId }] : []),
    { key: "GameName", value: owner.gameName },
    { key: "RunKind", value: owner.runKind },
    { key: "RunName", value: owner.runName },
    ...(owner.autoTeardown ? [{ key: "AutoTeardown", value: "true" }] : []),
    ...(owner.deleteAfter ? [{ key: "DeleteAfter", value: owner.deleteAfter }] : []),
    ...(owner.lifecycleClass ? [{ key: "LifecycleClass", value: owner.lifecycleClass }] : []),
  ];
}

interface RuntimeOwnerTagMetadata {
  runtimeInstanceId?: string;
  gameName: string;
  runKind: "game" | "series" | "rotation";
  runName: string;
  autoTeardown?: boolean;
  deleteAfter?: string;
  lifecycleClass?: RuntimeLifecycleClass;
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

function resolveAwsRuntimeListenerArn(routingShard?: number): string {
  const shardListeners = parseShardListenerArns();
  if (routingShard !== undefined && shardListeners.length > 0) {
    const listenerArn = shardListeners[routingShard];
    if (!listenerArn) {
      throw new Error(`Missing AWS runtime foundation config: listener ARN for routing shard ${routingShard}`);
    }
    return listenerArn;
  }

  const value = process.env.AWS_RUNTIME_ALB_LISTENER_ARN?.trim() || process.env.AWS_RUNTIME_LISTENER_ARN?.trim();
  if (!value) {
    throw new Error("Missing AWS runtime foundation config: AWS_RUNTIME_ALB_LISTENER_ARN");
  }

  return value;
}

function parseShardListenerArns(): string[] {
  const value = process.env.AWS_RUNTIME_ALB_LISTENER_ARNS?.trim();
  if (!value) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Invalid AWS runtime foundation config: AWS_RUNTIME_ALB_LISTENER_ARNS must be JSON");
  }

  if (!Array.isArray(parsed) || parsed.some((listenerArn) => typeof listenerArn !== "string" || !listenerArn)) {
    throw new Error("Invalid AWS runtime foundation config: AWS_RUNTIME_ALB_LISTENER_ARNS must be a string array");
  }

  return parsed;
}

function resolveRuntimeImageReference(request: AwsRuntimeConfigRequest): {
  reference: string;
  digest: string;
  repositoryName?: string;
} {
  const imageDigest = normalizeImageDigest(request.imageDigest);
  if (imageDigest) {
    const repositoryUrl = requireEnv("AWS_RUNTIME_ECR_REPOSITORY_URL");
    return {
      reference: `${repositoryUrl}@${imageDigest}`,
      digest: imageDigest,
      repositoryName: resolveEcrRepositoryName(repositoryUrl),
    };
  }

  const pinnedImage = requireEnv("AWS_RUNTIME_ECR_IMAGE");
  const pinnedDigest = /@(sha256:[a-f0-9]{64})$/i.exec(pinnedImage)?.[1];
  if (!pinnedDigest) {
    throw new Error(
      "AWS_RUNTIME_ECR_IMAGE must be pinned as repository@sha256:<64 hex> when imageDigest is not provided",
    );
  }
  return {
    reference: pinnedImage,
    digest: pinnedDigest.toLowerCase(),
    repositoryName: resolveEcrRepositoryName(pinnedImage.split("@")[0]),
  };
}

function normalizeImageDigest(value: string | undefined): string | undefined {
  const digest = value?.trim();
  if (!digest) {
    return undefined;
  }

  if (!/^sha256:[a-f0-9]{64}$/i.test(digest)) {
    throw new Error(`Invalid AWS runtime image digest "${digest}"`);
  }

  return digest.toLowerCase();
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
