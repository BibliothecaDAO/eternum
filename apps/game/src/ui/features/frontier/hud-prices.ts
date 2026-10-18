import { formatCharge } from "@/ui/design-system/kit/amount";
import type { HudButton } from "@/ui/design-system/kit/hud-elements";
import { PRICE_FACES, type PriceKind } from "@/ui/design-system/kit/price-chip";
import type { ComponentProps } from "react";

/** What a Frontier verb pays: one of the game's stores and how much, unknown until its facts arrive. */
export type Price = { of: PriceKind; amount: number | undefined };

type HudPrice = NonNullable<ComponentProps<typeof HudButton>["prices"]>[number];

/** A Frontier verb's prices as the HUD's button shows them: each its painting (or XP's word) and its charge. */
export const hudPrices = (prices: readonly Price[]): HudPrice[] =>
  prices.map(({ of, amount }) => ({ ...PRICE_FACES[of], amount: formatCharge(amount) }));
