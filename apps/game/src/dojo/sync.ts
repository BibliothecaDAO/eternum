import type { AppStore } from "@/hooks/store/use-ui-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type SetupResult } from "@bibliothecadao/dojo";

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { recordGameEntryDuration } from "@/ui/layouts/game-entry-timeline";
import { createHeraldGameSyncSession } from "@/sync/herald-game-sync-session";
import { verboseLog } from "@/utils/dev-mode";
import {
  disposeActiveGameSyncRuntime,
  getActiveGameSyncRuntime,
  getGameSyncModelsForChannel,
  installFreshGameSyncRuntime,
  requireActiveGameSyncRuntime,
  WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import type { GameSyncRuntimeMetrics } from "@bibliothecadao/eternum/game-sync";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import type { Clause } from "@dojoengine/torii-wasm/types";
import {
  getAddressNamesFromTorii,
  getBankStructuresFromTorii,
  getConfigFromTorii,
  getGuildsFromTorii,
} from "./queries";
import { env } from "../../env";
import { createGamewideSyncSession } from "./gamewide-sync-adapter";
import { gameEntityKey, gameModel, getScopedGameId, isGameScoped } from "./game-scope";
import { resolveInitialStructureSelection } from "./sync-initial-selection";
import { buildModelKeysClause, type GlobalModelStreamConfig } from "./torii-model-clause";
import type { ToriiSubscriptionSetupTimeoutInfo } from "./torii-subscription-setup";

/**
 * Cancel the global entity stream subscription.
 * Used during game switching to stop the old Torii client from writing
 * stale data into RECS while the new world is being bootstrapped.
 *
 * No-op while a boot is still handshaking — tearing down a half-built
 * subscription strands RECS and the monitor then re-enters the same loop.
 */
export const cancelGameSyncWriter = () => {
  getActiveGameSyncRuntime()?.cancelGlobalWriter();
};

export const disposeGameSyncSession = (): void => {
  disposeActiveGameSyncRuntime();
  clearGamewideMetricsReporter();
};

// Bare names — the namespace resolves from the active game scope at call time.
const getGlobalEventModels = (): string[] =>
  getGameSyncModelsForChannel("global-event", { includeS2Only: isGameScoped() }).map(({ name }) => gameModel(name));

const getGamewideEntityStreamModels = (): GlobalModelStreamConfig[] =>
  getGameSyncModelsForChannel("gamewide-entity", { includeS2Only: isGameScoped() }).map(({ name }) => ({
    model: gameModel(name),
  }));

const getGlobalEventStreamClause = (): Clause =>
  buildModelKeysClause(getGlobalEventModels().map((model) => ({ model })));

const getGamewideEntityStreamClause = (): Clause => buildModelKeysClause(getGamewideEntityStreamModels());

const stringifyWorldmapSyncABPayload = (payload: Record<string, unknown>): string => {
  try {
    return JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value));
  } catch (error) {
    return JSON.stringify({
      serializationError: error instanceof Error ? error.message : String(error),
    });
  }
};

const logWorldmapSyncAB = (message: string, payload: Record<string, unknown>): void => {
  if (env.VITE_PUBLIC_TORII_BOUNDS_DEBUG !== true) {
    return;
  }

  console.info(`[WorldmapSyncAB] ${message} ${stringifyWorldmapSyncABPayload(payload)}`);
};

// initial sync runs before the game is playable and should sync minimal data
type InitialSyncOptions = {
  logging?: boolean;
  reportProgress?: boolean;
  subscriptionSetupTimeoutMs?: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
  // Re-applies config-derived snapshots (configManager.setDojo) when the
  // session-cached config fast path finishes its background revalidation.
  onConfigRefreshed?: () => void;
};

const recordGamewideSubscriptionActive = (): void => {
  const connection = useConnectionStore.getState();
  connection.recordGlobalHandshake();
  connection.recordSpatialHandshake();
};

const recordGamewideLiveUpdate = (): void => {
  const connection = useConnectionStore.getState();
  connection.recordGlobalUpdate();
  connection.recordSpatialUpdate();
};

let pendingGamewideMetrics: GameSyncRuntimeMetrics | null = null;
let gamewideMetricsLogTimer: ReturnType<typeof setTimeout> | null = null;

function clearGamewideMetricsReporter(): void {
  if (gamewideMetricsLogTimer) clearTimeout(gamewideMetricsLogTimer);
  pendingGamewideMetrics = null;
  gamewideMetricsLogTimer = null;
}

const reportGamewideSyncMetrics = (metrics: GameSyncRuntimeMetrics): void => {
  logWorldmapSyncAB("Game-wide sync metrics", metrics as unknown as Record<string, unknown>);
  pendingGamewideMetrics = metrics;
  if (gamewideMetricsLogTimer) return;

  gamewideMetricsLogTimer = setTimeout(() => {
    if (pendingGamewideMetrics && import.meta.env.DEV) {
      console.info(
        `[GameSyncMetrics] ${stringifyWorldmapSyncABPayload(pendingGamewideMetrics as unknown as Record<string, unknown>)}`,
      );
    }
    pendingGamewideMetrics = null;
    gamewideMetricsLogTimer = null;
  }, 1_000);
};

