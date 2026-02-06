import { useEffect, useMemo, useRef } from "react";

import { getStructuresDataFromTorii } from "@/dojo/queries";
import { syncEntitiesDebounced } from "@/dojo/sync";
import { sqlApi } from "@/services/api";
import { padHexAddressTo66 } from "@/ui/utils/utils";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { MemberClause } from "@dojoengine/sdk";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { useAccountStore } from "../store/use-account-store";

// Models synced per-player via a scoped subscription (see usePlayerStructureSync)
const PLAYER_STRUCTURE_MODELS: string[] = [
  "s1_eternum-ProductionBoostBonus",
  "s1_eternum-Resource",
  "s1_eternum-ResourceArrival",
];

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

  const structureEntityIds = useMemo(() => playerStructures.map((s) => s.entityId), [playerStructures]);

  const structurePositions = useMemo(
    () => playerStructures.map((s) => ({ col: s.position.x, row: s.position.y })),
    [playerStructures],
  );

  const accountAddress = useAccountStore().account?.address;

  // PLAYER STRUCTURES (fetch player-owned structures into RECS so usePlayerStructures works)
  // Prefetch player-owned structures into RECS so usePlayerStructures works
  useEffect(() => {
    if (!accountAddress || !toriiClient || !contractComponents) return;
    let cancelled = false;
    (async () => {
      try {
        const structures = await sqlApi.fetchStructuresByOwner(accountAddress);
        if (cancelled || structures.length === 0) return;
        await getStructuresDataFromTorii(
          toriiClient,
          contractComponents as any,
          structures.map((s: any) => ({
            entityId: s.entity_id,
            position: { col: s.coord_x, row: s.coord_y },
          })),
        );
      } catch (error) {
        console.error("[usePlayerStructureSync] Failed to prefetch player structures", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountAddress, toriiClient, contractComponents]);

  // Sync newly-seen structures into RECS (e.g. first settlement).
  useEffect(() => {
    if (!toriiClient || !contractComponents || playerStructures.length === 0) return;

    const structuresToSync = playerStructures
      .filter((structure) => !syncedStructureIds.current.has(structure.entityId))
      .map((structure) => {
        syncedStructureIds.current.add(structure.entityId);
        return {
          entityId: structure.entityId,
          position: { col: structure.position.x, row: structure.position.y },
        };
      });

    if (structuresToSync.length === 0) return;

    void (async () => {
      try {
        await getStructuresDataFromTorii(toriiClient, contractComponents as any, structuresToSync);
      } catch (error) {
        console.error("[usePlayerStructureSync] Failed to sync newly seen structures", error);
      }
    })();
  }, [playerStructures, toriiClient, contractComponents]);

  useEffect(() => {
    const subscribe = async () => {
      // Cancel previous subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }

      if (!accountAddress || !toriiClient) return;

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

      subscriptionRef.current = await syncEntitiesDebounced(toriiClient, setup, clause, false);
    };

    subscribe();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }
    };
  }, [structureEntityIds, structurePositions, accountAddress, toriiClient, setup]);
};
