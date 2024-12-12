import { addToSubscription } from "@/dojo/queries";
import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../context/DojoContext";
import { useEntities } from "./useEntities";

export const useSyncEntity = (entityIds: number | number[]) => {
  const dojo = useDojo();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsSyncing(true);
    const fetch = async () => {
      try {
        const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
        await Promise.all(
          ids.map((id) =>
            addToSubscription(dojo.network.toriiClient, dojo.network.contractComponents as any, id.toString()),
          ),
        );
      } catch (error) {
        console.error("Fetch failed", error);
      } finally {
        setIsSyncing(false);
      }
    };
    fetch();
  }, [entityIds]);

  return isSyncing;
};

export const useSyncPlayerRealms = () => {
  const { playerRealms } = useEntities();
  const realmEntityIds = useMemo(() => {
    return playerRealms.map((realm) => realm!.entity_id);
  }, [playerRealms]);

  return useSyncEntity(realmEntityIds);
};
