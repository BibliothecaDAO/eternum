import { MarketFiltersParams, MarketStatusFilter, MarketTypeFilter, useConfig } from "@pm/sdk";
import { HStack } from "@pm/ui";
import { useMemo } from "react";

export function MarketFilters({
  marketFilters,
  setMarketFilters,
}: {
  marketFilters: MarketFiltersParams;
  setMarketFilters: (e: MarketFiltersParams) => void;
}) {
  const { registeredOracles } = useConfig();

  const status = [
    {
      name: MarketStatusFilter.All,
      value: MarketStatusFilter.All,
    },
    {
      name: MarketStatusFilter.Open,
      value: MarketStatusFilter.Open,
    },
    {
      name: MarketStatusFilter.Resolvable,
      value: MarketStatusFilter.Resolvable,
    },
    {
      name: MarketStatusFilter.Resolved,
      value: MarketStatusFilter.Resolved,
    },
  ];

  const types = [
    {
      name: MarketTypeFilter.All,
      value: MarketTypeFilter.All,
    },
    {
      name: MarketTypeFilter.Binary,
      value: MarketTypeFilter.Binary,
    },
    {
      name: MarketTypeFilter.Categorical,
      value: MarketTypeFilter.Categorical,
    },
  ];

  const oracles = useMemo(() => {
    const values = registeredOracles.map((i) => {
      return {
        name: i.name,
        value: i.contract_address,
      };
    });

    return [{ name: "All", value: "All" }, ...values];
  }, [registeredOracles]);

  return (
    <HStack className="gap-6">
      <SimpleSelect
        className="w-auto"
        label={"Status"}
        items={status}
        clearable={true}
        value={marketFilters.status}
        onValueChange={(e) =>
          setMarketFilters({
            ...marketFilters,
            status: e as MarketStatusFilter,
          })
        }
      />
      <SimpleSelect
        className="w-auto"
        label={"Type"}
        items={types}
        value={marketFilters.type}
        clearable={true}
        onValueChange={(e) =>
          setMarketFilters({
            ...marketFilters,
            type: e as MarketTypeFilter,
          })
        }
      />
      <SimpleSelect
        className="w-auto"
        label={"Oracle"}
        items={oracles}
        value={marketFilters.oracle}
        clearable={true}
        onValueChange={(e) => {
          setMarketFilters({
            ...marketFilters,
            oracle: e,
          });
        }}
      />
    </HStack>
  );
}
