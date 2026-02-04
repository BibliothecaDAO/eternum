import { useEffect, useMemo, useRef } from "react";

import { debouncedGetBuildingsFromTorii } from "@/dojo/debounced-queries";
import { getStructuresDataFromTorii } from "@/dojo/queries";
import { PLAYER_STRUCTURE_MODELS, syncEntitiesDebounced } from "@/dojo/sync";
import { sqlApi } from "@/services/api";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { useAccountStore } from "../store/use-account-store";

export const usePlayerStructureSync = () => {
  const {
    setup: {
      network: { toriiClient, contractComponents },
    },
    setup,
  } = useDojo();

  const playerStructures = usePlayerStructures();
  const subscriptionRef = useRef<{ cancel: () => void } | null>(null);

  const structureEntityIds = useMemo(() => playerStructures.map((s) => s.entityId), [playerStructures]);

  const structurePositions = useMemo(
    () => playerStructures.map((s) => ({ col: s.position.x, row: s.position.y })),
    [playerStructures],
  );

  const accountAddress = useAccountStore().account?.address;

  // PLAYER STRUCTURES (fetch player-owned structures into RECS so usePlayerStructures works)
  useEffect(() => {
    // Replace with your actual definitions or props if needed
    if (!accountAddress) return;
    let cancelled = false;
    (async () => {
      const structures = await sqlApi.fetchStructuresByOwner(accountAddress);
      console.log({ structures });
      if (structures.length > 0 && !cancelled) {
        await getStructuresDataFromTorii(
          toriiClient,
          contractComponents as any,
          structures.map((s: any) => ({
            entityId: s.entity_id,
            position: { col: s.coord_x, row: s.coord_y },
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountAddress, toriiClient, contractComponents]);

  // Initial fetch of buildings for player structures
  useEffect(() => {
    if (structurePositions.length === 0) return;
    debouncedGetBuildingsFromTorii(toriiClient, setup.network.contractComponents as any, structurePositions);
  }, [structurePositions, toriiClient, setup.network.contractComponents]);

  useEffect(() => {
    const subscribe = async () => {
      // Cancel previous subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }

      if (structureEntityIds.length === 0) return;

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

      const clause: Clause = {
        Composite: {
          operator: "Or",
          clauses: [...structureClauses, ...buildingClauses],
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
  }, [structureEntityIds, structurePositions, toriiClient, setup]);
};
