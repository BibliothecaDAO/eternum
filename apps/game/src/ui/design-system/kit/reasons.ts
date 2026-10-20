import { formatAmount, formatDuration, formatCharge } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";

import { PRICE_FACES, type PriceKind } from "./price-faces";
import { inTime, needsFree, needsHave, needsOverLimit, POPULATION } from "./words";

/** What a shortfall counts: anything a price is paid in, or the realm's population. */
type Counted = PriceKind | "population";

/**
 * Why a verb cannot run, standing where its button would: either what it needs against what there is (and the exact
 * wait when it fills by itself), or the one line naming what failed.
 */
export type Reason =
  | {
      kind: "short";
      of: Counted;
      held: number | undefined;
      need: number;
      /** What `held` is when not the amount in the store: what is free, or the store's own limit (no wait fills it). */
      counted?: "free" | "limit";
      wait?: number;
    }
  | { kind: "failed"; line: string };

export const COUNTED: Record<Counted, { word: string; icon?: IconMeaning }> = {
  ...PRICE_FACES,
  population: { word: POPULATION, icon: "person" },
};

/**
 * A shortfall in one line that names what is counted: "Needs 2,000 labor, have 1,614 · in 3h 50m", "Needs 3
 * population, 2 free". Never a bare "2 / 3".
 */
export const shortfallLine = ({ of, held, need, counted, wait }: Extract<Reason, { kind: "short" }>): string => {
  const noun = COUNTED[of].word;
  const line =
    counted === "free"
      ? needsFree(formatCharge(need), noun, formatAmount(held))
      : counted === "limit"
        ? needsOverLimit(formatCharge(need), noun, formatAmount(held))
        : needsHave(formatCharge(need), noun, formatAmount(held));
  return wait === undefined ? line : `${line} · ${inTime(formatDuration(wait, { days: false }))}`;
};
