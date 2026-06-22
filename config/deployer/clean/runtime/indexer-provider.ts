import {
  ensureSlotIndexerDeployment,
  resolveIndexerArtifactState as resolveSlotIndexerArtifactState,
} from "../indexing/slot-torii";
import type { IndexerCreationResult, IndexerRequest } from "../types";
import {
  ensureAwsToriiRuntime,
  toAwsRuntimeArtifact,
  type AwsRuntimeActionResult,
  type AwsRuntimeArtifact,
} from "./aws-runtime";

type SlotIndexerDeploymentResult = ReturnType<typeof ensureSlotIndexerDeployment>;
type IndexerProviderResult = AwsRuntimeActionResult | SlotIndexerDeploymentResult;

interface EnsureIndexerDeploymentDependencies {
  ensureAwsToriiRuntime?: typeof ensureAwsToriiRuntime;
  ensureSlotIndexerDeployment?: typeof ensureSlotIndexerDeployment;
}

function shouldUseAwsRuntimeProvider(request: IndexerRequest): boolean {
  return request.runtimeProvider === "aws";
}

function shouldUseSlotRuntimeProvider(request: IndexerRequest): boolean {
  return request.runtimeProvider === "slot" || !request.runtimeProvider;
}

function resolveAwsIndexerArtifacts(result: AwsRuntimeActionResult) {
  const runtimeArtifact = toAwsRuntimeArtifact(result.liveState);

  return {
    indexerCreated: result.liveState.status === "existing",
    indexerMode: result.mode,
    indexerTier: result.liveState.tier || result.requestedTier,
    indexerUrl: result.liveState.endpointUrl,
    indexerVersion: result.liveState.version,
    indexerBranch: undefined,
    lastIndexerDescribeAt: result.liveState.describedAt,
    runtimeProvider: "aws" as const,
    awsRuntime: runtimeArtifact,
  };
}

function resolveSlotIndexerArtifacts(result: SlotIndexerDeploymentResult) {
  const slotArtifacts = resolveSlotIndexerArtifactState(result.liveState, {
    fallbackTier: result.requestedTier,
  });

  return {
    ...slotArtifacts,
    indexerMode: result.mode,
    runtimeProvider: "slot" as const,
    awsRuntime: undefined as AwsRuntimeArtifact | undefined,
  };
}

export async function ensureIndexerDeployment(
  request: IndexerRequest,
  dependencies: EnsureIndexerDeploymentDependencies = {},
): Promise<IndexerProviderResult> {
  if (shouldUseAwsRuntimeProvider(request)) {
    return (dependencies.ensureAwsToriiRuntime || ensureAwsToriiRuntime)(request);
  }

  if (shouldUseSlotRuntimeProvider(request)) {
    return (dependencies.ensureSlotIndexerDeployment || ensureSlotIndexerDeployment)(request);
  }

  throw new Error(`Unsupported runtime provider "${request.runtimeProvider}"`);
}

export function resolveIndexerArtifactStateFromProvider(result: IndexerProviderResult): Pick<
  IndexerCreationResult,
  "mode"
> & {
  indexerCreated: boolean;
  indexerMode: IndexerCreationResult["mode"];
  indexerTier?: IndexerRequest["tier"];
  indexerUrl?: string;
  indexerVersion?: string;
  indexerBranch?: string;
  lastIndexerDescribeAt?: string;
  runtimeProvider: "aws" | "slot";
  awsRuntime?: AwsRuntimeArtifact;
} {
  if (result.mode === "aws-ecs") {
    const artifacts = resolveAwsIndexerArtifacts(result);
    return {
      mode: result.mode,
      ...artifacts,
    };
  }

  const artifacts = resolveSlotIndexerArtifacts(result);
  return {
    mode: result.mode,
    ...artifacts,
  };
}
