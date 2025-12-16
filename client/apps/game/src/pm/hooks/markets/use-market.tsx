import { ClauseBuilder, ToriiQueryBuilder, type SchemaType, type StandardizedQueryResult } from "@dojoengine/sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addAddressPadding, uint256 } from "starknet";

import type {
  ConditionResolution,
  Market,
  MarketCreated,
  VaultDenominator,
  VaultFeesDenominator,
  VaultNumerator,
} from "../../bindings";
import { MarketClass } from "../../class";
import { useConfig } from "../../providers";
import { useDojoSdk } from "../dojo/use-dojo-sdk";

export interface UseMarketResult {
  market: MarketClass | undefined;
  refresh: () => Promise<void>;
  isLoading: boolean;
}

// TODO: need to use useModel and useEntityQuery
export const useMarket = (marketId: bigint): UseMarketResult => {
  const { sdk } = useDojoSdk();
  const { getRegisteredToken } = useConfig();

  const [market, setMarket] = useState<Market | undefined>();
  const [marketCreated, setMarketCreated] = useState<MarketCreated | undefined>();
  const [vaultDenominator, setVaultDenominator] = useState<VaultDenominator | undefined>();
  const [vaultFeesDenominator, setVaultFeesDenominator] = useState<VaultFeesDenominator | undefined>();
  const [vaultNumerators, setVaultNumerators] = useState<VaultNumerator[]>([]);
  const [conditionResolution, setConditionResolution] = useState<ConditionResolution | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const marketIdPadded = useMemo(() => addAddressPadding(`0x${marketId.toString(16)}`), [marketId]);

  const fetchMarketData = useCallback(async () => {
    if (marketId === 0n) return;

    setIsLoading(true);
    try {
      // Fetch market entity
      const marketQuery = new ToriiQueryBuilder()
        .withEntityModels(["pm-Market", "pm-VaultDenominator", "pm-VaultFeesDenominator"])
        .withClause(new ClauseBuilder().where("pm-Market", "market_id", "Eq", marketIdPadded).build())
        .includeHashedKeys();

      const marketResponse = await sdk.getEntities({ query: marketQuery });
      const marketItems: StandardizedQueryResult<SchemaType> = marketResponse.getItems();

      if (marketItems[0]) {
        const entity = marketItems[0];
        if (entity.models.pm?.Market) {
          setMarket(entity.models.pm.Market as Market);
        }
        if (entity.models.pm?.VaultDenominator) {
          setVaultDenominator(entity.models.pm.VaultDenominator as VaultDenominator);
        }
        if (entity.models.pm?.VaultFeesDenominator) {
          setVaultFeesDenominator(entity.models.pm.VaultFeesDenominator as VaultFeesDenominator);
        }
      }

      // Fetch vault numerators
      const vaultNumeratorQuery = new ToriiQueryBuilder()
        .withEntityModels(["pm-VaultNumerator"])
        .withClause(new ClauseBuilder().where("pm-VaultNumerator", "market_id", "Eq", marketIdPadded).build())
        .withLimit(100)
        .includeHashedKeys();

      const vaultNumeratorResponse = await sdk.getEntities({ query: vaultNumeratorQuery });
      const vaultNumeratorItems: StandardizedQueryResult<SchemaType> = vaultNumeratorResponse.getItems();

      const numerators = vaultNumeratorItems
        .flatMap((item) => (item.models.pm?.VaultNumerator ? [item.models.pm.VaultNumerator as VaultNumerator] : []))
        .sort((a, b) => Number(a.index) - Number(b.index));

      setVaultNumerators(numerators);

      // Fetch market created event
      const marketCreatedQuery = new ToriiQueryBuilder()
        .withEntityModels(["pm-MarketCreated"])
        .withClause(new ClauseBuilder().where("pm-MarketCreated", "market_id", "Eq", marketIdPadded).build())
        .withLimit(1)
        .includeHashedKeys();

      const marketCreatedResponse = await sdk.getEventMessages({ query: marketCreatedQuery });
      const marketCreatedItems: StandardizedQueryResult<SchemaType> = marketCreatedResponse.getItems();

      if (marketCreatedItems[0]?.models.pm?.MarketCreated) {
        setMarketCreated(marketCreatedItems[0].models.pm.MarketCreated as MarketCreated);
      }
    } catch (error) {
      console.error("[useMarket] Failed to fetch market data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sdk, marketId, marketIdPadded]);

  // Function to fetch condition resolution
  const fetchConditionResolution = useCallback(
    async (marketData: Market) => {
      try {
        const conditionId_u256 = uint256.bnToUint256(marketData.condition_id || 0);
        const questionId_u256 = uint256.bnToUint256(marketData.question_id || 0);

        const keys = [
          conditionId_u256.low.toString(),
          conditionId_u256.high.toString(),
          marketData.oracle?.toString() || "0",
          questionId_u256.low.toString(),
          questionId_u256.high.toString(),
        ];

        const query = new ToriiQueryBuilder()
          .withEntityModels(["pm-ConditionResolution"])
          .withClause(new ClauseBuilder().keys(["pm-ConditionResolution"], keys, "FixedLen").build())
          .withLimit(1)
          .includeHashedKeys();

        const response = await sdk.getEventMessages({ query });
        const items: StandardizedQueryResult<SchemaType> = response.getItems();

        if (items[0]?.models.pm?.ConditionResolution) {
          setConditionResolution(items[0].models.pm.ConditionResolution as ConditionResolution);
        }
      } catch (error) {
        console.error("[useMarket] Failed to fetch condition resolution:", error);
      }
    },
    [sdk],
  );

  // Fetch condition resolution when market is loaded
  useEffect(() => {
    if (!market) return;
    fetchConditionResolution(market);
  }, [market, fetchConditionResolution]);

  // Initial fetch
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Combined refresh function that fetches all data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchMarketData();
      // Fetch condition resolution with the latest market data
      if (market) {
        await fetchConditionResolution(market);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchMarketData, fetchConditionResolution, market]);

  const marketMemo = useMemo(() => {
    if (!market || !marketCreated) return undefined;

    const collateralToken = getRegisteredToken(market.collateral_token);

    return new MarketClass({
      market,
      marketCreated,
      collateralToken,
      vaultDenominator,
      vaultNumerators,
      conditionResolution,
      vaultFeesDenominator,
    });
  }, [
    market,
    marketCreated,
    vaultDenominator,
    vaultFeesDenominator,
    vaultNumerators,
    conditionResolution,
    getRegisteredToken,
  ]);

  return { market: marketMemo, refresh, isLoading };
};
