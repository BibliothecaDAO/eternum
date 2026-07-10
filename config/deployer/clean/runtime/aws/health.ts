import {
  buildRuntimeEndpointUrl,
  type RuntimeEndpointKind as AwsRuntimeEndpointKind,
} from "../../../../../common/factory/runtime-endpoints";
import type { DeploymentEnvironmentId } from "../../types";
import { parseJsonOutput, runRequiredAwsCommand, type AwsCommandRunner } from "./commands";
import { resolveRuntimeDomain, type AwsRuntimeCommandConfig } from "./config";
import { buildAwsRuntimeServiceName } from "./naming";

const DEFAULT_RUNTIME_HEALTH_TIMEOUT_MS = 5_000;
const DEFAULT_KATANA_STABILITY_DEADLINE_MS = 10 * 60 * 1_000;
const DEFAULT_TORII_STABILITY_DEADLINE_MS = 15 * 60 * 1_000;
const DEFAULT_STABILITY_POLL_INTERVAL_MS = 10_000;

export type AwsRuntimeKind = "katana" | "torii";
export type AwsRuntimeHealthStatus = "healthy" | "unhealthy" | "unknown";

export interface AwsRuntimeHealth {
  status: AwsRuntimeHealthStatus;
  checkedAt: string;
  endpoint: string;
  latencyMs?: number;
  details?: string;
}

export interface AwsRuntimeHealthRequest {
  domain?: string;
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
}

export type AwsRuntimeHealthProbe = (endpoint: string) => Promise<AwsRuntimeHealth>;

export interface AwsRuntimeStabilityWaitOptions {
  deadlineMs?: number;
  pollIntervalMs?: number;
}

interface AwsEcsDescribeServicesPayload {
  services?: AwsEcsServiceDescription[];
}

interface AwsEcsServiceDescription extends AwsEcsDeploymentCounts {
  deployments?: AwsEcsDeploymentDescription[];
  status?: string;
}

interface AwsEcsDeploymentDescription extends AwsEcsDeploymentCounts {
  rolloutState?: string;
  rolloutStateReason?: string;
  status?: string;
}

interface AwsEcsDeploymentCounts {
  desiredCount?: number;
  pendingCount?: number;
  runningCount?: number;
}

export function resolveRuntimeHealthTimeoutMs(): number {
  const configuredTimeout = Number(process.env.AWS_RUNTIME_HEALTH_TIMEOUT_MS || "");
  if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) {
    return DEFAULT_RUNTIME_HEALTH_TIMEOUT_MS;
  }

  return Math.floor(configuredTimeout);
}

export function waitForRuntimeServiceStable(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeHealthRequest,
  config: AwsRuntimeCommandConfig,
  options: AwsRuntimeStabilityWaitOptions = {},
): void {
  const deadlineMs = options.deadlineMs ?? resolveRuntimeStabilityDeadlineMs(request.runtimeKind);
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_STABILITY_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  while (true) {
    const service = describeRuntimeServiceForStability(commandRunner, request, config);
    assertRuntimeRolloutHasNotFailed(request, service);
    if (isRuntimeServiceStable(service)) {
      return;
    }

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= deadlineMs) {
      throw new Error(
        `wait for AWS runtime service stability "${request.runtimeName}" timed out after ${deadlineMs}ms`,
      );
    }

    waitBeforeNextStabilityPoll(Math.min(pollIntervalMs, deadlineMs - elapsedMs));
  }
}

export function resolveRuntimeStabilityDeadlineMs(runtimeKind: AwsRuntimeKind): number {
  return runtimeKind === "katana" ? DEFAULT_KATANA_STABILITY_DEADLINE_MS : DEFAULT_TORII_STABILITY_DEADLINE_MS;
}

function describeRuntimeServiceForStability(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeHealthRequest,
  config: AwsRuntimeCommandConfig,
): AwsEcsServiceDescription | undefined {
  const result = runRequiredAwsCommand(
    commandRunner,
    `describe AWS runtime service stability "${request.runtimeName}"`,
    [
      "ecs",
      "describe-services",
      "--region",
      config.region,
      "--cluster",
      config.cluster,
      "--services",
      buildAwsRuntimeServiceName(request),
      "--output",
      "json",
    ],
  );
  const payload = parseJsonOutput<AwsEcsDescribeServicesPayload>(result.stdout || "", {});

  return payload.services?.[0];
}

function assertRuntimeRolloutHasNotFailed(
  request: AwsRuntimeHealthRequest,
  service: AwsEcsServiceDescription | undefined,
): void {
  const primaryDeployment = resolvePrimaryDeployment(service);
  if (primaryDeployment?.rolloutState !== "FAILED") {
    return;
  }

  throw new Error(
    `AWS runtime "${request.runtimeName}" rollout failed: ${
      primaryDeployment.rolloutStateReason || "primary deployment entered FAILED"
    }`,
  );
}

