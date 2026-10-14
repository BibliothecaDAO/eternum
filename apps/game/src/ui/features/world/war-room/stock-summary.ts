import { ResourcesIds } from "@bibliothecadao/types";

export type Stock = { resourceId: ResourcesIds; name: string; amount: number; perHour: number };

/** What a realm runs on, named first; troops follow once it holds any. */
const ECONOMY: readonly ResourcesIds[] = [
  ResourcesIds.Labor,
  ResourcesIds.Wheat,
  ResourcesIds.Donkey,
  ResourcesIds.Essence,
];
/** Always shown, even at zero: a fresh realm reads what it lacks. */
const ALWAYS: ReadonlySet<ResourcesIds> = new Set([ResourcesIds.Labor, ResourcesIds.Wheat, ResourcesIds.Donkey]);

/** The summary (the economy's named stocks, then the troops held) and every stock held or growing. */
export const summarizeStocks = (stocks: Stock[], troopIds: readonly ResourcesIds[]) => ({
  summary: [
    ...ECONOMY.flatMap((id) =>
      stocks.filter((stock) => stock.resourceId === id && (ALWAYS.has(id) || stock.amount > 0)),
    ),
    ...stocks.filter((stock) => troopIds.includes(stock.resourceId) && stock.amount > 0),
  ],
  held: stocks.filter((stock) => stock.amount > 0 || stock.perHour > 0),
});