const createActiveGamewideSyncSession = (input: {
  setup: SetupResult;
  logging: boolean;
  subscriptionSetupTimeoutMs: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}) => {
  if (env.VITE_PUBLIC_HERALD_URL) {
    return createHeraldGameSyncSession({
      baseUrl: env.VITE_PUBLIC_HERALD_URL,
      chain: env.VITE_PUBLIC_CHAIN,
      entityModels: getGameSyncModelsForChannel("gamewide-entity", { includeS2Only: isGameScoped() }).map(
        ({ name }) => name,
      ),
      eventModels: getGameSyncModelsForChannel("global-event", { includeS2Only: isGameScoped() }).map(
        ({ name }) => name,
      ),
      gameId: getScopedGameId(),
      logging: input.logging,
      onSubscriptionActive: recordGamewideSubscriptionActive,
      onLiveUpdate: recordGamewideLiveUpdate,
      onMetrics: reportGamewideSyncMetrics,
      setup: input.setup,
    });
  }

  const entityModels = getGamewideEntityStreamModels().map(({ model }) => model);
  return createGamewideSyncSession({
    setup: input.setup,
    entityClause: getGamewideEntityStreamClause(),
    eventClause: getGlobalEventStreamClause(),
    eventModels: getGlobalEventModels(),
    entityModels,
    logging: input.logging,
    subscriptionSetupTimeoutMs: input.subscriptionSetupTimeoutMs,
    snapshotPageTimeoutMs: env.VITE_PUBLIC_TORII_SNAPSHOT_PAGE_TIMEOUT_MS,
    eventReplayPageTimeoutMs: env.VITE_PUBLIC_TORII_EVENT_REPLAY_PAGE_TIMEOUT_MS,
    pageRetryCount: env.VITE_PUBLIC_TORII_PAGE_RETRY_COUNT,
    onSubscriptionSetupTimeout: input.onSubscriptionSetupTimeout,
    onSubscriptionActive: recordGamewideSubscriptionActive,
    onLiveUpdate: recordGamewideLiveUpdate,
    onMetrics: reportGamewideSyncMetrics,
  });
};

const getOrInstallGameSyncRuntime = () => getActiveGameSyncRuntime() ?? installFreshGameSyncRuntime();

const installActiveWorldSpatialProjection = (setup: SetupResult): void => {
  getOrInstallGameSyncRuntime().installWorldSpatialProjection(
    new WorldSpatialProjection({
      tileOptComponent: setup.network.contractComponents.TileOpt,
      explorerTroopsComponent: setup.network.contractComponents.ExplorerTroops,
    }),
  );
};

interface InitialSelectableStructure {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  category: number;
}

const readInitialSelectableStructures = (setup: SetupResult): InitialSelectableStructure[] =>
  Array.from(runQuery([Has(setup.components.Structure)]))
    .flatMap((entity) => {
      const structure = getComponentValue(setup.components.Structure, entity);
      if (!structure) return [];

      return [
        {
          entity_id: Number(structure.entity_id),
          coord_x: Number(structure.base.coord_x),
          coord_y: Number(structure.base.coord_y),
          category: Number(structure.base.category),
        },
      ];
    })
    .sort((left, right) => left.entity_id - right.entity_id);

const readOwnedInitialStructures = (
  setup: SetupResult,
  ownerAddress: string | undefined,
): InitialSelectableStructure[] => {
  if (!ownerAddress) return [];
  const owner = BigInt(ownerAddress);
  return readInitialSelectableStructures(setup).filter((candidate) => {
    const structure = getComponentValue(setup.components.Structure, gameEntityKey([BigInt(candidate.entity_id)]));
    return structure?.owner === owner;
  });
};

type InitialSyncProgressReporter = (progress: number) => void;

const createInitialSyncProgressReporter = (
  enabled: boolean,
  setProgress: (progress: number) => void,
): InitialSyncProgressReporter => {
  if (!enabled) {
    return () => undefined;
  }

  let highestProgress = -1;
  return (progress) => {
    if (progress <= highestProgress) {
      return;
    }

    highestProgress = progress;
    setProgress(progress);
  };
};

const runInitialSyncTask = async ({
  label,
  targetProgress,
  task,
  reportProgress,
}: {
  label: string;
  targetProgress: number;
  task: () => Promise<void>;
  reportProgress: InitialSyncProgressReporter;
}): Promise<void> => {
  const startedAt = performance.now();
  await task();
  const elapsedMs = performance.now() - startedAt;
  verboseLog(`[sync] ${label}`, elapsedMs);
  recordGameEntryDuration(`initial-sync-${label.replace(/\s+/g, "-")}`, elapsedMs);
  reportProgress(targetProgress);
};