function isRuntimeServiceStable(service: AwsEcsServiceDescription | undefined): boolean {
  const primaryDeployment = resolvePrimaryDeployment(service);

  return Boolean(
    service &&
    primaryDeployment &&
    service.deployments?.length === 1 &&
    primaryDeployment.rolloutState === "COMPLETED" &&
    hasReachedDesiredCount(service) &&
    hasReachedDesiredCount(primaryDeployment),
  );
}

function resolvePrimaryDeployment(
  service: AwsEcsServiceDescription | undefined,
): AwsEcsDeploymentDescription | undefined {
  return service?.deployments?.find((deployment) => deployment.status === "PRIMARY");
}

function hasReachedDesiredCount(counts: AwsEcsDeploymentCounts): boolean {
  return (
    Number.isInteger(counts.desiredCount) && counts.runningCount === counts.desiredCount && counts.pendingCount === 0
  );
}

function waitBeforeNextStabilityPoll(delayMs: number): void {
  if (delayMs <= 0) {
    return;
  }

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

export function buildHealthFromEndpoint(endpointUrl: string | undefined): AwsRuntimeHealth | undefined {
  if (!endpointUrl) {
    return undefined;
  }

  return {
    status: "unknown",
    checkedAt: new Date().toISOString(),
    endpoint: buildAwsRuntimeEndpointUrlFromBase(endpointUrl, "health"),
  };
}

export function buildRuntimeHealthEndpointUrl(request: AwsRuntimeHealthRequest): string {
  return buildAwsRuntimeEndpointUrl({
    domain: request.domain,
    environmentId: request.environmentId,
    runtimeName: request.runtimeName,
    runtimeKind: request.runtimeKind,
    endpointKind: "health",
  });
}

export async function probePublicRuntimeHealth(endpoint: string): Promise<AwsRuntimeHealth> {
  if (isKatanaRpcEndpoint(endpoint)) {
    return probeKatanaRpcEndpoint(endpoint);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveRuntimeHealthTimeoutMs());
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      status: response.ok ? "healthy" : "unhealthy",
      checkedAt: new Date().toISOString(),
      endpoint,
      latencyMs: Date.now() - startedAt,
      details: response.ok ? undefined : `http ${response.status}`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      checkedAt: new Date().toISOString(),
      endpoint,
      latencyMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeRuntimePublicHealth(
  request: AwsRuntimeHealthRequest,
  healthProbe: AwsRuntimeHealthProbe,
): Promise<AwsRuntimeHealth> {
  const healthEndpoint = buildRuntimeHealthEndpointUrl(request);
  const health = await healthProbe(healthEndpoint);

  if (health.status !== "healthy" || request.runtimeKind !== "katana") {
    return health;
  }

  const rpcEndpoint = buildRuntimeRpcEndpointUrl(request);
  const rpcHealth = await healthProbe(rpcEndpoint);
  if (rpcHealth.status === "healthy") {
    return health;
  }

  return {
    ...health,
    status: rpcHealth.status,
    checkedAt: rpcHealth.checkedAt,
    details: `katana rpc ${rpcHealth.details || rpcHealth.status} at ${rpcEndpoint}`,
  };
}

function buildRuntimeRpcEndpointUrl(request: AwsRuntimeHealthRequest): string {
  return buildAwsRuntimeEndpointUrl({
    domain: request.domain,
    environmentId: request.environmentId,
    runtimeName: request.runtimeName,
    runtimeKind: request.runtimeKind,
    endpointKind: "rpc",
  });
}

function buildAwsRuntimeEndpointUrl(options: {
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

function buildAwsRuntimeEndpointUrlFromBase(baseUrl: string, endpointKind: AwsRuntimeEndpointKind): string {
  if (endpointKind === "base") {
    return baseUrl.replace(/\/+$/, "");
  }

  return `${baseUrl.replace(/\/+$/, "")}/${endpointKind}`;
}

function isKatanaRpcEndpoint(endpoint: string): boolean {
  return /\/katana\/rpc\/v0_9\/?$/.test(endpoint);
}

async function probeKatanaRpcEndpoint(endpoint: string): Promise<AwsRuntimeHealth> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveRuntimeHealthTimeoutMs());
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_chainId", params: [] }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: "unhealthy",
        checkedAt: new Date().toISOString(),
        endpoint,
        latencyMs: Date.now() - startedAt,
        details: `http ${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => undefined)) as { result?: unknown } | undefined;
    return {
      status: typeof payload?.result === "string" && payload.result ? "healthy" : "unhealthy",
      checkedAt: new Date().toISOString(),
      endpoint,
      latencyMs: Date.now() - startedAt,
      details: typeof payload?.result === "string" && payload.result ? undefined : "invalid starknet_chainId response",
    };
  } catch (error) {
    return {
      status: "unhealthy",
      checkedAt: new Date().toISOString(),
      endpoint,
      latencyMs: Date.now() - startedAt,
      details: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
