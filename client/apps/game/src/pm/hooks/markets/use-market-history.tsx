import { ClauseBuilder, HistoricalToriiQueryBuilder, type SchemaType, type StandardizedQueryResult } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { addAddressPadding, hash, uint256, type BigNumberish } from "starknet";

import type { RegisteredToken, VaultDenominatorEvent, VaultNumeratorEvent } from "@/pm/bindings";
import type { MarketClass } from "@/pm/class";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { useControllers } from "@/pm/hooks/controllers/use-controllers";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { formatUnits } from "@/pm/utils";

const toBigInt = (value: BigNumberish | undefined) => {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "string" && value.startsWith("0x")) return BigInt(value);
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
};

const getEntityIdFromKeys = (keys: bigint[]) => {
  const poseidon = hash.computePoseidonHashOnElements(keys);
  return addAddressPadding(BigInt(poseidon));
};

export const useMarketHistory = (market: MarketClass, refreshKey = 0) => {
  const { sdk } = useDojoSdk();
  const { findController, controllers } = useControllers();

  const outcomesText = useMemo(() => market.getMarketTextOutcomes(), [market]);
  const collateralToken = market.collateralToken as RegisteredToken;
  const marketId_u256 = useMemo(() => uint256.bnToUint256(BigInt(market.market_id)), [market.market_id]);

  const [vaultNumerators, setVaultNumerators] = useState<Array<VaultNumeratorEvent & { entityId: bigint }>>([]);
  const [vaultDenominators, setVaultDenominators] = useState<VaultDenominatorEvent[]>([]);

  const query = useMemo(() => {
    return new HistoricalToriiQueryBuilder()
      .addEntityModel("pm-VaultNumeratorEvent")
      .addEntityModel("pm-VaultDenominatorEvent")
      .withClause(
        new ClauseBuilder()
          .keys(
            ["pm-VaultNumeratorEvent", "pm-VaultDenominatorEvent"],
            [marketId_u256.low.toString(), marketId_u256.high.toString()],
            "VariableLen",
          )
          .build(),
      )
      .withLimit(10_000)
      .includeHashedKeys();
  }, [marketId_u256]);

  useEffect(() => {
    const initAsync = async () => {
      const res = await sdk.getEventMessages({ query });
      const items: StandardizedQueryResult<SchemaType> = res.getItems();

      const denominators = items
        .flatMap((i) => {
          if (i.models.pm.VaultDenominatorEvent) {
            return [i.models.pm.VaultDenominatorEvent as VaultDenominatorEvent];
          }
          return [];
        })
        .filter((event, idx, arr) => arr.findLastIndex((item) => item.timestamp === event.timestamp) === idx)
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

      const numerators = items.flatMap((i) => {
        if (i.models.pm.VaultNumeratorEvent) {
          return [
            {
              ...(i.models.pm.VaultNumeratorEvent as VaultNumeratorEvent),
              entityId: BigInt(i.entityId),
            },
          ];
        }
        return [];
      });

      setVaultDenominators(denominators);
      setVaultNumerators(numerators);
    };

    void initAsync();
  }, [query, sdk, refreshKey]);

  const chartConfig = useMemo(() => {
    return Object.fromEntries(
      new Array(market.outcome_slot_count).fill(0).map((_i, idx) => {
        const controller = findController(outcomesText[idx]);

        return [
          `p${idx}`,
          {
            label: controller ? controller.username : outcomesText[idx],
            color: getOutcomeColor(idx),
          },
        ];
      }),
    );
  }, [market.outcome_slot_count, outcomesText, findController, controllers]);

  const chartData = useMemo(() => {
    const numeratorsEntityIds = new Array(market.outcome_slot_count).fill(0).map((_i, idx) => {
      return getEntityIdFromKeys([BigInt(marketId_u256.low), BigInt(marketId_u256.high), BigInt(idx)]);
    });

    return vaultDenominators.map((denominator) => {
      const denomRaw = toBigInt(denominator.value);
      const denom = formatUnits(denomRaw, Number(collateralToken.decimals || 0));

      const entry: Record<string, any> = {
        date: Number(denominator.timestamp) * 1_000,
        tvl: denom,
      };

      for (let i = 0; i < numeratorsEntityIds.length; i++) {
        const numeratorEntityId = numeratorsEntityIds[i];

        const numerator = vaultNumerators.findLast(
          (item) =>
            BigInt(item.entityId) === BigInt(numeratorEntityId) &&
            BigInt(item.timestamp) <= BigInt(denominator.timestamp),
        );

        const numRaw = toBigInt(numerator?.value);
        entry[`p${i}`] = denomRaw === 0n ? 0 : Number((numRaw * 100n) / denomRaw);
      }

      return entry;
    });
  }, [vaultDenominators, vaultNumerators, market.outcome_slot_count, marketId_u256, collateralToken.decimals]);

  return {
    chartData,
    chartConfig,
  };
};
