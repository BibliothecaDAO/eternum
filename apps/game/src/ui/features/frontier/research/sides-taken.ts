import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { researchChoice, researchTier } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

/** Each choosing row's two sides as their marks: make more, or store more (or deploy for less wheat). */
const SIDE_MARKS: Partial<Record<number, readonly [IconCode, IconCode]>> = {
  [research.ROW_FARM]: ["Fi", "Gr"],
  [research.ROW_WORKSHOP]: ["To", "So"],
  [research.ROW_BARRACKS]: ["Dr", "Ra"],
};

/** The sides a row has taken, one mark per tier bought, in order; none for a row without a choice. */
export const sidesTaken = (learned: bigint, row: number): IconCode[] => {
  const marks = SIDE_MARKS[row];
  if (!marks) return [];
  return Array.from(
    { length: researchTier(learned, row) },
    (_, index) => marks[researchChoice(learned, row, index + 1)]!,
  );
};
