import { divideByPrecision } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { Query } from "@dojoengine/torii-wasm";
import { useEffect, useState } from "react";

export interface Position {
  x: number;
  y: number;
}

export const useArmiesInRadius = (center: Position | null, radius = 40) => {
  const {
    network: { toriiClient },
  } = useDojo();
  const [armies, setArmies] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const queryArmies = async () => {
      if (!center) return;

      setIsLoading(true);
      setError(null);

      try {
        const query: Query = {
          limit: 100,
          offset: 0,
          entity_models: ["s1_eternum-ExplorerTroops"],
          dont_include_hashed_keys: false,
          entity_updated_after: 0,
          order_by: [],
          clause: AndComposeClause([
            MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Gte", center.x - radius),
            MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Lte", center.x + radius),
            MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Gte", center.y - radius),
            MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Lte", center.y + radius),
          ]).build(),
        };

        const results = await toriiClient.getEntities(query);
        const armies = Object.values(results).map((army) => {
          const count = divideByPrecision(
            // @ts-ignore
            Number(army["s1_eternum-ExplorerTroops"]["troops"]["value"]["count"]["value"]),
          );
          // @ts-ignore
          const troopType = army["s1_eternum-ExplorerTroops"]["troops"]["value"]["category"]["value"]["option"];
          // @ts-ignore
          const tier = army["s1_eternum-ExplorerTroops"]["troops"]["value"]["tier"]["value"]["option"];
          const id = army["s1_eternum-ExplorerTroops"]["explorer_id"]["value"];
          return { count, troopType, id, tier };
        });
        setArmies(armies);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch armies"));
      } finally {
        setIsLoading(false);
      }
    };

    queryArmies();

    // Refresh every 3 minutes
    const interval = setInterval(queryArmies, 180000);

    return () => clearInterval(interval);
  }, [toriiClient, center, radius]);

  return {
    armies,
    isLoading,
    error,
    count: armies ? Object.keys(armies).length : 0,
  };
};
