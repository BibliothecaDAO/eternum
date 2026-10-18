import { formatCharge } from "@/ui/design-system/kit/amount";
import type { Price } from "@/ui/design-system/kit/button";
import type { HudButton } from "@/ui/design-system/kit/hud-elements";
import { PRICE_FACES } from "@/ui/design-system/kit/price-chip";
import type { ComponentProps } from "react";

type HudPrice = NonNullable<ComponentProps<typeof HudButton>["prices"]>[number];

/** A Frontier verb's prices as the HUD's button shows them: each its painting (or XP's word) and its charge. */
export const hudPrices = (prices: readonly Price[]): HudPrice[] =>
  prices.map(({ of, amount }) => ({ ...PRICE_FACES[of], amount: formatCharge(amount) }));
