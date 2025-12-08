import { useConfig } from "@/pm/providers";
import { MarketFiltersParams, MarketStatusFilter, MarketTypeFilter } from "@pm/sdk";
import { HStack } from "@pm/ui";
import { useId, useMemo } from "react";

type SelectOption = {
  name: string;
  value: string;
};

type RegisteredOracle = string | { name?: string | null; contract_address?: string | null };

const cx = (...classes: Array<string | null | undefined | false>) => classes.filter(Boolean).join(" ");

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

  const oracles = useMemo<SelectOption[]>(() => {
    const values = (registeredOracles as RegisteredOracle[])
      .map((oracle) => {
        if (oracle == null) {
          return null;
        }

        if (typeof oracle === "string") {
          const normalized = oracle || "All";
          return { name: normalized, value: normalized };
        }

        const value = oracle.contract_address ?? oracle.name;
        if (!value) return null;

        return {
          name: oracle.name ?? value,
          value,
        };
      })
      .filter((option): option is SelectOption => Boolean(option));

    const hasAllOption = values.some((option) => option.value === "All");
    return hasAllOption ? values : [{ name: "All", value: "All" }, ...values];
  }, [registeredOracles]);

  return (
    <HStack className="flex-wrap gap-4 md:gap-6">
      <SimpleSelect
        className="w-auto"
        label="Status"
        items={status}
        clearable
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
        label="Type"
        items={types}
        value={marketFilters.type}
        clearable
        onValueChange={(e) =>
          setMarketFilters({
            ...marketFilters,
            type: e as MarketTypeFilter,
          })
        }
      />
      <SimpleSelect
        className="w-auto"
        label="Oracle"
        items={oracles}
        value={marketFilters.oracle}
        clearable
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

type SimpleSelectProps = {
  className?: string;
  clearable?: boolean;
  items: SelectOption[];
  label: string;
  onValueChange: (value: string) => void;
  value?: string;
};

function SimpleSelect({ className, clearable, items, label, onValueChange, value }: SimpleSelectProps) {
  const id = useId();
  const options =
    clearable && !items.some((item) => item.value === "All") ? [{ name: "All", value: "All" }, ...items] : items;

  return (
    <label
      className={cx("flex min-w-[180px] flex-col gap-2 text-sm text-gold/90 sm:min-w-[200px]", className)}
      htmlFor={id}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gold/70">{label}</span>
      <div className="relative">
        <select
          id={id}
          className="peer block w-full appearance-none rounded-md border border-gold/30 bg-white/5 px-3 py-2.5 pr-10 text-white shadow-sm outline-none transition hover:border-gold/50 focus:border-gold focus:ring-2 focus:ring-gold/20"
          value={value ?? ""}
          onChange={(event) => onValueChange(event.target.value)}
        >
          {options.map((item) => (
            <option key={item.value} value={item.value}>
              {item.name}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gold/70 transition peer-focus:text-gold"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}