const startAuthoritativeGameSyncSession = async ({
  setup,
  logging,
  subscriptionSetupTimeoutMs,
  onSubscriptionSetupTimeout,
}: {
  setup: SetupResult;
  logging: boolean;
  subscriptionSetupTimeoutMs: number;
  onSubscriptionSetupTimeout?: (info: ToriiSubscriptionSetupTimeoutInfo) => void;
}): Promise<void> => {
  const startedAt = performance.now();
  try {
    logWorldmapSyncAB("Initial sync config", {
      eventModels: getGlobalEventModels(),
      globalEntityMode: "gamewide_static_scope",
      globalEntityModels: getGamewideEntityStreamModels().map(({ model }) => model),
      timestamp: new Date().toISOString(),
    });
    const runtime = getOrInstallGameSyncRuntime();
    await runtime.startSession(
      createActiveGamewideSyncSession({
        setup,
        logging,
        subscriptionSetupTimeoutMs,
        onSubscriptionSetupTimeout,
      }),
    );
    setup.network.provider.setTransactionStreamWaiter((transactionHash) => runtime.waitForTransaction(transactionHash));
    installActiveWorldSpatialProjection(setup);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timed out waiting for")) {
      throw new Error(`Timed out connecting to the world stream after ${subscriptionSetupTimeoutMs}ms.`);
    }
    throw error;
  } finally {
    recordGameEntryDuration("initial-sync-game-session-start", performance.now() - startedAt);
  }
};

const selectInitialStructure = (
  setup: SetupResult,
  state: AppStore,
  reportProgress: InitialSyncProgressReporter,
): void => {
  if (state.structureEntityId && state.structureEntityId !== 0) {
    reportProgress(25);
    return;
  }

  const accountAddress = useAccountStore.getState().account?.address;
  const hasConnectedAccount =
    typeof accountAddress === "string" && accountAddress.length > 0 && accountAddress !== "0x0";
  const ownedStructures = readOwnedInitialStructures(setup, hasConnectedAccount ? accountAddress : undefined);
  const firstGlobalStructure = ownedStructures.length > 0 ? null : (readInitialSelectableStructures(setup)[0] ?? null);
  const { selectedStructure, spectator } = resolveInitialStructureSelection({
    ownedStructures,
    firstGlobalStructure,
  });
  if (!selectedStructure) {
    return;
  }

  state.setStructureEntityId(selectedStructure.entity_id, {
    spectator,
    worldMapPosition: { col: selectedStructure.coord_x, row: selectedStructure.coord_y },
  });
  reportProgress(25);
};

const syncInitialSupportData = async (
  setup: SetupResult,
  options: InitialSyncOptions,
  reportProgress: InitialSyncProgressReporter,
): Promise<void> => {
  await Promise.all([
    runInitialSyncTask({
      label: "bank structures query",
      targetProgress: 10,
      reportProgress,
      task: () => getBankStructuresFromTorii(setup.network.toriiClient),
    }),
    runInitialSyncTask({
      label: "config query",
      targetProgress: 50,
      reportProgress,
      task: () => getConfigFromTorii(setup.network.toriiClient, options.onConfigRefreshed),
    }),
    runInitialSyncTask({
      label: "address names query",
      targetProgress: 75,
      reportProgress,
      task: () => getAddressNamesFromTorii(setup.network.toriiClient),
    }),
    runInitialSyncTask({
      label: "guilds query",
      targetProgress: 90,
      reportProgress,
      task: () => getGuildsFromTorii(setup.network.toriiClient),
    }),
  ]);
};

export const initialSync = async (
  setup: SetupResult,
  state: AppStore,
  setInitialSyncProgress: (progress: number) => void,
  options: InitialSyncOptions = {},
): Promise<void> => {
  const logging = options.logging ?? false;
  const subscriptionSetupTimeoutMs =
    options.subscriptionSetupTimeoutMs ?? env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS;
  const reportProgress = createInitialSyncProgressReporter(options.reportProgress ?? true, setInitialSyncProgress);

  verboseLog("[STARTING game sync]");
  reportProgress(0);
  await startAuthoritativeGameSyncSession({
    setup,
    logging,
    subscriptionSetupTimeoutMs,
    onSubscriptionSetupTimeout: options.onSubscriptionSetupTimeout,
  });
  selectInitialStructure(setup, state, reportProgress);
  await syncInitialSupportData(setup, options, reportProgress);
  reportProgress(100);
};

/** Reconnect through the same convergent subscribe → snapshot → replay routine used at boot. */
export const recoverGameSyncSession = async (): Promise<void> => {
  await requireActiveGameSyncRuntime().recover();
};
