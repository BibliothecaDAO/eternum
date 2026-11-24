import { formatCharge, LORDS } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";

import { ESSENCE, FREE, LABOR, STAMINA, TROOPS, WHEAT } from "./words";

/** What a price is paid in: a resource, LORDS, or stamina. */
export type PriceKind = "essence" | "labor" | "wheat" | "troops" | "lords" | "stamina";

/** Each price's word and painting, the words any element showing a price reads. */
export const PRICE_FACES: Record<PriceKind, { word: string; icon?: IconMeaning }> = {
  essence: { word: ESSENCE, icon: "essence" },
  labor: { word: LABOR, icon: "labor" },
  wheat: { word: WHEAT, icon: "wheat" },
  troops: { word: TROOPS, icon: "troops" },
  lords: { word: LORDS, icon: "lords" },
  stamina: { word: STAMINA, icon: "stamina" },
};

/** What a verb pays: one of the game's stores and how much, unknown (a dash) until its facts arrive. */
export type Price = { of: PriceKind; amount: number | undefined };

export const costLine = (prices: readonly Price[]): string =>
  prices.length === 0
    ? FREE
    : prices.map(({ of, amount }) => `${formatCharge(amount)} ${PRICE_FACES[of].word}`).join(" · ");
