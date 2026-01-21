import { ClauseBuilder, ToriiQueryBuilder, type SchemaType, type StandardizedQueryResult } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { addAddressPadding, BigNumberish } from "starknet";
import { MarketBuy } from "../../bindings";
import { useDojoSdk } from "../dojo/use-dojo-sdk";

export const useMarketActivity = (marketId: BigNumberish, refreshKey = 0) => {
  const { sdk } = useDojoSdk();

  const [marketBuys, setMarketBuys] = useState<MarketBuy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const query = useMemo(() => {
    return new ToriiQueryBuilder()
      .addEntityModel("pm-MarketBuy")
      .withClause(
        new ClauseBuilder()
          .where("pm-MarketBuy", "market_id", "Eq", addAddressPadding(`0x${BigInt(marketId).toString(16)}`))
          .build(),
      )
      .withLimit(1_000)
      .addOrderBy("timestamp", "Desc")
      .includeHashedKeys();
  }, [marketId]);

  useEffect(() => {
    const fetchActivity = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await sdk.getEventMessages({ query });

        const items: StandardizedQueryResult<SchemaType> = res.getItems();
        const parsedItems = items
          .flatMap((i) => {
            if (!i.models.pm.MarketBuy) return [];
            return [i.models.pm.MarketBuy as unknown as MarketBuy];
          })
          .map((i) => {
            return {
              ...i,
              timestamp: Number(i.timestamp) * 1_000,
            };
          });

        setMarketBuys(parsedItems);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load market activity"));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchActivity();
  }, [sdk, query, refreshKey]);

  return {
    marketBuys,
    isLoading,
    isError: !!error,
    error,
  };
};
