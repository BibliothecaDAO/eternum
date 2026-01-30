import { useEffect, useMemo, useRef } from "react";

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

  useEffect(() => {
    const subscribe = async () => {
      // Cancel previous subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }

      if (structureEntityIds.length === 0) return;

      const clause: Clause = {
        Composite: {
          operator: "Or",
          clauses: structureEntityIds.map((id) => ({
            Keys: {
              keys: [id.toString()],
              pattern_matching: "FixedLen" as PatternMatching,
              models: PLAYER_STRUCTURE_MODELS,
            },
          })),
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
  }, [structureEntityIds, toriiClient, setup]);
};
