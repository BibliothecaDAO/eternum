import { captureSystemError } from "@/posthog";
import { setup } from "@bibliothecadao/dojo";
import { configManager, MapDataStore } from "@bibliothecadao/eternum";
import { world } from "@bibliothecadao/types";
import { inject } from "@vercel/analytics";
import { ReactNode } from "react";

import { patchManifestWithFactory, applyWorldSelection, type WorldProfile } from "@/runtime/world";
import { resolveEntryContextCacheKey, type ResolvedEntryContext } from "@/game-entry/context";
import { setSqlApiBaseUrl } from "@/services/api";
import { Chain, getGameManifest } from "@contracts";
import { dojoConfig } from "../../dojo-config";
import { env } from "../../env";
import { clearSubscriptionQueue } from "../dojo/debounced-queries";
import { cancelEntityStreamSubscription, initialSync } from "../dojo/sync";
import { usePlayerStore } from "../hooks/store/use-player-store";
import useSettlementStore from "../hooks/store/use-settlement-store";
import { useSyncStore } from "../hooks/store/use-sync-store";
import { useTransactionStore } from "../hooks/store/use-transaction-store";
import { useUIStore } from "../hooks/store/use-ui-store";
import { NoAccountModal } from "../ui/layouts/no-account-modal";
import { markGameEntryMilestone, recordGameEntryDuration } from "../ui/layouts/game-entry-timeline";
import { ETERNUM_CONFIG } from "../utils/config";
import { createBootstrapSession, type BootstrapSelection } from "./bootstrap-session";
import { resolveCachedEntrySessionForContext } from "./bootstrap-session-context";
import { initializeGameRenderer } from "./game-renderer";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export interface BootstrappedEntrySession {
  context: ResolvedEntryContext;
  profile: WorldProfile;
  setupResult: SetupResult;
}

type BootstrapResult = BootstrappedEntrySession;
const bootstrapSession = createBootstrapSession<BootstrapResult>();

type BootstrapLifecycle = {
  onBootstrapCompleted?: () => void;
  onBootstrapStarted?: () => void;
  onWorldSelectionCompleted?: () => void;
  onWorldSelectionStarted?: () => void;
};

type MutableDojoConfig = typeof dojoConfig & {
  toriiUrl?: string;
  rpcUrl?: string;
  manifest?: unknown;
};

export const getCachedBootstrappedEntrySession = (context?: ResolvedEntryContext): BootstrappedEntrySession | null => {
  const cachedSession = bootstrapSession.getCachedResult();
  if (!cachedSession) {
    return null;
  }

  if (!context) {
    return cachedSession;
  }

  const trackedSelection = bootstrapSession.getTrackedSelection();
  return trackedSelection.cacheKey === resolveEntryContextCacheKey(context)
    ? resolveCachedEntrySessionForContext(cachedSession, context)
    : null;
};

const resolveBootstrapSelection = (context: ResolvedEntryContext): BootstrapSelection => {
  return {
    cacheKey: resolveEntryContextCacheKey(context),
    chain: context.chain,
    worldName: context.worldName,
  };
};

const isSpectateModeFromUrl = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("spectate") === "true";
};

const shouldBypassNoAccountModal = (): boolean => {
  const isSpectatingInStore = useUIStore.getState().isSpectating;
  return isSpectateModeFromUrl() || isSpectatingInStore;
};

const handleNoAccount = (modalContent: ReactNode) => {
  if (shouldBypassNoAccountModal()) {
    console.log("[bootstrap] Skipping account modal - spectate mode");
    return;
  }

  const uiStore = useUIStore.getState();
  uiStore.setModal(null, false);
  uiStore.setModal(modalContent, true);
};

const applyWorldSelectionForEntryContext = async (context: ResolvedEntryContext): Promise<WorldProfile> => {
  const result = await applyWorldSelection(
    {
      name: context.worldName,
      chain: context.chain,
      worldAddress: context.worldAddress,
    },
    context.chain,
  );

  return result.profile;
};

const runBootstrap = async ({
  context,
  profile,
}: {
  context: ResolvedEntryContext;
  profile: WorldProfile;
}): Promise<BootstrapResult> => {
  console.log("[STARTING DOJO SETUP]");
  const stores = resolveBootstrapStores();
  const worldContext = {
    chain: context.chain,
    profile,
    toriiUrl: resolveBootstrapToriiUrl(context.chain, profile),
  };
  configureDojoRuntime(worldContext);
  const setupResult = await runDojoSetup();
  await runInitialWorldSync(setupResult, stores);
  configureGameSystems(setupResult, worldContext.chain);
  await startGameRenderer(setupResult);
  inject();
  return {
    context,
    profile,
    setupResult,
  };
};
export const resetBootstrap = () => {
  console.log("[BOOTSTRAP] Resetting bootstrap state");
  cancelActiveBootstrapSubscriptions();
  bootstrapSession.reset();
  clearBootstrapWorldData();
  resetBootstrapUiState();
};

export const bootstrapGameForEntryContext = async (
  context: ResolvedEntryContext,
  lifecycle: BootstrapLifecycle = {},
): Promise<BootstrapResult> => {
  const cachedSession = getCachedBootstrappedEntrySession(context);
  if (cachedSession) {
    return cachedSession;
  }

  const selection = resolveBootstrapSelection(context);
  resetBootstrapForSelectionChange(selection);
  markGameEntryMilestone("destination-resolved");
  markGameEntryMilestone("world-selection-started");
  lifecycle.onWorldSelectionStarted?.();
  const profile = await applyWorldSelectionForEntryContext(context);
  lifecycle.onWorldSelectionCompleted?.();
  markGameEntryMilestone("world-selection-completed");
  lifecycle.onBootstrapStarted?.();
  markGameEntryMilestone("bootstrap-started");
  try {
    const result = await bootstrapSession.run(selection, () => runBootstrap({ context, profile }));
    lifecycle.onBootstrapCompleted?.();
    markGameEntryMilestone("bootstrap-completed");
    return result;
  } catch (error) {
    bootstrapSession.clearFailure();
    captureSystemError(error, {
      error_type: "dojo_setup",
      setup_phase: "bootstrap",
      context: "Unhandled error during Dojo bootstrap",
    });
    throw error;
  }
};

