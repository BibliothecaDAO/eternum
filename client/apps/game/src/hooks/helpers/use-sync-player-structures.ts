import { getStructuresDataFromTorii } from "@/dojo/queries";
import { syncEntitiesDebounced } from "@/dojo/sync";
import { POLLING_INTERVALS } from "@/config/polling";
import { sqlApi } from "@/services/api";
import { useDojo } from "@bibliothecadao/react";
import type { Clause, LogicalOperator } from "@dojoengine/torii-wasm/types";
import type { PatternMatching } from "@dojoengine/torii-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUIStore } from "../store/use-ui-store";
import { LoadingStateKey } from "../store/use-world-loading";

type StructureLocation = { entityId: number; position: { col: number; row: number } };

const PLAYER_STRUCTURE_MODELS: string[] = ["s1_eternum-Structure", "s1_eternum-Resource"];

const normalizeStructures = (structures: StructureLocation[]): StructureLocation[] =>
  [...structures].sort((a, b) => a.entityId - b.entityId);

const structuresAreEqual = (a: StructureLocation[], b: StructureLocation[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    const aStruct = a[i];
    const bStruct = b[i];
    if (
      aStruct.entityId !== bStruct.entityId ||
      aStruct.position.col !== bStruct.position.col ||
      aStruct.position.row !== bStruct.position.row
    ) {
      return false;
    }
  }

  return true;
};

const buildPlayerStructureClause = (structures: StructureLocation[]): Clause | null => {
  if (structures.length === 0) {
    return null;
  }

  const uniqueIds = Array.from(new Set(structures.map((structure) => structure.entityId)));

  return {
    Composite: {
      operator: "Or" as LogicalOperator,
      clauses: uniqueIds.map((entityId) => ({
        Keys: {
          keys: [entityId.toString()],
          pattern_matching: "VariableLen" as PatternMatching,
          models: PLAYER_STRUCTURE_MODELS,
        },
      })),
    },
  };
};

export const useSyncPlayerStructures = () => {
  const { setup, account } = useDojo();

  // track structures that have been synced
  const syncedStructures = useRef<Set<string>>(new Set());

  // fetch structures from torii using sql
  const [fetchedStructures, setFetchedStructures] = useState<StructureLocation[]>([]);
  const setLoading = useUIStore((state) => state.setLoading);
  const playerStructureSubscriptionRef = useRef<{ cancel: () => void } | null>(null);
  const streamRequestIdRef = useRef(0);

  useEffect(() => {
    if (!account.account?.address || account.account.address === "0x0") {
      setFetchedStructures([]);
      syncedStructures.current.clear();
      return;
    }

    const fetchStructures = () => {
      sqlApi.fetchStructuresByOwner(account.account.address).then((structures) => {
        const normalized = normalizeStructures(
          structures.map((s) => ({
            entityId: s.entity_id,
            position: { col: s.coord_x, row: s.coord_y },
          })),
        );

        setFetchedStructures((prev) => {
          if (structuresAreEqual(prev, normalized)) {
            return prev;
          }
          return normalized;
        });
      });
    };

    // Initial fetch
    fetchStructures();

    // Set up interval to fetch periodically (configurable)
    const intervalId = setInterval(fetchStructures, POLLING_INTERVALS.playerStructuresMs);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [account.account?.address]);

  useEffect(() => {
    return () => {
      playerStructureSubscriptionRef.current?.cancel();
      playerStructureSubscriptionRef.current = null;
    };
  }, []);

  // Consolidated subscription logic into a single function
  const syncStructures = useCallback(
    async ({ structures }: { structures: StructureLocation[] }) => {
      if (!structures.length) return;

      try {
        const start = performance.now();
        setLoading(LoadingStateKey.AllPlayerStructures, true);
        await getStructuresDataFromTorii(
          setup.network.toriiClient,
          setup.network.contractComponents as any,
          structures,
        );
        const end = performance.now();

        console.log(
          `[sync] structures query structures ${structures.map((s) => `${s.entityId}(${s.position.col},${s.position.row})`)}`,
          end - start,
        );
      } catch (error) {
        console.error("Failed to sync structures:", error);
      } finally {
        setLoading(LoadingStateKey.AllPlayerStructures, false);
      }
    },
    [setup.network.toriiClient, setup.network.contractComponents],
  );

  const syncPlayerStructureStream = useCallback(
    async (structures: StructureLocation[]) => {
      streamRequestIdRef.current += 1;
      const requestId = streamRequestIdRef.current;

      playerStructureSubscriptionRef.current?.cancel();
      playerStructureSubscriptionRef.current = null;

      const clause = buildPlayerStructureClause(structures);
      if (!clause) {
        return;
      }

      try {
        const subscription = await syncEntitiesDebounced(setup.network.toriiClient, setup, clause, false);

        if (streamRequestIdRef.current !== requestId) {
          subscription.cancel();
          return;
        }

        playerStructureSubscriptionRef.current = subscription;
      } catch (error) {
        console.error("Failed to subscribe to player structure updates:", error);
      }
    },
    [setup],
  );

  // Function to update the synced structures ref
  const setSyncedStructures = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    syncedStructures.current = updater(syncedStructures.current);
  }, []);

  // Handle structure synchronization
  useEffect(() => {
    if (!account.account) return;

    const syncUnsyncedStructures = async () => {
      try {
        // Find structures that haven't been synced yet
        const unsyncedStructures = fetchedStructures.filter(
          (s) => !syncedStructures.current.has(s.entityId.toString()),
        );

        if (unsyncedStructures.length === 0) return;

        // Mark all these structures as synced
        if (unsyncedStructures.length > 0) {
          setSyncedStructures((prev) => {
            const newSet = new Set(prev);
            unsyncedStructures.forEach((s) => newSet.add(s.entityId.toString()));
            return newSet;
          });

          // Sync the structures with the network
          await syncStructures({ structures: unsyncedStructures });
        }
      } catch (error) {
        console.error("Failed to sync structures:", error);
      }
    };

    syncUnsyncedStructures();
  }, [account.account, fetchedStructures, syncStructures, setSyncedStructures]);

  useEffect(() => {
    const hasAccount = Boolean(account.account?.address && account.account.address !== "0x0");
    if (!setup.network?.toriiClient || !hasAccount) {
      playerStructureSubscriptionRef.current?.cancel();
      playerStructureSubscriptionRef.current = null;
      return;
    }

    syncPlayerStructureStream(fetchedStructures);
  }, [account.account?.address, fetchedStructures, setup.network?.toriiClient, syncPlayerStructureStream]);
};
