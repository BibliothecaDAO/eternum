import { useEffect, useMemo, useRef } from "react";

import { POLLING_INTERVALS } from "@/config/polling";
import { gameIdKey, gameModel, getScopedGameId, isGameScoped } from "@/dojo/game-scope";
import { getStructuresDataFromTorii } from "@/dojo/queries";
import { syncEntitiesDebounced } from "@/dojo/sync";
import { sqlApi } from "@/services/api";
import { padHexAddressTo66 } from "@/ui/utils/utils";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { env } from "../../../env";
import { useAccountStore } from "../store/use-account-store";
import { useConnectionStore } from "../store/use-connection-store";
import { selectUnsyncedOwnedStructureTargets } from "./player-structure-sync-utils";

// Models synced per-player via a scoped subscription (see usePlayerStructureSync).
// StructureBuildings carries population — keyed (game_id, entity_id) like the
// rest; without it the counter only updates via the bounds-gated map stream.
const getPlayerStructureModels = (): string[] =>
  ["ProductionBoostBonus", "Resource", "ResourceArrival", "StructureBuildings"].map(gameModel);

// Structures owned by an address, optionally pinned to the active s2 game.
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

const OWNED_STRUCTURE_BACKFILL_DEBOUNCE_MS = 250;

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
  if (typeof directOwner === "string" && directOwner.startsWith("0x")) {
    return directOwner;
  }

  const base = unwrapToriiFieldValue(structureModel.base);
  if (!isRecord(base)) return null;

  const ownerFromBase = unwrapToriiFieldValue(base.owner);
  if (typeof ownerFromBase === "string" && ownerFromBase.startsWith("0x")) {
    return ownerFromBase;
  }

  return null;
};

