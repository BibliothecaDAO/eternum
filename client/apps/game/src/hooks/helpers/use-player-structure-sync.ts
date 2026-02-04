import { useEffect, useMemo, useRef } from "react";

import { debouncedGetBuildingsFromTorii } from "@/dojo/debounced-queries";
import { PLAYER_STRUCTURE_MODELS, syncEntitiesDebounced } from "@/dojo/sync";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";

export const usePlayerStructureSync = () => {
  const {
    setup: {
      network: { toriiClient },
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
