import { POLLING_INTERVALS } from "@/config/polling";
import { gameIdKey, gameModel, getScopedGameId, isGameScoped } from "@/dojo/game-scope";
import { getStructuresDataFromTorii } from "@/dojo/queries";
import { syncEntitiesDebounced } from "@/dojo/sync";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { sqlApi } from "@/services/api";
import { padHexAddressTo66 } from "@/ui/utils/utils";
import {
  getGameSyncModelsForChannel,
  getActiveGameSyncRuntime,
  PlayerStructureSyncWriter,
  type PlayerStructureSyncTarget,
} from "@bibliothecadao/eternum/game-sync";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { useEffect, useMemo, useRef } from "react";
import { env } from "../../../env";

const OWNED_STRUCTURE_BACKFILL_DEBOUNCE_MS = 250;

const getPlayerStructureModelNames = (): string[] =>
  getGameSyncModelsForChannel("player-entity")
    .map(({ name }) => name)
    .filter((name) => name !== "Structure" && name !== "Building");

const buildOwnerStructureClause = (accountAddress: string): Clause => {
  const structureModel = gameModel("Structure") as `${string}-${string}`;
  const ownerClause = MemberClause(structureModel, "owner", "Eq", {
    type: "ContractAddress",
    value: padHexAddressTo66(accountAddress),
  });

  return isGameScoped()
    ? AndComposeClause([ownerClause, MemberClause(structureModel, "game_id", "Eq", getScopedGameId())]).build()
    : ownerClause.build();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const unwrapToriiFieldValue = (value: unknown): unknown => {
  let current = value;
  while (isRecord(current) && "value" in current && ("type" in current || "type_name" in current || "key" in current)) {
    current = current.value;
  }
  return current;
};

const readOwnerFromStructureModelUpdate = (update: unknown): string | null => {
  if (!isRecord(update) || !isRecord(update.models)) return null;
  const structureModel = update.models[gameModel("Structure")];
  if (!isRecord(structureModel)) return null;

  const directOwner = unwrapToriiFieldValue(structureModel.owner);
  if (typeof directOwner === "string" && directOwner.startsWith("0x")) return directOwner;

  const base = unwrapToriiFieldValue(structureModel.base);
  if (!isRecord(base)) return null;
  const ownerFromBase = unwrapToriiFieldValue(base.owner);
  return typeof ownerFromBase === "string" && ownerFromBase.startsWith("0x") ? ownerFromBase : null;
};

const buildPlayerStateClause = (accountAddress: string, targets: readonly PlayerStructureSyncTarget[]): Clause => {
  const playerModels = getPlayerStructureModelNames().map(gameModel);
  const structureClauses = targets.map(({ entityId }) => ({
    Keys: {
      keys: isGameScoped() ? [gameIdKey(), `0x${entityId.toString(16)}`] : [entityId.toString()],
      pattern_matching: "VariableLen" as PatternMatching,
      models: playerModels,
    },
  }));
  const buildingClauses = targets.map(({ position }) => ({
    Keys: {
      // s2 Building is keyed (game_id, alt, outer_col, outer_row, ...).
      // Structures are on the base plane, and a wildcard in the middle key
      // slot does not survive Torii's gRPC encoding, so alt must be exact.
      keys: isGameScoped()
        ? [gameIdKey(), "0x0", `0x${position.col.toString(16)}`, `0x${position.row.toString(16)}`]
        : [position.col.toString(), position.row.toString()],
      pattern_matching: "VariableLen" as PatternMatching,
      models: [gameModel("Building")],
    },
  }));

  return {
    Composite: {
      operator: "Or",
      clauses: [...structureClauses, ...buildingClauses, buildOwnerStructureClause(accountAddress)],
    },
  };
};

export const usePlayerStructureSync = () => {
  const {
    setup,
    setup: {
      network: { toriiClient, contractComponents },
    },
  } = useDojo();
  const accountAddress = useAccountStore().account?.address;
  const reconnectVersion = useConnectionStore((state) => state.streamReconnectVersion);
  const playerStructures = usePlayerStructures();
  const writerRef = useRef<PlayerStructureSyncWriter | null>(null);
  const lastReconnectVersionRef = useRef(reconnectVersion);
  const toriiComponents = contractComponents as unknown as Parameters<typeof getStructuresDataFromTorii>[1];
  const targets = useMemo<PlayerStructureSyncTarget[]>(
    () =>
      playerStructures.map(({ entityId, position }) => ({
        entityId,
        position: { col: position.x, row: position.y },
      })),
    [playerStructures],
  );

  useEffect(() => {
    if (!accountAddress || !toriiClient || !contractComponents) return;

    const normalizedAccountAddress = padHexAddressTo66(accountAddress).toLowerCase();
    const runtime = getActiveGameSyncRuntime();
    if (!runtime) return;
    const writer = new PlayerStructureSyncWriter({
      reconciliationIntervalMs: POLLING_INTERVALS.playerStructuresMs,
      backfillDebounceMs: OWNED_STRUCTURE_BACKFILL_DEBOUNCE_MS,
      fetchOwnedStructures: () => sqlApi.fetchStructuresByOwner(accountAddress),
      hydrateStructures: async (structures) => {
        await getStructuresDataFromTorii(toriiClient, toriiComponents, [...structures]);
      },
      subscribeToOwnerChanges: async (onOwnerChange) =>
        toriiClient.onEntityUpdated(buildOwnerStructureClause(accountAddress), (update: unknown) => {
          const owner = readOwnerFromStructureModelUpdate(update);
          if (owner && padHexAddressTo66(owner).toLowerCase() === normalizedAccountAddress) onOwnerChange();
        }),
      subscribeToPlayerState: (structures) =>
        syncEntitiesDebounced(
          toriiClient,
          setup,
          buildPlayerStateClause(accountAddress, structures),
          false,
          undefined,
          {
            streamType: "player",
            subscriptionSetupTimeoutMs: env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS,
          },
        ),
      onError: (operation, error) => console.error(`[usePlayerStructureSync] Failed to ${operation}`, error),
    });

    writer.start(targets);
    runtime.installPlayerWriter(writer);
    writerRef.current = writer;

    return () => {
      runtime.cancelPlayerWriter(writer);
      if (writerRef.current === writer) writerRef.current = null;
    };
  }, [accountAddress, setup, toriiClient, toriiComponents]);

  useEffect(() => {
    writerRef.current?.updateTargets(targets);
  }, [targets]);

  useEffect(() => {
    if (lastReconnectVersionRef.current !== reconnectVersion) {
      lastReconnectVersionRef.current = reconnectVersion;
      writerRef.current?.reconnect();
    }
  }, [reconnectVersion]);
};
