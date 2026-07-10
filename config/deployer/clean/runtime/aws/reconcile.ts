import { DEFAULT_TORII_VERSION } from "../../constants";
import type { IndexerRequest } from "../../types";
import {
  buildRuntimeHealthEndpointUrl,
  probePublicRuntimeHealth,
  probeRuntimePublicHealth,
  type AwsRuntimeHealthProbe,
} from "./health";
import { buildAwsRuntimeServiceName } from "./naming";
import { resolveRuntimeRegion, resolveRuntimeRouteHost, resolveRuntimeTier } from "./config";
import {
  type AwsRuntimeActionResult,
  type AwsRuntimeBackend,
  type AwsRuntimeLiveState,
  type AwsRuntimeRequest,
  type AwsRuntimeSweptResource,
} from "../aws-runtime";
import { assertCanonicalRuntimeName, requireRuntimeInstanceId } from "../runtime-identity";

export function buildAwsToriiRuntimeRequest(request: IndexerRequest): AwsRuntimeRequest {
  if (!request.environmentId) {
    throw new Error("AWS Torii runtime requests require environmentId");
  }

  return {
    environmentId: request.environmentId,
    runtimeKind: "torii",
    runtimeName: request.worldName,
    runtimeInstanceId: request.runtimeInstanceId || request.runtimeOwner?.runtimeInstanceId,
    rpcUrl: request.rpcUrl,
    worldAddress: request.worldAddress,
    worldBlock: request.worldBlock,
    namespaces: request.namespaces,
    externalContracts: request.externalContracts || [],
    tier: request.tier || "basic",
    version: request.toriiVersion || DEFAULT_TORII_VERSION,
    imageDigest: request.imageDigest,
    exposurePolicy: request.exposurePolicy || "public-read",
    lifecycleClass: request.runtimeOwner?.lifecycleClass || "ephemeral",
    upstreamRpcSecretArn: request.upstreamRpcSecretArn,
    routingShard: request.routingShard,
    domain: request.runtimeDomain,
    owner: request.runtimeOwner,
  };
}

export async function ensureAwsRuntime(
  runtimeRequest: AwsRuntimeRequest,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeActionResult> {
  validateAwsRuntimeDesiredState(runtimeRequest);
  const backend = await resolveAwsRuntimeBackend(options.backend);
  const requestedTier = resolveRuntimeTier(runtimeRequest.tier);
  const currentState = await backend.describeRuntime(runtimeRequest);

  if (currentState.status === "existing") {
    const diff = await backend.reconcileRuntime?.(runtimeRequest, currentState);
    if (diff) {
      const liveState = await includeRuntimeRestoreArtifact(
        backend,
        runtimeRequest,
        requireExistingRuntime(runtimeRequest, await backend.describeRuntime(runtimeRequest), "update"),
      );

      return {
        mode: "aws-ecs",
        action: "updated",
        requestedTier,
        liveState,
        previousTier: currentState.tier,
        diff,
      };
    }

    return {
      mode: "aws-ecs",
      action: "already-live",
      requestedTier,
      liveState: await includeRuntimeRestoreArtifact(backend, runtimeRequest, currentState),
      previousTier: currentState.tier,
    };
  }

  if (currentState.status === "indeterminate") {
    throw new Error(`Unable to verify AWS runtime "${runtimeRequest.runtimeName}": ${currentState.describeError}`);
  }

  const adopted = await backend.createRuntime(runtimeRequest);
  const liveState = await includeRuntimeRestoreArtifact(
    backend,
    runtimeRequest,
    requireExistingRuntime(runtimeRequest, await backend.describeRuntime(runtimeRequest), "create"),
  );

  return {
    mode: "aws-ecs",
    action: "created",
    requestedTier,
    liveState,
    previousTier: currentState.tier,
    adopted: adopted.length > 0 ? adopted : undefined,
  };
}

function validateAwsRuntimeDesiredState(request: AwsRuntimeRequest): void {
  assertCanonicalRuntimeName(request.runtimeName);
  requireRuntimeInstanceId(request.runtimeInstanceId);

  if (!/^sha256:[a-f0-9]{64}$/.test(request.imageDigest || "")) {
    throw new Error("AWS runtime desired state requires imageDigest=sha256:<64 lowercase hex>");
  }

  if (!request.exposurePolicy) {
    throw new Error("AWS runtime desired state requires exposurePolicy");
  }

  if (request.environmentId.startsWith("mainnet.") && request.runtimeKind === "katana") {
    throw new Error(`AWS Katana is not permitted in production environment ${request.environmentId}`);
  }

  if (request.runtimeKind === "katana" && request.lifecycleClass !== "shared") {
    throw new Error("AWS Katana requires lifecycleClass=shared");
  }

  if (request.runtimeKind === "katana" && request.owner) {
    throw new Error("Shared AWS Katana cannot be owned by a game or launch run");
  }

  if (request.exposurePolicy && request.runtimeKind === "katana" && request.exposurePolicy !== "public-dev-rpc") {
    throw new Error("AWS Katana requires exposurePolicy=public-dev-rpc");
  }

  if (request.exposurePolicy && request.runtimeKind === "torii" && request.exposurePolicy !== "public-read") {
    throw new Error("AWS Torii requires exposurePolicy=public-read");
  }
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
  validateAwsRuntimeDesiredState(request);
  const backend = await resolveAwsRuntimeBackend(options.backend);
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
      liveState: await includeRuntimeRestoreArtifact(backend, request, currentState),
      previousTier: currentState.tier,
    };
  }

  await backend.updateRuntimeTier(request);
  const liveState = await includeRuntimeRestoreArtifact(
    backend,
    request,
    requireExistingRuntime(request, await backend.describeRuntime(request), "resize"),
  );

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
    healthProbe?: AwsRuntimeHealthProbe;
  } = {},
): Promise<AwsRuntimeLiveState> {
  const backend = await resolveAwsRuntimeBackend(options.backend);
  const liveState = await backend.describeRuntime(request);
  const inspectedState = await probeInspectableRuntimeHealth(
    request,
    liveState,
    options.healthProbe || probePublicRuntimeHealth,
  );
  return includeRuntimeRestoreArtifact(backend, request, inspectedState);
}

