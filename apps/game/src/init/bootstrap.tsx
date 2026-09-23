import * as Sentry from "@sentry/react";
import { DEV_MODE_ENABLED, verboseLog } from "@/utils/dev-mode";
import { formatReadableErrorForConsole } from "@/utils/error-message";
import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";
import { createBrowserGameClient } from "@/services/game-client";
import type { GameClient } from "@bibliothecadao/eternum";
import { SupersededGameSyncStartError } from "@bibliothecadao/eternum/game-sync";
import { type SystemCallAuthHandler } from "@bibliothecadao/types";

import { resolveEntryContextCacheKey, type ResolvedEntryContext } from "@/game-entry/context";
import { applyGameSelection, type GameProfile } from "@/runtime/world";
import { requireOpenShard } from "@/runtime/world/shards";
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
import { followInitialStructure } from "./initial-structure";

export type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";

export interface BootstrappedEntrySession {
  context: ResolvedEntryContext;
  profile: GameProfile;
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
  return { cacheKey: resolveEntryContextCacheKey(context) };
};

/**
 * The game this page plays has one client, which holds the one Herald stream for it. Settling and booting the scene
 * both attach to it, so entering a game opens one session and takes one snapshot; another game resets it.
 */
let attachedGameClient: { key: string; client: Promise<GameClient> } | null = null;
let stopFollowingInitialStructure: (() => void) | null = null;

export const attachGameClient = (
  context: ResolvedEntryContext,
  onSetupCompleted?: (setup: SetupResult) => void,
): Promise<GameClient> => {
  const key = resolveEntryContextCacheKey(context);
  if (attachedGameClient?.key === key) return attachedGameClient.client;
  if (attachedGameClient) resetBootstrap();
  const client = applyGameSelection(context)
    .then((profile) => createEntryGameClient({ profile, onSetupCompleted }))
    .then((created) => {
      installActiveGameClient(created);
      // Selection follows the client from the moment it exists: settlement attaches it before the game boots, so the
      // entry after founding already names the realm and the world map opens on it instead of re-opening there.
      stopFollowingInitialStructure?.();
      stopFollowingInitialStructure = followInitialStructure(created.setup);
      return created;
    });
  attachedGameClient = { key, client };
  // A failed start leaves nothing attached, so the next attempt starts afresh.
  client.catch(() => {
    if (attachedGameClient?.client === client) attachedGameClient = null;
  });
  return client;
};

const runBootstrap = async ({
  context,
  profile,
}: {
  context: ResolvedEntryContext;
  profile: GameProfile;
}): Promise<BootstrapResult> => {
  const renderer = createBootstrapRendererHandoff();
  try {
    const client = await attachGameClient(context, renderer.prepare);
    // A client attached earlier (settlement) was set up before this boot, so the renderer is prepared from it here.
    renderer.prepare(client.setup);
    useSyncStore.getState().setInitialSyncProgress(100);
    await startGameRenderer(renderer.requireSession().initialize);
    return { context, profile, setupResult: client.setup };
  } catch (error) {
    renderer.cleanup();
    throw error;
  }
};
export const resetBootstrap = () => {
  verboseLog("[BOOTSTRAP] Resetting bootstrap state");
  attachedGameClient = null;
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
  const profile = await applyGameSelection(context);
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

const resetBootstrapForSelectionChange = (selection: BootstrapSelection) => {
  const resetReason = bootstrapSession.getResetReason(selection);
  if (!resetReason) {
    return;
  }

  const previousSelection = bootstrapSession.getTrackedSelection();
  verboseLog(
    `[BOOTSTRAP] Game changed from "${previousSelection.cacheKey}" to "${selection.cacheKey}", re-bootstrapping...`,
  );
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
      if (session) return;
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
  profile: GameProfile;
  onSetupCompleted?: (setup: SetupResult) => void;
}

const createEntryGameClient = async (input: EntryGameClientInput): Promise<GameClient> => {
  const timing = { syncStartedAt: performance.now() };
  verboseLog("[STARTING GAME SETUP]");
  markGameEntryMilestone("setup-started");
  const reportProgress = createInitialSyncProgressReporter(useSyncStore.getState().setInitialSyncProgress);
  reportProgress(0);
  const client = await createBrowserGameClient({
    shard: await requireOpenShard(input.profile.chainId),
    gameId: input.profile.gameId,
    presetId: input.profile.presetId,
    authHandler: bootstrapAuthHandler,
    observer: createGameSyncObserver({
      reportProgress,
      onSetupCompleted: (setup) => {
        verboseLog("[GAME SETUP COMPLETED]");
        input.onSetupCompleted?.(setup);
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
  stopFollowingInitialStructure?.();
  stopFollowingInitialStructure = null;
  disposeGameSyncSession();
};

const clearBootstrapWorldData = () => {
  useSyncStore.getState().resetSubscriptions();
};

const resetBootstrapUiState = () => {
  const uiStore = useUIStore.getState();
  uiStore.setStructureEntityId(0, { spectator: false, worldMapPosition: undefined });

  useTransactionStore.getState().clearAllTransactions();
};
