import type { GameStackRuntimeIdentity } from "../../game-stack";
import type { AwsRuntimeRequest } from "../aws-runtime";
import { AwsRuntimeOperationalError } from "./errors";

const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SHA384_DIGEST_PATTERN = /^sha384:[a-f0-9]{96}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const EC2_INSTANCE_ID_PATTERN = /^i-[a-f0-9]{8}(?:[a-f0-9]{9})?$/;
// DescribeInstances runs after convergence; five minutes tolerates transport delay without turning a point-in-time
// confirmation into reusable inventory evidence.
const MAX_OBSERVED_RUNTIME_AGE_MS = 5 * 60_000;

export interface ObservedKatanaRuntimeArtifactV1 {
  schemaVersion: 1;
  provider: "aws";
  observationSource: "ec2-describe-instances";
  operationId: string;
  observedAt: string;
  region: string;
  ec2InstanceId: string;
  runtimePlatform: "ec2-sev-snp";
  amdSevSnp: "enabled";
  tenancy: "default";
  environmentId: string;
  runtimeKind: "katana";
  runtimeName: string;
  runtimeInstanceId: string;
  version: string;
  vmAssetDigest: string;
  releaseIdentitySha256: string;
  attestationMeasurement: string;
  ownerTags: Record<string, string>;
  runtime: GameStackRuntimeIdentity;
}

export interface ObservedKatanaRuntimeValidationContext {
  expectedRegion: string;
  expectedOperationId: string;
  requestStartedAt: Date;
  validatedAt: Date;
}

export function parseObservedKatanaRuntimeArtifact(value: unknown): ObservedKatanaRuntimeArtifactV1 {
  const artifact = requireRecord(value, "observed Katana runtime artifact");
  return {
    schemaVersion: requireLiteral(artifact, "schemaVersion", 1),
    provider: requireLiteral(artifact, "provider", "aws"),
    observationSource: requireLiteral(artifact, "observationSource", "ec2-describe-instances"),
    operationId: requireString(artifact, "operationId"),
    observedAt: requireTimestamp(artifact, "observedAt"),
    region: requireString(artifact, "region"),
    ec2InstanceId: requirePattern(artifact, "ec2InstanceId", EC2_INSTANCE_ID_PATTERN),
    runtimePlatform: requireLiteral(artifact, "runtimePlatform", "ec2-sev-snp"),
    amdSevSnp: requireLiteral(artifact, "amdSevSnp", "enabled"),
    tenancy: requireLiteral(artifact, "tenancy", "default"),
    environmentId: requireString(artifact, "environmentId"),
    runtimeKind: requireLiteral(artifact, "runtimeKind", "katana"),
    runtimeName: requireString(artifact, "runtimeName"),
    runtimeInstanceId: requireString(artifact, "runtimeInstanceId"),
    version: requireString(artifact, "version"),
    vmAssetDigest: requirePattern(artifact, "vmAssetDigest", SHA256_DIGEST_PATTERN),
    releaseIdentitySha256: requirePattern(artifact, "releaseIdentitySha256", SHA256_PATTERN),
    attestationMeasurement: requirePattern(artifact, "attestationMeasurement", SHA384_DIGEST_PATTERN),
    ownerTags: requireStringMap(artifact, "ownerTags"),
    runtime: parseRuntimeIdentity(artifact.runtime),
  };
}

export function assertObservedKatanaMatchesDesiredState(
  desired: AwsRuntimeRequest,
  observed: ObservedKatanaRuntimeArtifactV1,
  context: ObservedKatanaRuntimeValidationContext,
): void {
  for (const [label, actual, expected] of [
    ["region", observed.region, context.expectedRegion],
    ["environmentId", observed.environmentId, desired.environmentId],
    ["runtimeName", observed.runtimeName, desired.runtimeName],
    ["runtimeInstanceId", observed.runtimeInstanceId, desired.runtimeInstanceId],
    ["version", observed.version, desired.version],
    ["vmAssetDigest", observed.vmAssetDigest, desired.imageDigest],
    ["releaseIdentitySha256", observed.releaseIdentitySha256, desired.katanaTeeRelease?.releaseIdentitySha256],
    ["attestationMeasurement", observed.attestationMeasurement, desired.attestationMeasurement],
  ] as const) {
    if (actual !== expected) throw validationError(`Observed Katana runtime does not match desired ${label}`);
  }

  assertObservedOwnerTags(desired, observed.ownerTags);
  assertObservedRuntimeRequestBinding(observed, context);
  if (
    observed.runtime.runtimeName !== observed.runtimeName ||
    observed.runtime.runtimeInstanceId !== observed.runtimeInstanceId ||
    observed.runtime.imageDigest !== observed.vmAssetDigest
  ) {
    throw validationError("Observed Katana runtime identity does not match its EC2 artifact");
  }
}

