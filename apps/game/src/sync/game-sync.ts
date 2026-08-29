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
import type { GameSyncSnapshotProgress } from "@bibliothecadao/eternum/game-sync";
import { getComponentValue, Has, runQuery } from "@dojoengine/recs";
import { env } from "../../env";
import { gameEntityKey, getScopedGameId, isGameScoped } from "./game-scope";
import { resolveInitialStructureSelection } from "./initial-structure-selection";

export const disposeGameSyncSession = (): void => {
  disposeActiveGameSyncRuntime();
};

const getEventModels = (): string[] =>
  getGameSyncModelsForChannel("global-event", { includeS2Only: isGameScoped() }).map(({ name }) => name);

const getEntityModels = (): string[] =>
  getGameSyncModelsForChannel("gamewide-entity", { includeS2Only: isGameScoped() }).map(({ name }) => name);

// initial sync runs before the game is playable and should sync minimal data
type InitialSyncOptions = {
  logging?: boolean;
  reportProgress?: boolean;
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

const snapshotProgressPercentage = ({ completed, phase, total }: GameSyncSnapshotProgress): number => {
  const ratio = total > 0 ? Math.min(1, completed / total) : 0;
  return phase === "receiving" ? 5 + ratio * 40 : 45 + ratio * 45;
};

const createActiveGamewideSyncSession = (input: {
  setup: SetupResult;
  logging: boolean;
  reportProgress: InitialSyncProgressReporter;
}) => {
  return createHeraldGameSyncSession({
    baseUrl: env.VITE_PUBLIC_HERALD_URL,
    chain: env.VITE_PUBLIC_CHAIN,
    entityModels: getEntityModels(),
    eventModels: getEventModels(),
    gameId: getScopedGameId(),
    logging: input.logging,
    onSubscriptionActive: recordGamewideSubscriptionActive,
    onLiveUpdate: recordGamewideLiveUpdate,
    onSnapshotProgress: (progress) => input.reportProgress(snapshotProgressPercentage(progress)),
    setup: input.setup,
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
  reportProgress,
}: {
  setup: SetupResult;
  logging: boolean;
  reportProgress: InitialSyncProgressReporter;
}): Promise<void> => {
  const startedAt = performance.now();
  try {
    const runtime = getOrInstallGameSyncRuntime();
    await runtime.startSession(
      createActiveGamewideSyncSession({
        setup,
        logging,
        reportProgress,
      }),
    );
    setup.network.provider.setTransactionStreamWaiter(
      runtime.hasTransactionStatusChannel()
        ? (transactionHash) => runtime.waitForTransaction(transactionHash)
        : undefined,
      runtime.hasTransactionStatusChannel()
        ? (transactionHash) => runtime.recordSubmittedTransaction(transactionHash)
        : undefined,
    );
    installActiveWorldSpatialProjection(setup);
  } catch (error) {
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
    reportProgress(95);
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
  reportProgress(95);
};

export const initialSync = async (
  setup: SetupResult,
  state: AppStore,
  setInitialSyncProgress: (progress: number) => void,
  options: InitialSyncOptions = {},
): Promise<void> => {
  const logging = options.logging ?? false;
  const reportProgress = createInitialSyncProgressReporter(options.reportProgress ?? true, setInitialSyncProgress);

  verboseLog("[STARTING game sync]");
  reportProgress(0);
  await startAuthoritativeGameSyncSession({
    setup,
    logging,
    reportProgress,
  });
  selectInitialStructure(setup, state, reportProgress);
  reportProgress(100);
};

/** Reconnect through the same convergent subscribe → snapshot → replay routine used at boot. */
export const recoverGameSyncSession = async (): Promise<void> => {
  await requireActiveGameSyncRuntime().recover();
};
