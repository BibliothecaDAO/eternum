import { getStructuresDataFromTorii } from "@/app/dojo/queries";
import { fetchStructuresByOwner } from "@/app/services/api";
import { useDojo } from "@bibliothecadao/react";
import { useCallback, useEffect, useRef, useState } from "react";

export const useSyncPlayerStructures = () => {
  const { setup, account } = useDojo();

  // track structures that have been synced
  const syncedStructures = useRef<Set<string>>(new Set());

  // fetch structures from torii using sql
  const [fetchedStructures, setFetchedStructures] = useState<
    { entityId: number; position: { col: number; row: number } }[]
  >([]);

  useEffect(() => {
    const fetchStructures = () => {
      fetchStructuresByOwner(account.account.address).then((structures) => {
        setFetchedStructures(
          structures.map((s) => ({
            entityId: s.entity_id,
            position: { col: s["base.coord_x"], row: s["base.coord_y"] },
          })),
        );
      });
    };

    // Initial fetch
    fetchStructures();

    // Set up interval to fetch every 10 seconds
    const intervalId = setInterval(fetchStructures, 10000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [account.account.address]);

  // Consolidated subscription logic into a single function
  const syncStructures = useCallback(
    async ({ structures }: { structures: { entityId: number; position: { col: number; row: number } }[] }) => {
      if (!structures.length) return;

      try {
        const start = performance.now();
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
      }
    },
    [setup.network.toriiClient, setup.network.contractComponents],
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
};
