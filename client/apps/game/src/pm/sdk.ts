import { ClauseBuilder, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useEffect, useMemo, useState } from "react";
import { Market, MarketCreated, VaultDenominator, VaultNumerator } from "./bindings";
export type { RegisteredToken } from "./bindings";
import { MarketClass } from "./class";
import { useDojoSdk } from "./hooks/dojo/useDojoSdk";
import { useConfig } from "./providers";
import { deepEqual, formatCurrency, formatUnits } from "./utils";
export { DojoSdkProviderInitialized } from "@/pm/hooks/dojo/useDojoSdk";

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

  const [rawMarkets, setRawMarkets] = useState<Market[]>([]);
  const [vaultDenominators, setVaultDenominators] = useState<VaultDenominator[]>([]);
  const [allVaultNumerators, setAllVaultNumerators] = useState<VaultNumerator[]>([]);
  const [marketEvents, setMarketEvents] = useState<MarketCreated[]>([]);

  console.log({ marketEvents });
  const [markets, setMarkets] = useState<MarketClass[]>([]);

  console.log({ rawMarkets });

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

  // const editionClause = useMemo(() => {
  //   return new ClauseBuilder().where(
  //     "pm-Market",
  //     "json_extract(oracle_extra_params, '$[0]')",
  //     "Eq",
  //     "0x049acadadb7400d25e79f2bd0d56fe1dd07ee91d4d66baa49b6f7db54503c247"
  //   );
  // }, []);

  const marketsQuery = useMemo(() => {
    const clauses = [];

    // if(editionClause){
    //   clauses.push(editionClause)
    // }

    if (statusClause) {
      clauses.push(statusClause);
    }
    if (oracleClause) {
      clauses.push(oracleClause);
    }

    const query = new ToriiQueryBuilder()
      .withEntityModels([
        "pm-Market",
        // "pm-VaultNumerator",
        "pm-VaultDenominator",
      ])
      .withClause(new ClauseBuilder().compose().and(clauses).build())
      .includeHashedKeys();

    return query;
  }, [statusClause, oracleClause /* editionClause*/]);

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

  useEffect(() => {
    const initAsync = async () => {
      const entities = (await sdk.getEntities({ query: marketsQuery })).getItems();
      console.log({ entities, sdk, marketsQuery });

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
  }, [marketsQuery]);

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
  }, [allVaultNumeratorsQuery]);

  useEffect(() => {
    const fetchMarketEvents = async () => {
      try {
        const entities = (await sdk.getEventMessages({ query: marketEventsQuery })).getItems();
        console.log({ marketEventsEntities: entities });

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
  }, [sdk, marketEventsQuery]);

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

    console.log({ markets, parsedMarkets });

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

  console.log({ markets });

  return {
    markets,
  };
};

export const replaceAndFormat = (template?: string) => {
  if (!template) return "";

  template = template.replaceAll("\n", "<br>");
  const regex = /\{(.*?)\}/g;
  const toReplace = Array.from((template || "").matchAll(regex));

  for (let variable of toReplace) {
    if (variable[1].startsWith("DateTime:")) {
      const timestamp = variable[1].split(":")[1];
      const date = new Date(Number(timestamp) * 1_000);

      template = template.replace(
        variable[0],
        date.toLocaleString("default", { day: "2-digit", month: "long" }) +
          " " +
          date.toLocaleTimeString().substring(0, 5),
      );
    }

    if (variable[1].startsWith("Date:")) {
      const timestamp = variable[1].split(":")[1];
      const date = new Date(Number(timestamp) * 1_000);

      template = template.replace(variable[0], date.toLocaleString("default", { day: "2-digit", month: "long" }));
    }

    if (variable[1].startsWith("BigInt:")) {
      const decimals = Number(variable[1].split(":")[1]);
      const value = variable[1].split(":")[2];
      // const parsed = Number(value) / 10 ** decimals;
      const parsed = formatUnits(value, decimals, 4);

      const formated = formatCurrency(parsed, decimals);

      template = template.replace(variable[0], formated);
    }
  }

  return template;
};
