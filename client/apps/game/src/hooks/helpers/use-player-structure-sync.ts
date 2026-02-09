import { useEffect, useMemo, useRef } from "react";

import { getStructuresDataFromTorii } from "@/dojo/queries";
import { syncEntitiesDebounced } from "@/dojo/sync";
import { sqlApi } from "@/services/api";
import { padHexAddressTo66 } from "@/ui/utils/utils";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { MemberClause } from "@dojoengine/sdk";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { selectUnsyncedOwnedStructureTargets } from "./player-structure-sync-utils";
import { useAccountStore } from "../store/use-account-store";
import { useUIStore } from "../store/use-ui-store";

// Models synced per-player via a scoped subscription (see usePlayerStructureSync)
const PLAYER_STRUCTURE_MODELS: string[] = [
  "s1_eternum-ProductionBoostBonus",
  "s1_eternum-Resource",
  "s1_eternum-ResourceArrival",
];
const PLAYER_STRUCTURE_BACKFILL_INTERVAL_MS = 2500;

export const usePlayerStructureSync = () => {
  const {
    setup: {
      network: { toriiClient, contractComponents },
    },
    setup,
  } = useDojo();

  const playerStructures = usePlayerStructures();

  const subscriptionRef = useRef<{ cancel: () => void } | null>(null);
  const syncedStructureIds = useRef<Set<number>>(new Set());
  const inFlightStructureIds = useRef<Set<number>>(new Set());

  const structureEntityIds = useMemo(() => playerStructures.map((s) => s.entityId), [playerStructures]);

  const structurePositions = useMemo(
    () => playerStructures.map((s) => ({ col: s.position.x, row: s.position.y })),
    [playerStructures],
  );

  const accountAddress = useAccountStore().account?.address;
  const isSpectating = useUIStore((state) => state.isSpectating);
  const toriiComponents = contractComponents as unknown as Parameters<typeof getStructuresDataFromTorii>[1];
  const structureEntityIdsRef = useRef<ReadonlySet<number>>(new Set());
  const isBackfillRunning = useRef(false);

  useEffect(() => {
    structureEntityIdsRef.current = new Set(structureEntityIds);
  }, [structureEntityIds]);

  useEffect(() => {
    syncedStructureIds.current.clear();
    inFlightStructureIds.current.clear();
    isBackfillRunning.current = false;

    if (isSpectating && subscriptionRef.current) {
      subscriptionRef.current.cancel();
      subscriptionRef.current = null;
    }
  }, [accountAddress, isSpectating]);

  // Keep owned structures backfilled into RECS so ownership UI updates even if stream updates are missed.
  useEffect(() => {
    if (isSpectating || !accountAddress || !toriiClient || !toriiComponents) return;
    let cancelled = false;

    const backfillOwnedStructures = async () => {
      if (isBackfillRunning.current) return;
      isBackfillRunning.current = true;

      let claimedStructureIds: number[] = [];
      try {
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
      }
    };

    void backfillOwnedStructures();
    const intervalId = setInterval(() => {
      void backfillOwnedStructures();
    }, PLAYER_STRUCTURE_BACKFILL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isSpectating, accountAddress, toriiClient, toriiComponents]);

  // Sync newly-seen structures into RECS (e.g. first settlement).
  useEffect(() => {
    if (isSpectating || !toriiClient || !toriiComponents || playerStructures.length === 0) return;
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
  }, [isSpectating, playerStructures, toriiClient, toriiComponents]);

  useEffect(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.cancel();
      subscriptionRef.current = null;
    }

    if (isSpectating || !accountAddress || !toriiClient) {
      return;
    }

    let cancelled = false;

    const subscribe = async () => {
      const structureClauses = structureEntityIds.map((id) => ({
        Keys: {
          keys: [id.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: PLAYER_STRUCTURE_MODELS,
        },
      }));

      const buildingClauses = structurePositions.map((pos) => ({
        Keys: {
          keys: [pos.col.toString(), pos.row.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: ["s1_eternum-Building"],
        },
      }));

      const ownerStructureClause = MemberClause("s1_eternum-Structure", "owner", "Eq", {
        type: "ContractAddress",
        value: padHexAddressTo66(accountAddress),
      }).build();

      const clause: Clause = {
        Composite: {
          operator: "Or",
          clauses: [...structureClauses, ...buildingClauses, ownerStructureClause],
        },
      };

      const subscription = await syncEntitiesDebounced(toriiClient, setup, clause, false);

      if (cancelled) {
        subscription.cancel();
        return;
      }

      subscriptionRef.current = subscription;
    };

    void subscribe();

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }
    };
  }, [isSpectating, structureEntityIds, structurePositions, accountAddress, toriiClient, setup]);
};
