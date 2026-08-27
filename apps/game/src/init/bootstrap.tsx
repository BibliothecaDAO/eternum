import * as Sentry from "@sentry/react";
import { DEV_MODE_ENABLED, verboseLog } from "@/utils/dev-mode";
import { formatReadableErrorForConsole } from "@/utils/error-message";
import { captureSpectateIntentFromUrl, isExplicitSpectateSession } from "@/utils/spectator-session";
import { setup } from "@bibliothecadao/dojo";
import { configManager, resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { SupersededGameSyncStartError } from "@bibliothecadao/eternum/game-sync";
import { setSqlGameScope } from "@bibliothecadao/torii";
import { world } from "@bibliothecadao/types";
import { ReactNode } from "react";

import { resolveEntryContextCacheKey, type ResolvedEntryContext } from "@/game-entry/context";
import { applyWorldSelection, patchManifestWithFactory, type WorldProfile } from "@/runtime/world";
import { setSqlApiBaseUrl } from "@/services/api";
import { getGameManifest } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import { dojoConfig } from "../../dojo-config";
import { env } from "../../env";
import { clearSubscriptionQueue } from "../dojo/debounced-queries";
import { namespaceForChain, setGameScope, type GameNamespace } from "../dojo/game-scope";
import { disposeGameSyncSession, initialSync } from "../dojo/sync";
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

const shouldBypassNoAccountModal = (): boolean => {
  const isSpectatingInStore = useUIStore.getState().isSpectating;
  return isExplicitSpectateSession() || isSpectatingInStore;
};

const handleNoAccount = (modalContent: ReactNode) => {
  if (shouldBypassNoAccountModal()) {
    verboseLog("[bootstrap] Skipping account modal - spectate mode");
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
  const stores = resolveBootstrapStores();
  const worldContext = {
    chain: context.chain,
    profile,
    toriiUrl: resolveBootstrapToriiUrl(context.chain, profile),
  };
  // World-scoped bootstrap: the profile carries its world's namespace + game
  // id (world directory); scope config reads and sync clauses to that game
  // before any setup/sync touches component data. Stale stored profiles
  // without a namespace fall back to the chain-derived one.
  const worldNamespace = profile.namespace ?? namespaceForChain(context.chain);
  configManager.setActiveGame(profile.gameId ?? 0, profile.presetId ?? 0);
  setGameScope(worldNamespace as GameNamespace, profile.gameId ?? 0);
  setSqlGameScope(worldNamespace, profile.gameId ?? 0);
  verboseLog("[STARTING DOJO SETUP]");
  configureDojoRuntime(worldContext);
  const setupResult = await runDojoSetup(worldContext.chain, worldNamespace, profile.gameId ?? 0);
  // When the config fast path resolves in the background after boot, re-run
  // the config snapshot so cost tables don't stay empty for the session.
  const refreshGameSystems = () => configureGameSystems(setupResult, worldContext.chain);
  await runInitialWorldSync(setupResult, stores, refreshGameSystems);
  configureGameSystems(setupResult, worldContext.chain);
  // From here on an empty keyed config lookup is a bug, not a boot race —
  // make it loud (guardrail #2, AGENTS.md "No silent defaults").
  configManager.markConfigSynced();
  await startGameRenderer(setupResult);
  return {
    context,
    profile,
    setupResult,
  };
};
export const resetBootstrap = () => {
  verboseLog("[BOOTSTRAP] Resetting bootstrap state");
  cancelActiveBootstrapSubscriptions();
  bootstrapSession.reset();
  clearBootstrapWorldData();
  resetBootstrapUiState();
};

export const bootstrapGameForEntryContext = async (
  context: ResolvedEntryContext,
  lifecycle: BootstrapLifecycle = {},
): Promise<BootstrapResult> => {
  // Latch spectator intent while the entry URL still carries ?spectate —
  // in-app navigation strips the query string later.
  captureSpectateIntentFromUrl();
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
    if (error instanceof SupersededGameSyncStartError) {
      throw error;
    }

    bootstrapSession.clearFailure();
    Sentry.captureException(error, {
      tags: { feature: "bootstrap", error_type: "dojo_setup", setup_phase: "bootstrap" },
      extra: { context: "Unhandled error during Dojo bootstrap" },
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
    verboseLog(
      `[BOOTSTRAP] Chain changed from "${previousSelection.chain}" to "${selection.chain}", resetting and re-bootstrapping...`,
    );
  } else {
    verboseLog(
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

const resolveBootstrapToriiUrl = (_chain: Chain, profile: WorldProfile): string => profile.toriiBaseUrl;

const resolveBootstrapRpcUrl = (_chain: Chain, profile: WorldProfile): string =>
  profile.rpcUrl ?? env.VITE_PUBLIC_NODE_URL;

const runDojoSetup = async (chain: Chain, namespace: string, gameId: number): Promise<SetupResult> => {
  markGameEntryMilestone("setup-started");
  const setupResult = await setup(
    { ...dojoConfig },
    {
      executionResourceBounds: resolveGameTransactionResourceBounds(chain),
      vrfProviderAddress: env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
      useBurner: false,
      // The profile's world namespace; the provider also prepends gameId to
      // every game-system call's calldata on the appchain worlds.
      namespace,
      gameId,
    },
    {
      onNoAccount: () => {
        handleNoAccount(<NoAccountModal />);
      },
      onError: (error: unknown) => {
        console.error(`System call error: ${formatReadableErrorForConsole(error)}`);

        Sentry.captureException(error, {
          tags: { feature: "bootstrap", error_type: "dojo_system_call", setup_phase: "post-setup" },
          extra: { context: "System call error during post-setup phase" },
        });
      },
    },
  );
  markGameEntryMilestone("setup-completed");
  verboseLog("[DOJO SETUP COMPLETED]");
  return setupResult;
};

const runInitialWorldSync = async (
  setupResult: SetupResult,
  stores: BootstrapStores,
  onConfigRefreshed?: () => void,
) => {
  const initialSyncStartedAt = performance.now();
  markGameEntryMilestone("initial-sync-started");
  await initialSync(setupResult, stores.uiStore, stores.syncingStore.setInitialSyncProgress, { onConfigRefreshed });
  markGameEntryMilestone("initial-sync-completed");
  recordGameEntryDuration("initial-sync", performance.now() - initialSyncStartedAt);
  verboseLog("[INITIAL SYNC COMPLETED]");
};

const configureGameSystems = (setupResult: SetupResult, chain: Chain) => {
  configManager.setDojo(setupResult.components, ETERNUM_CONFIG({ chain, components: setupResult.components }));
};

const startGameRenderer = async (setupResult: SetupResult) => {
  // Renderer init = Three.js scene/shader/texture compilation + spatial Torii
  // bounds subscription. Often the slowest single step on a cold reload, and
  // previously had no breadcrumb between `initial-sync-completed` and
  // `bootstrap-completed`, so a 30s+ hang here looked indistinguishable from
  // a stuck initial sync.
  const rendererInitStartedAt = performance.now();
  markGameEntryMilestone("renderer-init-started");
  const cleanup = await initializeGameRenderer(setupResult, DEV_MODE_ENABLED);
  markGameEntryMilestone("renderer-init-completed");
  recordGameEntryDuration("renderer-init", performance.now() - rendererInitStartedAt);
  bootstrapSession.replaceRendererCleanup(cleanup);
};

const cancelActiveBootstrapSubscriptions = () => {
  disposeGameSyncSession();
};

const clearBootstrapWorldData = () => {
  const entities = [...world.getEntities()];
  for (const entity of entities) {
    world.deleteEntity(entity);
  }

  // `world.components` is append-only across contract redefinition, so a re-bootstrap
  // must clear it or new writes can target orphaned component instances.
  world.components.length = 0;
  verboseLog(`[BOOTSTRAP] Cleared ${entities.length} entities and component registry from RECS world`);

  clearSubscriptionQueue();
  useSyncStore.getState().resetSubscriptions();
};

const resetBootstrapUiState = () => {
  const uiStore = useUIStore.getState();
  uiStore.setStructureEntityId(0, { spectator: false, worldMapPosition: undefined });
  uiStore.setSelectableArmies([]);

  useTransactionStore.getState().clearAllTransactions();

  useSettlementStore.setState({
    selectedLocation: null,
    selectedCoords: null,
  });
};
