import { formatCharge, LORDS } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";

import { ESSENCE, LABOR, STAMINA, TROOPS, WHEAT, XP } from "./words";

/** What a price is paid in: a resource, LORDS, stamina, or XP (drawn as its word, the XP badge being a number alone). */
export type PriceKind = "essence" | "labor" | "wheat" | "troops" | "lords" | "stamina" | "xp";

/** Each price's word and painting, the words any element showing a price reads. */
export const PRICE_FACES: Record<PriceKind, { word: string; icon?: IconMeaning }> = {
  essence: { word: ESSENCE, icon: "essence" },
  labor: { word: LABOR, icon: "labor" },
  wheat: { word: WHEAT, icon: "wheat" },
  troops: { word: TROOPS, icon: "troops" },
  lords: { word: LORDS, icon: "lords" },
  stamina: { word: STAMINA, icon: "stamina" },
  xp: { word: XP },
};

/** What a verb pays: one of the game's stores and how much, unknown (a dash) until its facts arrive. */
export type Price = { of: PriceKind; amount: number | undefined };

/**
 * What a verb pays, as one compact line beside it, the way the map's order line writes its cost ("30 stamina · 100
 * wheat"); empty when it pays nothing. A button carries its verb only (owner, sheet 2026-10-18).
 */
export const costLine = (prices: readonly Price[]): string =>
  prices.map(({ of, amount }) => `${formatCharge(amount)} ${PRICE_FACES[of].word}`).join(" · ");
