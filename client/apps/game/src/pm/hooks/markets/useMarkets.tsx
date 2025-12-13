import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Market, MarketCreated, VaultDenominator, VaultNumerator } from "@/pm/bindings";
import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { useConfig } from "@/pm/providers";
import { deepEqual, formatCurrency, formatUnits, replaceAndFormat } from "@/pm/utils";

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

  const refresh = useCallback(() => setRefreshNonce((prev) => prev + 1), []);

  useEffect(() => {
    const initAsync = async () => {
      const entities = (await sdk.getEntities({ query: marketsQuery })).getItems();

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
      const entities = (await sdk.getEntities({ query: allVaultNumeratorsQuery })).getItems();

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
        const entities = (await sdk.getEventMessages({ query: marketEventsQuery })).getItems();

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
    if (!registeredOracles || registeredOracles.length === 0) return;
    if (!registeredTokens || registeredTokens.length === 0) return;

    if (!rawMarkets) return;

    const newEvents = marketEvents.map((i) => ({
      ...i,
      title: replaceAndFormat(i.title),
      terms: replaceAndFormat(i.terms),
    }));

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
        const marketCreated = newEvents.find((i) => i.market_id === market.market_id)!;

        const vaultDenominator = vaultDenominators.find((i) => i.market_id === market.market_id);
        const vaultNumerators = allVaultNumerators
          .filter((i) => i.market_id === market.market_id)
          .sort((a, b) => Number(a.index) - Number(b.index));

        if (!market || !marketCreated) return [];
        const collateralToken = getRegisteredToken(market.collateral_token);

        const value = new MarketClass({
          market,
          marketCreated,
          collateralToken,
          vaultDenominator,
          vaultNumerators,
          conditionResolution: undefined,
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
    allVaultNumerators,
    vaultDenominators,
    marketFilters.type,
    marketEvents,
    getRegisteredToken,
  ]);

  return {
    markets,
    refresh,
  };
};
