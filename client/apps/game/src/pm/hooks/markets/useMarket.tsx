import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useEntityId, useEntityQuery, useModel, useModels } from "@dojoengine/sdk/react";
import { useEffect, useMemo, useState } from "react";
import { uint256 } from "starknet";

import type {
  ConditionResolution,
  Market,
  MarketCreated,
  VaultDenominator,
  VaultFeesDenominator,
  VaultNumerator,
} from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useConfig } from "@/pm/providers";
import { deepEqual } from "@/pm/utils";
import { useDojoSdk } from "../dojo/useDojoSdk";

export const useMarket = (marketId: bigint) => {
  const { sdk } = useDojoSdk();
  const { getRegisteredToken } = useConfig();
  const marketId_u256 = uint256.bnToUint256(marketId);
  const entityId = useEntityId(marketId_u256.low, marketId_u256.high);

  useEntityQuery(
    new ToriiQueryBuilder()
      .withEntityModels(["pm-Market"])
      .withClause(
        new ClauseBuilder()
          .keys(["pm-Market"], [marketId_u256.low.toString(), marketId_u256.high.toString()], "FixedLen")
          .build(),
      )
      .includeHashedKeys(),
  );

  useEntityQuery(
    new ToriiQueryBuilder()
      .withEntityModels(["pm-VaultDenominator", "pm-VaultFeesDenominator"])
      .withClause(
        new ClauseBuilder()
          .keys(["pm-VaultDenominator"], [marketId_u256.low.toString(), marketId_u256.high.toString()], "FixedLen")
          .build(),
      )
      .includeHashedKeys(),
  );

  useEntityQuery(
    new ToriiQueryBuilder()
      .withEntityModels(["pm-VaultNumerator"])
      .withClause(
        new ClauseBuilder()
          .keys(["pm-VaultNumerator"], [marketId_u256.low.toString(), marketId_u256.high.toString()], "VariableLen")
          .build(),
      )
      .includeHashedKeys(),
  );

  const market = useModel(entityId, "pm-Market") as Market;

  const vaultDenominator = useModel(entityId, "pm-VaultDenominator") as VaultDenominator;

  const vaultFeesDenominator = useModel(entityId, "pm-VaultFeesDenominator") as VaultFeesDenominator;

  const marketCreatedQuery = new ToriiQueryBuilder()
    .withEntityModels(["pm-MarketCreated"])
    .withClause(
      new ClauseBuilder()
        .keys(["pm-MarketCreated"], [marketId_u256.low.toString(), marketId_u256.high.toString()], "VariableLen")
        .build(),
    )
    .withLimit(10_000)
    .includeHashedKeys();

  const [marketCreated, setMarketCreated] = useState<MarketCreated | undefined>();

  useEffect(() => {
    const initAsync = async () => {
      const entities = (await sdk.getEventMessages({ query: marketCreatedQuery })).getItems();

      if (entities[0]) {
        setMarketCreated(entities[0].models.pm.MarketCreated as MarketCreated);
      }
    };
    initAsync();
  }, [marketId, market, marketCreatedQuery, sdk]);

  const conditionResolutionQuery = useMemo(() => {
    const conditionId_u256 = uint256.bnToUint256(market?.condition_id || 0);
    const questionId_u256 = uint256.bnToUint256(market?.question_id || 0);

    const keys = [
      conditionId_u256.low.toString(),
      conditionId_u256.high.toString(),
      market?.oracle?.toString() || "0",
      questionId_u256.low.toString(),
      questionId_u256.high.toString(),
    ];

    const query = new ToriiQueryBuilder()
      .withEntityModels(["pm-ConditionResolution"])
      .withClause(new ClauseBuilder().keys(["pm-ConditionResolution"], keys, "FixedLen").build())
      .withLimit(10_000)
      .includeHashedKeys();

    return query;
  }, [market]);

  const [conditionResolution, setConditionResolution] = useState<ConditionResolution | undefined>();

  useEffect(() => {
    const initAsync = async () => {
      const entities = (await sdk.getEventMessages({ query: conditionResolutionQuery })).getItems();

      if (entities[0]) {
        setConditionResolution(entities[0].models.pm.ConditionResolution as ConditionResolution);
      }
    };
    initAsync();
  }, [marketId, conditionResolutionQuery, sdk]);

  const [vaultNumerators, setVaultNumerators] = useState<VaultNumerator[]>([]);
  const rawVaultNumerators = useModels("pm-VaultNumerator");
  useEffect(() => {
    if (!market || !rawVaultNumerators) return;

    const newVaultNumerators = Object.keys(rawVaultNumerators).flatMap((key) => {
      return Object.values(rawVaultNumerators[key] as VaultNumerator[]);
    });

    const numerators = newVaultNumerators
      .filter((i) => BigInt(i.market_id) === BigInt(market.market_id))
      .sort((a, b) => Number(a.index) - Number(b.index));

    if (!deepEqual(vaultNumerators, numerators)) {
      setVaultNumerators(numerators);
    }
  }, [rawVaultNumerators, market]);

  const marketMemo = useMemo(() => {
    if (!market || !marketCreated) return undefined;

    const collateralToken = getRegisteredToken(market.collateral_token);

    const value = new MarketClass({
      market,
      marketCreated,
      collateralToken,
      vaultDenominator,
      vaultNumerators,
      conditionResolution,
      vaultFeesDenominator,
    });

    return value;
  }, [
    market,
    marketCreated,
    vaultDenominator,
    vaultFeesDenominator,
    vaultNumerators,
    conditionResolution,
    getRegisteredToken,
  ]);

  return marketMemo;
};
