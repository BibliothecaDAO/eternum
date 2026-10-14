import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatInventoryAmount } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { findResourceById, isRelic, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import { type Stock, summarizeStocks } from "./stock-summary";

/**
 * The structure's stocks now, with their hourly rates: the summary (the economy's named stocks, then the troops
 * held) and every stock held or growing, in the game's tier order.
 */
export const useStocks = (resources: ResourceManager | null | undefined): { summary: Stock[]; held: Stock[] } => {
  const tick = useCurrentDefaultTick();
  const tiers = useGameModeConfig().resources.getTiers() as Record<string, ResourcesIds[]>;
  return useMemo(() => {
    const stocks = resources ? readStocks(resources, Object.values(tiers).flat(), tick) : [];
    return summarizeStocks(stocks, tiers.military ?? []);
  }, [resources, tick, tiers]);
};

const readStocks = (resources: ResourceManager, resourceIds: ResourcesIds[], tick: number): Stock[] =>
  resourceIds
    .filter((resourceId) => !isRelic(resourceId))
    .flatMap((resourceId) => {
      const state = resources.current(resourceId);
      if (!state) return [];
      const production = ResourceManager.calculateResourceProductionData(resourceId, state, tick);
      const amount = divideByPrecision(resources.balanceWithProduction(tick, resourceId)?.balance ?? 0);
      const perHour = production.isProducing ? production.productionPerSecond * 3600 : 0;
      const name = findResourceById(resourceId)?.trait ?? ResourcesIds[resourceId];
      return [{ resourceId, name, amount, perHour }];
    });

/** One line per stock: its icon and name, then its hourly rate and amount. */
export const StockList = ({ stocks }: { stocks: Stock[] }) => (
  <ul className="flex flex-col">
    {stocks.map((stock) => (
      <li key={stock.resourceId} className="flex min-h-8 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <ResourceIcon resource={ResourcesIds[stock.resourceId]} size="xs" withTooltip={false} />
          <span className="truncate text-base text-kit-cream">{stock.name}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          {stock.perHour !== 0 && (
            <span className="text-sm text-kit-muted">
              {stock.perHour > 0 ? "+" : "−"}
              {formatInventoryAmount(Math.abs(stock.perHour))}/h
            </span>
          )}
          <span className="text-base font-semibold tabular-nums text-kit-cream">
            {formatInventoryAmount(stock.amount)}
          </span>
        </span>
      </li>
    ))}
  </ul>
);

/** Every stock a structure holds, or a line saying it holds none. */
export const HeldStocks = ({ resources }: { resources: ResourceManager | null | undefined }) => {
  const { held } = useStocks(resources);
  return held.length > 0 ? <StockList stocks={held} /> : <p className="text-sm text-kit-muted">No resources stored.</p>;
};
