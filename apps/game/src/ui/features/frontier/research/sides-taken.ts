import { type IconMeaning } from "@/ui/design-system/icon";

import { researchChoice, researchTier } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

/** Each choosing row's two sides as their marks: make more, or store more (or deploy for less wheat). */
const SIDE_MARKS: Partial<Record<number, readonly [IconMeaning, IconMeaning]>> = {
  [research.ROW_FARM]: ["fields", "granary"],
  [research.ROW_WORKSHOP]: ["tools", "storehouse"],
  [research.ROW_BARRACKS]: ["drill", "rations"],
};

/** The sides a row has taken, one mark per tier bought, in order; none for a row without a choice. */
export const sidesTaken = (learned: bigint, row: number): IconMeaning[] => {
  const marks = SIDE_MARKS[row];
  if (!marks) return [];
  return Array.from(
    { length: researchTier(learned, row) },
    (_, index) => marks[researchChoice(learned, row, index + 1)]!,
  );
};
