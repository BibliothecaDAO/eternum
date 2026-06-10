import { DEFAULT_MANAGED_INDEXER_PROVIDER } from "../constants";
import type { IndexerLiveState, IndexerRequest, IndexerTier } from "../types";
import {
  createRailwayManagedIndexerProvider,
  type DeleteRailwayIndexerResult,
  type EnsureRailwayIndexerOptions,
  type RailwayIndexerActionResult,
} from "./railway-torii";
import {
  createSlotManagedIndexerProvider,
  type DeleteSlotIndexerResult,
  type SlotIndexerActionResult,
} from "./slot-torii";

export type ManagedIndexerProviderKind = "slot" | "railway";
export interface ManagedIndexerOperationOptions {
  onProgress?: (message: string) => void;
}
export interface ManagedIndexerTierOptions extends ManagedIndexerOperationOptions {
  name: string;
  tier: IndexerTier;
}
export interface ManagedIndexerDeleteOptions extends ManagedIndexerOperationOptions {
  name: string;
}
export type ManagedIndexerActionResult = SlotIndexerActionResult | RailwayIndexerActionResult;
export type ManagedIndexerDeleteResult = DeleteSlotIndexerResult | DeleteRailwayIndexerResult;

export interface ResolvedIndexerArtifactState {
  indexerCreated: boolean;
  indexerTier?: IndexerTier;
  indexerUrl?: string;
  indexerVersion?: string;
  indexerBranch?: string;
  lastIndexerDescribeAt?: string;
}

export interface ManagedIndexerProvider {
  kind: ManagedIndexerProviderKind;
  ensureDeployment: (request: IndexerRequest, options?: ManagedIndexerOperationOptions) => ManagedIndexerActionResult;
  resolveLiveState: (name: string, options?: ManagedIndexerOperationOptions) => IndexerLiveState;
  resolveLiveStates: (gameNames: string[]) => Array<{ gameName: string; liveState: IndexerLiveState }>;
  ensureTier?: (options: ManagedIndexerTierOptions) => ManagedIndexerActionResult;
  deleteDeployment: (options: ManagedIndexerDeleteOptions) => ManagedIndexerDeleteResult;
  listDeploymentNames?: () => string[];
}

export function resolveManagedIndexerProviderKind(): ManagedIndexerProviderKind {
  const configuredValue = (process.env.MANAGED_INDEXER_PROVIDER || DEFAULT_MANAGED_INDEXER_PROVIDER)
    .trim()
    .toLowerCase();

  if (configuredValue === "railway" || configuredValue === "slot") {
    return configuredValue;
  }

  // A typo here would otherwise silently deploy to the wrong provider.
  throw new Error(`Unrecognized MANAGED_INDEXER_PROVIDER "${configuredValue}" (expected "slot" or "railway")`);
}

export function resolveManagedIndexerProvider(
  options: {
    railway?: EnsureRailwayIndexerOptions;
  } = {},
): ManagedIndexerProvider {
  return resolveManagedIndexerProviderKind() === "railway"
    ? (createRailwayManagedIndexerProvider(options.railway) as ManagedIndexerProvider)
    : (createSlotManagedIndexerProvider() as ManagedIndexerProvider);
}

export function resolveIndexerArtifactState(
  liveState: IndexerLiveState,
  options: {
    fallbackTier?: IndexerTier;
  } = {},
): ResolvedIndexerArtifactState {
  return {
    indexerCreated: liveState.state === "existing",
    indexerTier: liveState.currentTier || options.fallbackTier,
    indexerUrl: liveState.url,
    indexerVersion: liveState.version,
    indexerBranch: liveState.branch,
    lastIndexerDescribeAt: liveState.describedAt,
  };
}
