import {
  ClauseBuilder,
  HistoricalToriiQueryBuilder,
  type SchemaType,
  type StandardizedQueryResult,
} from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { addAddressPadding, hash, uint256, type BigNumberish } from "starknet";

import type { RegisteredToken, VaultDenominatorEvent, VaultNumeratorEvent } from "@/pm/bindings";
import type { MarketClass } from "@/pm/class";
import { getOutcomeColor } from "@/pm/constants/market-outcome-colors";
import { useControllers } from "@/pm/hooks/controllers/use-controllers";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { formatUnits, shortAddress } from "@/pm/utils";

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

const compactLabel = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.startsWith("0x")) {
    try {
      return shortAddress(trimmed);
    } catch {
      // fall through to generic truncation
    }
  }

  if (trimmed.length > 16) {
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }

  return trimmed;
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
            label: controller ? controller.username : compactLabel(outcomesText[idx]),
            color: getOutcomeColor(idx),
          },
        ];
      }),
    );
  }, [market.outcome_slot_count, outcomesText, findController, controllers]);

  // Pre-compute entity IDs for each outcome slot
  const numeratorsEntityIds = useMemo(
    () =>
      new Array(market.outcome_slot_count).fill(0).map((_i, idx) => {
        return getEntityIdFromKeys([BigInt(marketId_u256.low), BigInt(marketId_u256.high), BigInt(idx)]);
      }),
    [market.outcome_slot_count, marketId_u256],
  );

  // Pre-index numerators by entityId for O(1) lookup, sorted by timestamp for binary search
  const numeratorsByEntityId = useMemo(() => {
    const map = new Map<string, Array<(typeof vaultNumerators)[number]>>();

    for (const n of vaultNumerators) {
      // Use padded hex format to match getEntityIdFromKeys output
      const key = addAddressPadding(`0x${n.entityId.toString(16)}`);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }

    // Sort each group by timestamp ascending for efficient "find last <= timestamp" lookups
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    }

    return map;
  }, [vaultNumerators]);

  const chartData = useMemo(() => {
    // Binary search helper to find the last numerator with timestamp <= target
    const findLastLessThanOrEqual = (
      numerators: Array<(typeof vaultNumerators)[number]>,
      targetTimestamp: bigint,
    ): (typeof vaultNumerators)[number] | undefined => {
      if (numerators.length === 0) return undefined;

      let left = 0;
      let right = numerators.length - 1;
      let result: (typeof vaultNumerators)[number] | undefined = undefined;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midTimestamp = BigInt(numerators[mid].timestamp);

        if (midTimestamp <= targetTimestamp) {
          result = numerators[mid];
          left = mid + 1; // Look for a later one
        } else {
          right = mid - 1;
        }
      }

      return result;
    };

    return vaultDenominators.map((denominator) => {
      const denomRaw = toBigInt(denominator.value);
      const denom = formatUnits(denomRaw, Number(collateralToken.decimals || 0));
      const denomTimestamp = BigInt(denominator.timestamp);

      const entry: Record<string, any> = {
        date: Number(denominator.timestamp) * 1_000,
        tvl: denom,
      };

      for (let i = 0; i < numeratorsEntityIds.length; i++) {
        const entityId = numeratorsEntityIds[i];
        const numerators = numeratorsByEntityId.get(entityId) ?? [];

        // O(log n) binary search instead of O(n) findLast
        const numerator = findLastLessThanOrEqual(numerators, denomTimestamp);

        const numRaw = toBigInt(numerator?.value);
        entry[`p${i}`] = denomRaw === 0n ? 0 : Number((numRaw * 100n) / denomRaw);
      }

      return entry;
    });
  }, [vaultDenominators, numeratorsByEntityId, numeratorsEntityIds, collateralToken.decimals]);

  return {
    chartData,
    chartConfig,
  };
};