function assertObservedRuntimeRequestBinding(
  observed: ObservedKatanaRuntimeArtifactV1,
  context: ObservedKatanaRuntimeValidationContext,
): void {
  if (observed.operationId !== context.expectedOperationId) {
    throw validationError("Observed Katana runtime does not match provisioning operation");
  }

  const observedAt = Date.parse(observed.observedAt);
  if (observedAt < context.requestStartedAt.getTime()) {
    throw validationError("Observed Katana runtime predates its provisioning request");
  }
  if (observedAt > context.validatedAt.getTime()) {
    throw validationError("Observed Katana runtime was captured in the future");
  }
  if (context.validatedAt.getTime() - observedAt > MAX_OBSERVED_RUNTIME_AGE_MS) {
    throw validationError("Observed Katana runtime exceeds the five-minute freshness window");
  }
}

function assertObservedOwnerTags(desired: AwsRuntimeRequest, tags: Record<string, string>): void {
  const owner = desired.owner;
  const expectedTags = {
    Project: "eternum",
    Environment: desired.environmentId,
    RuntimeKind: "katana",
    RuntimeName: desired.runtimeName,
    RuntimeInstanceId: desired.runtimeInstanceId,
    RuntimeProvider: "aws",
    RuntimeVersion: desired.version,
    ExposurePolicy: desired.exposurePolicy,
    LifecycleClass: desired.lifecycleClass,
    GameName: owner?.gameName,
    RunKind: owner?.runKind,
    RunName: owner?.runName,
    AutoTeardown: owner?.autoTeardown ? "true" : undefined,
    DeleteAfter: owner?.deleteAfter,
  };
  for (const [tag, expected] of Object.entries(expectedTags)) {
    if (!expected || tags[tag] !== expected) {
      throw validationError(`Observed Katana runtime owner tag does not match desired ${tag}`);
    }
  }
}

function parseRuntimeIdentity(value: unknown): GameStackRuntimeIdentity {
  const runtime = requireRecord(value, "observed Katana runtime identity");
  const endpoints = requireRecord(runtime.endpoints, "observed Katana runtime endpoints");
  const routingShard = runtime.routingShard;
  if (!Number.isInteger(routingShard) || Number(routingShard) < 0) {
    throw validationError("Observed Katana runtime requires a non-negative routingShard");
  }
  return {
    runtimeName: requireString(runtime, "runtimeName"),
    runtimeInstanceId: requireString(runtime, "runtimeInstanceId"),
    imageDigest: requirePattern(runtime, "imageDigest", SHA256_DIGEST_PATTERN),
    chainId: requireString(runtime, "chainId"),
    genesisHash: requireString(runtime, "genesisHash"),
    routingShard: Number(routingShard),
    endpoints: {
      base: requireString(endpoints, "base"),
      health: requireString(endpoints, "health"),
      rpc: requireString(endpoints, "rpc"),
    },
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string" || !field.trim()) {
    throw validationError(`Observed Katana runtime requires ${key}`);
  }
  return field;
}

function requirePattern(value: Record<string, unknown>, key: string, pattern: RegExp): string {
  const field = requireString(value, key);
  if (!pattern.test(field)) throw validationError(`Observed Katana runtime requires canonical ${key}`);
  return field;
}

function requireTimestamp(value: Record<string, unknown>, key: string): string {
  const field = requireString(value, key);
  if (!Number.isFinite(Date.parse(field))) throw validationError(`Observed Katana runtime requires valid ${key}`);
  return field;
}

function requireLiteral<T extends string | number>(value: Record<string, unknown>, key: string, expected: T): T {
  if (value[key] !== expected) throw validationError(`Observed Katana runtime requires ${key}=${expected}`);
  return expected;
}

function requireStringMap(value: Record<string, unknown>, key: string): Record<string, string> {
  const map = requireRecord(value[key], `Observed Katana runtime ${key}`);
  if (Object.values(map).some((entry) => typeof entry !== "string")) {
    throw validationError(`Observed Katana runtime ${key} values must be strings`);
  }
  return map as Record<string, string>;
}

function validationError(message: string): AwsRuntimeOperationalError {
  return new AwsRuntimeOperationalError("runtime-validation", message);
}
