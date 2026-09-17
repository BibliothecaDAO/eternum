import * as Sentry from "@sentry/react";
import { DEV_MODE_ENABLED, verboseLog } from "@/utils/dev-mode";
import { formatReadableErrorForConsole } from "@/utils/error-message";
import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";
import { createBrowserGameClient } from "@/services/game-client";
import type { GameClient } from "@bibliothecadao/eternum";
import { SupersededGameSyncStartError } from "@bibliothecadao/eternum/game-sync";
import { type SystemCallAuthHandler } from "@bibliothecadao/types";

import { resolveEntryContextCacheKey, type ResolvedEntryContext } from "@/game-entry/context";
import { applyWorldSelection, type WorldProfile } from "@/runtime/world";
import { requireWorldById } from "@/runtime/world/world-directory";
import type { GameChain as Chain } from "@realms-world/chain";
import useSettlementStore from "../hooks/store/use-settlement-store";
import { useSyncStore } from "../hooks/store/use-sync-store";
import { useTransactionStore } from "../hooks/store/use-transaction-store";
import { useUIStore } from "../hooks/store/use-ui-store";
import { disposeGameSyncSession, installActiveGameClient } from "../sync/active-game-client";
import { createGameSyncObserver } from "../sync/game-sync-observer";
import { markGameEntryMilestone, recordGameEntryDuration } from "../ui/layouts/game-entry-timeline";
import { createBootstrapSession, type BootstrapSelection } from "./bootstrap-session";
import { resolveCachedEntrySessionForContext } from "./bootstrap-session-context";
import { prepareGameRenderer } from "./game-renderer";
import type { GameRendererSession } from "./game-renderer-session";
import { selectInitialStructure } from "./initial-structure";

export type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";

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
  const reportProgress = createInitialSyncProgressReporter(stores.syncingStore.setInitialSyncProgress);
  const renderer = createBootstrapRendererHandoff();
  reportProgress(0);
  try {
    const client = await createEntryGameClient({
      chain: context.chain,
      profile,
      reportProgress,
      onSetupCompleted: renderer.prepare,
    });
    installActiveGameClient(client);
    selectInitialStructure(client.setup, stores.uiStore);
    reportProgress(100);
    await startGameRenderer(renderer.requireSession().initialize);
    return { context, profile, setupResult: client.setup };
  } catch (error) {
    renderer.cleanup();
    throw error;
  }
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
      tags: { feature: "bootstrap", error_type: "game_setup", setup_phase: "bootstrap" },
      extra: { context: "Unhandled error during game bootstrap" },
    });
    throw error;
  }
};

type BootstrapStores = {
  syncingStore: ReturnType<typeof useSyncStore.getState>;
  uiStore: ReturnType<typeof useUIStore.getState>;
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

type InitialSyncProgressReporter = (progress: number) => void;

/** The entry screen's bar only moves forward, whatever order the sync phases report in. */
const createInitialSyncProgressReporter = (setProgress: (progress: number) => void): InitialSyncProgressReporter => {
  let highestProgress = -1;
  return (progress) => {
    if (progress <= highestProgress) {
      return;
    }

    highestProgress = progress;
    setProgress(progress);
  };
};

/** Renderer construction starts the GPU handshake, so it runs as soon as setup completes and overlaps the sync. */
const createBootstrapRendererHandoff = () => {
  let session: GameRendererSession | null = null;
  return {
    prepare: (setup: SetupResult) => {
      session = prepareGameRenderer(setup, DEV_MODE_ENABLED);
      bootstrapSession.replaceRendererCleanup(session.cleanup);
    },
    requireSession: (): GameRendererSession => {
      if (!session) throw new Error("Renderer was not prepared before the game client resolved");
      return session;
    },
    cleanup: () => session?.cleanup(),
  };
};

interface EntryGameClientInput {
  chain: Chain;
  profile: WorldProfile;
  reportProgress: InitialSyncProgressReporter;
  onSetupCompleted: (setup: SetupResult) => void;
}

const createEntryGameClient = async (input: EntryGameClientInput): Promise<GameClient> => {
  const timing = { syncStartedAt: performance.now() };
  verboseLog("[STARTING GAME SETUP]");
  markGameEntryMilestone("setup-started");
  const world = requireWorldById(input.profile.worldId);
  const client = await createBrowserGameClient({
    world,
    gameId: input.profile.gameId ?? 0,
    presetId: input.profile.presetId ?? 0,
    authHandler: bootstrapAuthHandler,
    observer: createGameSyncObserver({
      reportProgress: input.reportProgress,
      onSetupCompleted: (setup) => {
        verboseLog("[GAME SETUP COMPLETED]");
        input.onSetupCompleted(setup);
        timing.syncStartedAt = performance.now();
      },
    }),
  });
  markGameEntryMilestone("initial-sync-completed");
  recordGameEntryDuration("initial-sync", performance.now() - timing.syncStartedAt);
  verboseLog("[INITIAL SYNC COMPLETED]");
  return client;
};

const bootstrapAuthHandler: SystemCallAuthHandler = {
  // The identity chip derives "not signed in" from the identity session itself; nothing to open here.
  onNoAccount: () => verboseLog("[bootstrap] No gameplay account - the identity chip carries the sign-in surface"),
  onError: (error: unknown) => {
    console.error(`System call error: ${formatReadableErrorForConsole(error)}`);

    Sentry.captureException(error, {
      tags: { feature: "bootstrap", error_type: "game_system_call", setup_phase: "post-setup" },
      extra: { context: "System call error during post-setup phase" },
    });
  },
};

const startGameRenderer = async (initialize: () => Promise<void>) => {
  // Renderer init = Three.js scene/shader/texture compilation + spatial
  // bounds subscription. Often the slowest single step on a cold reload, and
  // previously had no breadcrumb between `initial-sync-completed` and
  // `bootstrap-completed`, so a 30s+ hang here looked indistinguishable from
  // a stuck initial sync.
  const rendererInitStartedAt = performance.now();
  markGameEntryMilestone("renderer-init-started");
  await initialize();
  markGameEntryMilestone("renderer-init-completed");
  recordGameEntryDuration("renderer-init", performance.now() - rendererInitStartedAt);
};

const cancelActiveBootstrapSubscriptions = () => {
  disposeGameSyncSession();
};

const clearBootstrapWorldData = () => {
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
