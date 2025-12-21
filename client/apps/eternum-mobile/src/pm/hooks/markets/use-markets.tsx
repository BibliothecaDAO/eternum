import { ClauseBuilder, ToriiQueryBuilder, type SchemaType, type StandardizedQueryResult } from "@dojoengine/sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { uint256 } from "starknet";

import { ConditionResolution, Market, MarketCreated, VaultDenominator, VaultNumerator } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { useConfig } from "@/pm/providers";
import { deepEqual, replaceAndFormat } from "@/pm/utils";

export interface MarketFiltersParams {
  status: MarketStatusFilter;
  type: MarketTypeFilter;
  oracle: string;
}

export enum MarketStatusFilter {
  All = "All",
  Open = "Open",
  Resolvable = "Resolvable",
  Resolved = "Resolved",
}

export enum MarketTypeFilter {
  All = "All",
  Binary = "Binary",
  Categorical = "Categorical",
}

export const useMarkets = ({ marketFilters }: { marketFilters: MarketFiltersParams }) => {
  const { sdk } = useDojoSdk();
  const { registeredOracles, registeredTokens, getRegisteredToken } = useConfig();
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [rawMarkets, setRawMarkets] = useState<Market[]>([]);
  const [vaultDenominators, setVaultDenominators] = useState<VaultDenominator[]>([]);
  const [allVaultNumerators, setAllVaultNumerators] = useState<VaultNumerator[]>([]);
  const [marketEvents, setMarketEvents] = useState<MarketCreated[]>([]);
  const [conditionResolutions, setConditionResolutions] = useState<ConditionResolution[]>([]);
  const [markets, setMarkets] = useState<MarketClass[]>([]);

  const now = BigInt(Math.ceil(Date.now() / 1_000));

  const statusClause = useMemo(() => {
    switch (marketFilters.status) {
      case MarketStatusFilter.All:
        return new ClauseBuilder().where("pm-Market", "start_at", "Lt", {
          type: "U64",
          value: now,
        });

      case MarketStatusFilter.Open:
        return new ClauseBuilder().compose().and([
          new ClauseBuilder().where("pm-Market", "start_at", "Lt", {
            type: "U64",
            value: now,
          }),
          new ClauseBuilder().where("pm-Market", "resolve_at", "Gt", {
            type: "U64",
            value: now,
          }),
        ]);

      case MarketStatusFilter.Resolvable:
        return new ClauseBuilder().compose().and([
          new ClauseBuilder().where("pm-Market", "resolve_at", "Lt", {
            type: "U64",
            value: now,
          }),
          new ClauseBuilder().where("pm-Market", "resolved_at", "Eq", {
            type: "U64",
            value: 0,
          }),
        ]);

      case MarketStatusFilter.Resolved:
        return new ClauseBuilder().where("pm-Market", "resolved_at", "Gt", {
          type: "U64",
          value: 0,
        });
    }
  }, [marketFilters.status]);

  const oracleClause = useMemo(() => {
    if (marketFilters.oracle === "All") {
      return undefined;
    } else {
      return new ClauseBuilder().where("pm-Market", "oracle", "Eq", marketFilters.oracle);
    }
  }, [marketFilters.oracle]);

  const marketsQuery = useMemo(() => {
    const clauses = [];

    if (statusClause) {
      clauses.push(statusClause);
    }
    if (oracleClause) {
      clauses.push(oracleClause);
    }

    const query = new ToriiQueryBuilder()
      .withEntityModels(["pm-Market", "pm-VaultDenominator"])
      .withClause(new ClauseBuilder().compose().and(clauses).build())
      .includeHashedKeys();

    return query;
  }, [statusClause, oracleClause]);

  const allVaultNumeratorsQuery = useMemo(() => {
    return new ToriiQueryBuilder()
      .withEntityModels(["pm-VaultNumerator"])
      .withClause(new ClauseBuilder().keys(["pm-VaultNumerator"], [undefined], "VariableLen").build())
      .includeHashedKeys();
  }, []);

  const marketEventsQuery = useMemo(() => {
    return new ToriiQueryBuilder()
      .withEntityModels(["pm-MarketCreated"])
      .withClause(new ClauseBuilder().keys(["pm-MarketCreated"], [undefined], "VariableLen").build())
      .includeHashedKeys();
  }, []);

  const conditionResolutionsQuery = useMemo(() => {
    if (!rawMarkets.length) {
      return undefined;
    }

    const clauses = rawMarkets.map((market) => {
      const conditionId_u256 = uint256.bnToUint256(market.condition_id);
      const questionId_u256 = uint256.bnToUint256(market.question_id);

      return new ClauseBuilder().keys(
        ["pm-ConditionResolution"],
        [
          conditionId_u256.low.toString(),
          conditionId_u256.high.toString(),
          market.oracle.toString(),
          questionId_u256.low.toString(),
          questionId_u256.high.toString(),
        ],
        "FixedLen",
      );
    });

    return new ToriiQueryBuilder()
      .withEntityModels(["pm-ConditionResolution"])
      .withClause(new ClauseBuilder().compose().or(clauses).build())
      .withLimit(10_000)
      .includeHashedKeys();
  }, [rawMarkets]);

  const refresh = useCallback(() => setRefreshNonce((prev) => prev + 1), []);

  useEffect(() => {
    const initAsync = async () => {
      const entitiesResponse = await sdk.getEntities({ query: marketsQuery });
      const entities: StandardizedQueryResult<SchemaType> = entitiesResponse.getItems();

      const markets = entities.flatMap((i) => {
        const item = i.models.pm.Market as Market;
        return item ? [item] : [];
      });

      const vaultDenominators = entities.flatMap((i) => {
        const item = i.models.pm.VaultDenominator as VaultDenominator;
        return item ? [item] : [];
      });

      setRawMarkets(markets);
      setVaultDenominators(vaultDenominators);
    };

    initAsync();
  }, [marketsQuery, refreshNonce, sdk]);

  useEffect(() => {
    const initAsync = async () => {
      const entitiesResponse = await sdk.getEntities({ query: allVaultNumeratorsQuery });
      const entities: StandardizedQueryResult<SchemaType> = entitiesResponse.getItems();

      const vaultNumerators = entities.flatMap((i) => {
        const item = i.models.pm.VaultNumerator as VaultNumerator;
        return item ? [item] : [];
      });

      setAllVaultNumerators(vaultNumerators);
    };

    initAsync();
  }, [allVaultNumeratorsQuery, refreshNonce, sdk]);

  useEffect(() => {
    const fetchMarketEvents = async () => {
      try {
        const entitiesResponse = await sdk.getEventMessages({ query: marketEventsQuery });
        const entities: StandardizedQueryResult<SchemaType> = entitiesResponse.getItems();

        const events = entities.flatMap((i) => {
          const item = i.models.pm.MarketCreated as MarketCreated;
          return item ? [item] : [];
        });

        setMarketEvents(events);
      } catch (error) {
        console.error("[pm-sdk] Failed to fetch market events", error);
      }
    };

    void fetchMarketEvents();
  }, [sdk, marketEventsQuery, refreshNonce]);

  useEffect(() => {
    if (!conditionResolutionsQuery) {
      setConditionResolutions([]);
      return;
    }

    const fetchConditionResolutions = async () => {
      try {
        const entitiesResponse = await sdk.getEventMessages({ query: conditionResolutionsQuery });
        const entities: StandardizedQueryResult<SchemaType> = entitiesResponse.getItems();

        const resolutions = entities.flatMap((i) => {
          const item = i.models.pm.ConditionResolution as ConditionResolution;
          return item ? [item] : [];
        });

        setConditionResolutions(resolutions);
      } catch (error) {
        console.error("[pm-sdk] Failed to fetch condition resolutions", error);
      }
    };

    void fetchConditionResolutions();
  }, [conditionResolutionsQuery, sdk, refreshNonce]);

  // Build lookup maps for O(1) access instead of O(n) finds
  // Use string keys since market_id is BigNumberish
  const marketEventsByIdMap = useMemo(() => {
    const map = new Map<string, (typeof marketEvents)[number]>();
    for (const event of marketEvents) {
      map.set(String(event.market_id), {
        ...event,
        title: replaceAndFormat(event.title ?? ""),
        terms: replaceAndFormat(event.terms ?? ""),
      });
    }
    return map;
  }, [marketEvents]);

  const vaultDenominatorByMarketIdMap = useMemo(
    () => new Map(vaultDenominators.map((d) => [String(d.market_id), d])),
    [vaultDenominators],
  );

  const vaultNumeratorsByMarketIdMap = useMemo(() => {
    const map = new Map<string, VaultNumerator[]>();
    for (const n of allVaultNumerators) {
      const key = String(n.market_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    // Sort each group by index
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(a.index) - Number(b.index));
    }
    return map;
  }, [allVaultNumerators]);

  const conditionResolutionByKeyMap = useMemo(() => {
    const map = new Map<string, (typeof conditionResolutions)[number]>();
    for (const r of conditionResolutions) {
      // Create a composite key for condition resolution lookup
      const key = `${r.condition_id}-${r.question_id}-${r.oracle}`;
      map.set(key, r);
    }
    return map;
  }, [conditionResolutions]);

  useEffect(() => {
    if (!registeredOracles || registeredOracles.length === 0) return;
    if (!registeredTokens || registeredTokens.length === 0) return;

    if (!rawMarkets) return;

    const parsedMarkets = rawMarkets
      .filter((market: Market) => {
        switch (marketFilters.type) {
          case MarketTypeFilter.All:
            return true;
          case MarketTypeFilter.Binary:
            return market.typ?.variant?.["Binary"];
          case MarketTypeFilter.Categorical:
            return market.typ?.variant?.["Categorical"];
          default:
            return false;
        }
      })
      .flatMap((market: Market) => {
        // O(1) lookups instead of O(n) finds - use String keys
        const marketIdKey = String(market.market_id);
        const marketCreated = marketEventsByIdMap.get(marketIdKey);
        const vaultDenominator = vaultDenominatorByMarketIdMap.get(marketIdKey);
        const vaultNumerators = vaultNumeratorsByMarketIdMap.get(marketIdKey) ?? [];

        // Composite key lookup for condition resolution
        const conditionKey = `${market.condition_id}-${market.question_id}-${market.oracle}`;
        const conditionResolution = conditionResolutionByKeyMap.get(conditionKey);

        if (!market || !marketCreated) return [];
        const collateralToken = getRegisteredToken(market.collateral_token);

        const value = new MarketClass({
          market,
          marketCreated,
          collateralToken,
          vaultDenominator,
          vaultNumerators,
          conditionResolution,
        });

        return [value];
      });

    if (!deepEqual(markets, parsedMarkets)) {
      setMarkets(parsedMarkets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rawMarkets,
    registeredOracles,
    registeredTokens,
    marketEventsByIdMap,
    vaultDenominatorByMarketIdMap,
    vaultNumeratorsByMarketIdMap,
    conditionResolutionByKeyMap,
    marketFilters.type,
    getRegisteredToken,
  ]);

  return {
    markets,
    refresh,
  };
};
