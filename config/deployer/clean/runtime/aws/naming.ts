import {
  buildRuntimeBasePath,
  buildRuntimeEndpointPath,
  normalizeRuntimeSegment,
  type RuntimeEndpointKind as AwsRuntimeEndpointKind,
  type RuntimeKind as AwsRuntimeKind,
} from "../../../../../common/factory/runtime-endpoints";
import type { DeploymentEnvironmentId } from "../../types";

const DEFAULT_AWS_RUNTIME_RULE_PRIORITY_BASE = 10_000;

export interface AwsRuntimeNamingRequest {
  environmentId: DeploymentEnvironmentId;
  runtimeKind: AwsRuntimeKind;
  runtimeName: string;
}

export function buildAwsRuntimeBasePath(request: AwsRuntimeNamingRequest): string {
  return buildRuntimeBasePath(request.environmentId, request.runtimeName, request.runtimeKind);
}

export function buildEndpointPath(
  environmentId: DeploymentEnvironmentId,
  runtimeName: string,
  runtimeKind: AwsRuntimeKind,
  endpointKind: AwsRuntimeEndpointKind,
): string {
  return buildRuntimeEndpointPath(environmentId, runtimeName, runtimeKind, endpointKind);
}

export function buildRuntimeRootPath(request: AwsRuntimeNamingRequest): string {
  return `/runtimes/${buildAwsRuntimeServiceName(request)}`;
}

export function buildTargetGroupName(request: AwsRuntimeNamingRequest): string {
  return truncateWithCleanSuffix(`${request.runtimeKind}-${hashString(buildAwsRuntimeServiceName(request))}`, 32);
}

export function resolveListenerRulePriority(_request: AwsRuntimeNamingRequest): number {
  const base = Number(process.env.AWS_RUNTIME_LISTENER_RULE_PRIORITY_BASE || DEFAULT_AWS_RUNTIME_RULE_PRIORITY_BASE);
  return Number.isFinite(base)
    ? Math.max(1, Math.min(40_000, Math.floor(base)))
    : DEFAULT_AWS_RUNTIME_RULE_PRIORITY_BASE;
}

export function buildAwsRuntimeServiceName(options: AwsRuntimeNamingRequest): string {
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

export function truncateWithCleanSuffix(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).replace(/-+$/g, "");
}

function hashString(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}
