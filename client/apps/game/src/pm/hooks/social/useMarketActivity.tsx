import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { addAddressPadding, BigNumberish } from "starknet";
import { MarketBuy } from "../../bindings";
import { useDojoSdk } from "../dojo/useDojoSdk";

export const useMarketActivity = (marketId: BigNumberish) => {
  const { sdk } = useDojoSdk();

  const [marketBuys, setMarketBuys] = useState<MarketBuy[]>([]);

  // TODO: add subs

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

  const refresh = async () => {
    const res = await sdk.getEventMessages({ query });

    const items = res.getItems();
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
  };

  useEffect(() => {
    refresh();
  }, [query]);

  return {
    marketBuys,
    refresh,
  };
};
