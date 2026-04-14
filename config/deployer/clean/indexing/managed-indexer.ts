import { DEFAULT_MANAGED_INDEXER_PROVIDER } from "../constants";
import type { IndexerLiveState, IndexerRequest, IndexerTier } from "../types";
import { createRailwayManagedIndexerProvider, type EnsureRailwayIndexerOptions } from "./railway-torii";
import { createSlotManagedIndexerProvider } from "./slot-torii";

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
export type ManagedIndexerActionResult =
  | ReturnType<ReturnType<typeof createSlotManagedIndexerProvider>["ensureDeployment"]>
  | ReturnType<NonNullable<ReturnType<typeof createRailwayManagedIndexerProvider>["ensureTier"]>>;
export type ManagedIndexerDeleteResult =
  | ReturnType<ReturnType<typeof createSlotManagedIndexerProvider>["deleteDeployment"]>
  | ReturnType<ReturnType<typeof createRailwayManagedIndexerProvider>["deleteDeployment"]>;

export interface ManagedIndexerProvider {
  kind: ManagedIndexerProviderKind;
  ensureDeployment: (request: IndexerRequest, options?: ManagedIndexerOperationOptions) => ManagedIndexerActionResult;
  resolveLiveState: (name: string) => IndexerLiveState;
  resolveLiveStates: (gameNames: string[]) => Array<{ gameName: string; liveState: IndexerLiveState }>;
  ensureTier?: (options: ManagedIndexerTierOptions) => ManagedIndexerActionResult;
  deleteDeployment: (options: ManagedIndexerDeleteOptions) => ManagedIndexerDeleteResult;
  listDeploymentNames?: () => string[];
}

export function resolveManagedIndexerProviderKind(): ManagedIndexerProviderKind {
  const configuredValue = (process.env.MANAGED_INDEXER_PROVIDER || DEFAULT_MANAGED_INDEXER_PROVIDER).trim().toLowerCase();
  return configuredValue === "railway" ? "railway" : "slot";
}

export function resolveManagedIndexerProvider(options: {
  railway?: EnsureRailwayIndexerOptions;
} = {}): ManagedIndexerProvider {
  return resolveManagedIndexerProviderKind() === "railway"
    ? (createRailwayManagedIndexerProvider(options.railway) as ManagedIndexerProvider)
    : (createSlotManagedIndexerProvider() as ManagedIndexerProvider);
}

export function resolveIndexerArtifactState(
  liveState: IndexerLiveState,
  options: {
    fallbackTier?: IndexerTier;
  } = {},
) {
  return {
    indexerCreated: liveState.state === "existing",
    indexerTier: liveState.currentTier || options.fallbackTier,
    indexerUrl: liveState.url,
    indexerVersion: liveState.version,
    indexerBranch: liveState.branch,
    lastIndexerDescribeAt: liveState.describedAt,
  };
}