export const usePlayerStructureSync = () => {
  const {
    setup: {
      network: { toriiClient, contractComponents },
    },
    setup,
  } = useDojo();

  const playerStructures = usePlayerStructures();

  const subscriptionRef = useRef<{ cancel: () => void } | null>(null);
  const ownerStructureSubscriptionRef = useRef<{ cancel: () => void } | null>(null);
  const syncedStructureIds = useRef<Set<number>>(new Set());
  const inFlightStructureIds = useRef<Set<number>>(new Set());
  const requestOwnedStructureBackfillRef = useRef<(() => void) | null>(null);
  const ownedStructureBackfillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const structureEntityIds = useMemo(() => playerStructures.map((s) => s.entityId), [playerStructures]);

  const structurePositions = useMemo(
    () => playerStructures.map((s) => ({ col: s.position.x, row: s.position.y })),
    [playerStructures],
  );

  const accountAddress = useAccountStore().account?.address;
  const streamReconnectVersion = useConnectionStore((state) => state.streamReconnectVersion);
  const toriiComponents = contractComponents as unknown as Parameters<typeof getStructuresDataFromTorii>[1];
  const structureEntityIdsRef = useRef<ReadonlySet<number>>(new Set());
  const isBackfillRunning = useRef(false);
  const rerunBackfillAfterCurrent = useRef(false);

  useEffect(() => {
    structureEntityIdsRef.current = new Set(structureEntityIds);
  }, [structureEntityIds]);

  useEffect(() => {
    syncedStructureIds.current.clear();
    inFlightStructureIds.current.clear();
    isBackfillRunning.current = false;
  }, [accountAddress]);

  // Keep owned structures backfilled into RECS so ownership UI updates even if stream updates are missed.
  useEffect(() => {
    if (!accountAddress || !toriiClient || !toriiComponents) return;
    let cancelled = false;

    const clearScheduledBackfill = () => {
      if (ownedStructureBackfillTimerRef.current === null) {
        return;
      }

      clearTimeout(ownedStructureBackfillTimerRef.current);
      ownedStructureBackfillTimerRef.current = null;
    };

    const backfillOwnedStructures = async () => {
      if (isBackfillRunning.current) {
        rerunBackfillAfterCurrent.current = true;
        return;
      }

      isBackfillRunning.current = true;

      let claimedStructureIds: number[] = [];
      try {
        rerunBackfillAfterCurrent.current = false;
        const ownedStructures = await sqlApi.fetchStructuresByOwner(accountAddress);
        if (cancelled || ownedStructures.length === 0) return;

        const structuresToSync = selectUnsyncedOwnedStructureTargets({
          ownedStructures,
          currentPlayerStructureIds: structureEntityIdsRef.current,
          inFlightStructureIds: inFlightStructureIds.current,
        });

        if (structuresToSync.length === 0) return;

        structuresToSync.forEach(({ entityId }) => inFlightStructureIds.current.add(entityId));
        claimedStructureIds = structuresToSync.map(({ entityId }) => entityId);

        await getStructuresDataFromTorii(toriiClient, toriiComponents, structuresToSync);

        if (!cancelled) {
          structuresToSync.forEach(({ entityId }) => syncedStructureIds.current.add(entityId));
        }
      } catch (error) {
        console.error("[usePlayerStructureSync] Failed to backfill owned structures", error);
      } finally {
        claimedStructureIds.forEach((entityId) => inFlightStructureIds.current.delete(entityId));
        isBackfillRunning.current = false;
        if (!cancelled && rerunBackfillAfterCurrent.current) {
          requestOwnedStructureBackfillRef.current?.();
        }
      }
    };

    const requestOwnedStructureBackfill = () => {
      if (cancelled) {
        return;
      }
      if (isBackfillRunning.current) {
        rerunBackfillAfterCurrent.current = true;
        return;
      }
      if (ownedStructureBackfillTimerRef.current !== null) {
        return;
      }

      ownedStructureBackfillTimerRef.current = setTimeout(() => {
        ownedStructureBackfillTimerRef.current = null;
        void backfillOwnedStructures();
      }, OWNED_STRUCTURE_BACKFILL_DEBOUNCE_MS);
    };

    requestOwnedStructureBackfillRef.current = requestOwnedStructureBackfill;
    void backfillOwnedStructures();

    // Reconciliation backstop: ownership changes reach the client only through
    // event-shaped paths that can each miss (subscription churn during a claim,
    // SQL backfill racing the indexer). The periodic backfill turns a missed
    // event into ≤10s of staleness instead of a structure that never appears.
    // Near-free when nothing was missed: one cached SQL read, then a no-op.
    const reconciliationIntervalId = setInterval(requestOwnedStructureBackfill, POLLING_INTERVALS.playerStructuresMs);

    return () => {
      cancelled = true;
      clearInterval(reconciliationIntervalId);
      clearScheduledBackfill();
      rerunBackfillAfterCurrent.current = false;
      if (requestOwnedStructureBackfillRef.current === requestOwnedStructureBackfill) {
        requestOwnedStructureBackfillRef.current = null;
      }
    };
  }, [accountAddress, streamReconnectVersion, toriiClient, toriiComponents]);

  useEffect(() => {
    if (!accountAddress || !toriiClient) return;
    let cancelled = false;

    const ownerStructureClause = buildOwnerStructureClause(accountAddress);
    const normalizedAccountAddress = padHexAddressTo66(accountAddress).toLowerCase();

    const subscribeToOwnedStructureUpdates = async () => {
      const ownerSubscription = await toriiClient.onEntityUpdated(ownerStructureClause, (value: unknown) => {
        if (cancelled) return;

        const owner = readOwnerFromStructureModelUpdate(value);
        if (!owner) return;

        const normalizedUpdateOwner = padHexAddressTo66(owner).toLowerCase();
        if (normalizedUpdateOwner !== normalizedAccountAddress) return;

        requestOwnedStructureBackfillRef.current?.();
      });

      if (cancelled) {
        ownerSubscription.cancel();
        return;
      }

      ownerStructureSubscriptionRef.current = ownerSubscription;
    };

    void subscribeToOwnedStructureUpdates().catch((error) => {
      console.error("[usePlayerStructureSync] Failed to subscribe to owned structure updates", error);
    });

    return () => {
      cancelled = true;
      if (ownerStructureSubscriptionRef.current) {
        ownerStructureSubscriptionRef.current.cancel();
        ownerStructureSubscriptionRef.current = null;
      }
    };
  }, [accountAddress, streamReconnectVersion, toriiClient]);

  // Sync newly-seen structures into RECS (e.g. first settlement).
  useEffect(() => {
    if (!toriiClient || !toriiComponents || playerStructures.length === 0) return;
    let cancelled = false;

    const structuresToSync = playerStructures
      .filter(
        (structure) =>
          !syncedStructureIds.current.has(structure.entityId) && !inFlightStructureIds.current.has(structure.entityId),
      )
      .map((structure) => ({
        entityId: structure.entityId,
        position: { col: structure.position.x, row: structure.position.y },
      }));

    if (structuresToSync.length === 0) return;

    structuresToSync.forEach(({ entityId }) => inFlightStructureIds.current.add(entityId));

    void (async () => {
      try {
        await getStructuresDataFromTorii(toriiClient, toriiComponents, structuresToSync);
        if (!cancelled) {
          structuresToSync.forEach(({ entityId }) => syncedStructureIds.current.add(entityId));
        }
      } catch (error) {
        console.error("[usePlayerStructureSync] Failed to sync newly seen structures", error);
      } finally {
        structuresToSync.forEach(({ entityId }) => inFlightStructureIds.current.delete(entityId));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerStructures, toriiClient, toriiComponents]);

  useEffect(() => {
    let cancelled = false;

    const subscribe = async () => {
      // Cancel previous subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }

      if (!accountAddress || !toriiClient) return;

      const playerStructureModels = getPlayerStructureModels();
      const structureClauses = structureEntityIds.map((id) => ({
        Keys: {
          keys: isGameScoped() ? [gameIdKey(), `0x${id.toString(16)}`] : [id.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: playerStructureModels,
        },
      }));

      const buildingClauses = structurePositions.map((pos) => ({
        Keys: {
          // s2 Building is keyed (game_id, alt, outer_col, outer_row, ...) —
          // structures never sit on the alt plane (Cairo pins alt to false),
          // so match it exactly: a mid-pattern undefined wildcard does not
          // survive the grpc key encoding and matches nothing (mirrors
          // getBuildingsFromTorii in dojo/queries.ts).
          keys: isGameScoped()
            ? [gameIdKey(), "0x0", `0x${pos.col.toString(16)}`, `0x${pos.row.toString(16)}`]
            : [pos.col.toString(), pos.row.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: [gameModel("Building")],
        },
      }));

      const ownerStructureClause = buildOwnerStructureClause(accountAddress);

      const clause: Clause = {
        Composite: {
          operator: "Or",
          clauses: [...structureClauses, ...buildingClauses, ownerStructureClause],
        },
      };

      const subscription = await syncEntitiesDebounced(toriiClient, setup, clause, false, undefined, {
        streamType: "player",
        subscriptionSetupTimeoutMs: env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS,
      });

      if (cancelled) {
        subscription.cancel();
        return;
      }

      subscriptionRef.current = subscription;
    };

    void subscribe().catch((error) => {
      console.error("[usePlayerStructureSync] Failed to subscribe to player structure updates", error);
    });

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }
    };
  }, [structureEntityIds, structurePositions, accountAddress, streamReconnectVersion, toriiClient, setup]);
};