type BootstrapStores = {
  syncingStore: ReturnType<typeof useSyncStore.getState>;
  uiStore: ReturnType<typeof useUIStore.getState>;
};

type BootstrapWorldContext = {
  chain: Chain;
  profile: WorldProfile;
  toriiUrl: string;
};

const resolveBootstrapStores = (): BootstrapStores => ({
  syncingStore: useSyncStore.getState(),
  uiStore: useUIStore.getState(),
});

const resetBootstrapForSelectionChange = (selection: BootstrapSelection) => {
  const resetReason = bootstrapSession.getResetReason(selection);
  if (!resetReason) {
    return;
  }

  const previousSelection = bootstrapSession.getTrackedSelection();

  if (resetReason === "chain-changed") {
    console.log(
      `[BOOTSTRAP] Chain changed from "${previousSelection.chain}" to "${selection.chain}", resetting and re-bootstrapping...`,
    );
  } else {
    console.log(
      `[BOOTSTRAP] World changed from "${previousSelection.worldName}" to "${selection.worldName}", re-bootstrapping...`,
    );
  }

  resetBootstrap();
};

const configureDojoRuntime = ({ chain, profile, toriiUrl }: BootstrapWorldContext) => {
  const mutableDojoConfig = dojoConfig as MutableDojoConfig;

  mutableDojoConfig.toriiUrl = toriiUrl;
  mutableDojoConfig.rpcUrl = resolveBootstrapRpcUrl(chain, profile);
  mutableDojoConfig.manifest = patchManifestWithFactory(
    getGameManifest(chain),
    profile.worldAddress,
    profile.contractsBySelector,
  );

  setSqlApiBaseUrl(`${toriiUrl}/sql`);
};

const resolveBootstrapToriiUrl = (chain: Chain, profile: WorldProfile): string => {
  return chain === "local" ? env.VITE_PUBLIC_TORII : profile.toriiBaseUrl;
};

const resolveBootstrapRpcUrl = (chain: Chain, profile: WorldProfile): string => {
  if (chain === "local") {
    return env.VITE_PUBLIC_NODE_URL;
  }

  return profile.rpcUrl ?? env.VITE_PUBLIC_NODE_URL;
};

const runDojoSetup = async (): Promise<SetupResult> => {
  markGameEntryMilestone("setup-started");
  const setupResult = await setup(
    { ...dojoConfig },
    {
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: false,
    },
    {
      onNoAccount: () => {
        handleNoAccount(<NoAccountModal />);
      },
      onError: (error: unknown) => {
        console.error("System call error:", error);

        captureSystemError(error, {
          error_type: "dojo_system_call",
          setup_phase: "post-setup",
          context: "System call error during post-setup phase",
        });
      },
    },
  );
  markGameEntryMilestone("setup-completed");
  console.log("[DOJO SETUP COMPLETED]");
  return setupResult;
};

const runInitialWorldSync = async (setupResult: SetupResult, stores: BootstrapStores) => {
  const initialSyncStartedAt = performance.now();
  markGameEntryMilestone("initial-sync-started");
  await initialSync(setupResult, stores.uiStore, stores.syncingStore.setInitialSyncProgress);
  markGameEntryMilestone("initial-sync-completed");
  recordGameEntryDuration("initial-sync", performance.now() - initialSyncStartedAt);
  console.log("[INITIAL SYNC COMPLETED]");
};

const configureGameSystems = (setupResult: SetupResult, chain: Chain) => {
  configManager.setDojo(setupResult.components, ETERNUM_CONFIG({ chain, components: setupResult.components }));
};

const startGameRenderer = async (setupResult: SetupResult) => {
  bootstrapSession.replaceRendererCleanup(
    await initializeGameRenderer(setupResult, env.VITE_PUBLIC_GRAPHICS_DEV == true),
  );
};

const cancelActiveBootstrapSubscriptions = () => {
  cancelEntityStreamSubscription();
};

const clearBootstrapWorldData = () => {
  const entities = [...world.getEntities()];
  for (const entity of entities) {
    world.deleteEntity(entity);
  }

  // `world.components` is append-only across contract redefinition, so a re-bootstrap
  // must clear it or new writes can target orphaned component instances.
  world.components.length = 0;
  console.log(`[BOOTSTRAP] Cleared ${entities.length} entities and component registry from RECS world`);

  MapDataStore.clearIfExists();
  clearSubscriptionQueue();
  useSyncStore.getState().resetSubscriptions();
};

const resetBootstrapUiState = () => {
  const uiStore = useUIStore.getState();
  uiStore.setStructureEntityId(0, { spectator: false, worldMapPosition: undefined });
  uiStore.setSelectableArmies([]);

  usePlayerStore.getState().clearPlayerData();
  useTransactionStore.getState().clearAllTransactions();

  const settlementState = useSettlementStore.getState();
  if (settlementState.pollingIntervalId) {
    clearInterval(settlementState.pollingIntervalId);
  }
  if (settlementState.pollingTimeoutId) {
    clearTimeout(settlementState.pollingTimeoutId);
  }

  useSettlementStore.setState({
    pollingIntervalId: null,
    pollingTimeoutId: null,
    availableLocations: [],
    settledLocations: [],
    selectedLocation: null,
    selectedCoords: null,
  });
};
