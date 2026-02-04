import { useEffect, useMemo, useRef } from "react";

import { syncEntitiesDebounced } from "@/dojo/sync";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import type { PatternMatching } from "@dojoengine/torii-client";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useAccountStore } from "../store/use-account-store";
import { useUIStore } from "../store/use-ui-store";

// Models synced by structure entity ID
const ACTIVE_STRUCTURE_ENTITY_MODELS: string[] = [
  "s1_eternum-Structure",
  "s1_eternum-Resource",
  "s1_eternum-ResourceArrival",
  "s1_eternum-ProductionBoostBonus",
  "s1_eternum-StructureBuildings",
];

/**
 * Subscribes to live updates for the currently-viewed structure (structureEntityId).
 * Only activates for non-owned structures since usePlayerStructureSync already covers the player's own.
 * Cancels automatically when the active structure changes or when navigating away.
 */
export const useActiveStructureSync = () => {
  const {
    setup: {
      network: { toriiClient },
      components,
    },
    setup,
  } = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const worldMapReturnPosition = useUIStore((state) => state.worldMapReturnPosition);
  const accountAddress = useAccountStore().account?.address;
  const subscriptionRef = useRef<{ cancel: () => void } | null>(null);

  // Determine if the active structure is owned by the current player
  const isOwnStructure = useMemo(() => {
    if (!structureEntityId || !accountAddress || !components?.Structure) return false;
    try {
      const entityKey = getEntityIdFromKeys([BigInt(structureEntityId)]);
      const structure = getComponentValue(components.Structure as any, entityKey);
      if (!structure) return false;
      return BigInt(structure.owner) === BigInt(accountAddress);
    } catch {
      return false;
    }
  }, [structureEntityId, accountAddress, components]);
  // const isOwnStructure = false;

  console.log({ isOwnStructure, structureEntityId });

  useEffect(() => {
    // Only subscribe for non-owned structures; usePlayerStructureSync covers the player's own
    if (isOwnStructure || !structureEntityId || !toriiClient) return;

    const subscribe = async () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }

      // Entity ID clause for models keyed by structure entity ID
      const entityClause: Clause = {
        Keys: {
          keys: [structureEntityId.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: ACTIVE_STRUCTURE_ENTITY_MODELS,
        },
      };

      const clauses: Clause[] = [entityClause];

      // Building is keyed by (outer_col, outer_row, inner_col, inner_row) so we need a position-based clause
      if (worldMapReturnPosition) {
        clauses.push({
          Keys: {
            keys: [worldMapReturnPosition.col.toString(), worldMapReturnPosition.row.toString()],
            pattern_matching: "VariableLen" as PatternMatching,
            models: ["s1_eternum-Building"],
          },
        });
      }

      const clause: Clause =
        clauses.length === 1
          ? clauses[0]
          : {
              Composite: {
                operator: "Or",
                clauses,
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
  }, [structureEntityId, isOwnStructure, worldMapReturnPosition, accountAddress, toriiClient, setup]);
};
