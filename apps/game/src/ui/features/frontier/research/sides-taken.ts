import { type IconMeaning } from "@/ui/design-system/icon";
import { type Rank } from "@/ui/design-system/kit/words";

import { researchHasIndependentSides, researchPicks } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

/**
 * Each choosing row's two sides as their marks, the one place they are named: make more, or store more (or deploy for
 * less wheat). The research tree, the Build sheet and a store's card all draw them from here.
 */
const SIDE_MARKS: Partial<Record<number, readonly [IconMeaning, IconMeaning]>> = {
  [research.ROW_FARM]: ["fields", "granary"],
  [research.ROW_WORKSHOP]: ["tools", "storehouse"],
  [research.ROW_BARRACKS]: ["drill", "rations"],
};

/** A choosing row's two side marks, make side first; loud for a row without two sides. */
export const sideMarks = (row: number): readonly [IconMeaning, IconMeaning] => {
  const marks = SIDE_MARKS[row];
  if (!marks) throw new Error(`Research row ${row} has no two sides`);
  return marks;
};

/** One side of a choosing row: its mark, and the tiers bought on it as its rank (0 before the first). */
export type SidePick = { icon: IconMeaning; picks: Rank };

/** The tiers a row spent on its make side (Fields, Tools, Drill): each adds a share of the building's base output. */
export const makePicks = (learned: bigint, row: number): number =>
  researchHasIndependentSides(row) ? researchPicks(learned, row, 0) : 0;

/**
 * Each side of a choosing row with the tiers bought on it, make side first ("fields" 2, "granary" 1); none for a row
 * without a choice. Each side's rank is its purchase count, starting at 0.
 */
export const sidePicks = (learned: bigint, row: number): SidePick[] | undefined => {
  const marks = SIDE_MARKS[row];
  if (!marks) return undefined;
  return marks.map((icon, side) => ({ icon, picks: researchPicks(learned, row, side) as Rank }));
};