export async function deleteAwsRuntime(
  request: AwsRuntimeRequest,
  options: {
    backend?: AwsRuntimeBackend;
  } = {},
): Promise<AwsRuntimeActionResult> {
  validateAwsRuntimeTeardownRequest(request);
  const backend = await resolveAwsRuntimeBackend(options.backend);
  const requestedTier = resolveRuntimeTier(request.tier);
  const currentState = await backend.describeRuntime(request);

  if (currentState.status === "indeterminate") {
    throw new Error(`Unable to verify AWS runtime "${request.runtimeName}": ${currentState.describeError}`);
  }

  let swept: AwsRuntimeSweptResource[];
  try {
    swept = await backend.deleteRuntime(request, currentState);
  } catch (error) {
    if (!isStaleRuntimeTeardownError(error)) {
      throw error;
    }

    return {
      mode: "aws-ecs",
      action: "skipped-stale",
      requestedTier,
      liveState: await backend.describeRuntime(request),
      previousTier: currentState.tier,
    };
  }

  if (currentState.status === "missing" && swept.length === 0) {
    return {
      mode: "aws-ecs",
      action: "already-missing",
      requestedTier,
      liveState: currentState,
      previousTier: currentState.tier,
    };
  }

  return {
    mode: "aws-ecs",
    action: "deleted",
    requestedTier,
    liveState: buildMissingLiveState(request),
    previousTier: currentState.tier,
    swept,
  };
}

function validateAwsRuntimeTeardownRequest(request: AwsRuntimeRequest): void {
  assertCanonicalRuntimeName(request.runtimeName);
  requireRuntimeInstanceId(request.runtimeInstanceId);
  if (!Number.isFinite(Date.parse(request.expectedDeleteAfter || ""))) {
    throw new Error("AWS runtime teardown requires a valid expectedDeleteAfter timestamp");
  }
}

function isStaleRuntimeTeardownError(error: unknown): boolean {
  return error instanceof Error && error.name === "AwsRuntimeStaleTeardownError";
}

async function resolveAwsRuntimeBackend(backend: AwsRuntimeBackend | undefined): Promise<AwsRuntimeBackend> {
  if (backend) {
    return backend;
  }

  const runtimeModule = await import("../aws-runtime");
  return runtimeModule.createAwsRuntimeCommandBackend();
}

async function includeRuntimeRestoreArtifact(
  backend: AwsRuntimeBackend,
  request: AwsRuntimeRequest,
  liveState: AwsRuntimeLiveState,
): Promise<AwsRuntimeLiveState> {
  if (liveState.status !== "existing") {
    return liveState;
  }

  const restoredFromSnapshot =
    liveState.restoredFromSnapshot || (await backend.inspectSnapshotRestore?.(request, liveState));
  return restoredFromSnapshot ? { ...liveState, restoredFromSnapshot } : liveState;
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

async function probeInspectableRuntimeHealth(
  request: AwsRuntimeRequest,
  liveState: AwsRuntimeLiveState,
  healthProbe: AwsRuntimeHealthProbe,
): Promise<AwsRuntimeLiveState> {
  if (liveState.status !== "existing") {
    return liveState;
  }

  const endpoint = buildRuntimeHealthEndpointUrl(request);

  try {
    return {
      ...liveState,
      health: await probeRuntimePublicHealth(request, healthProbe),
    };
  } catch (error) {
    return {
      ...liveState,
      health: {
        status: "unknown",
        checkedAt: new Date().toISOString(),
        endpoint,
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
