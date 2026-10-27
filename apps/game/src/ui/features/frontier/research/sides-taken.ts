import { type IconMeaning } from "@/ui/design-system/icon";

import { researchPicks } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

/** Each choosing row's two sides as their marks: make more, or store more (or deploy for less wheat). */
const SIDE_MARKS: Partial<Record<number, readonly [IconMeaning, IconMeaning]>> = {
  [research.ROW_FARM]: ["fields", "granary"],
  [research.ROW_WORKSHOP]: ["tools", "storehouse"],
  [research.ROW_BARRACKS]: ["drill", "rations"],
};

/** One mark per upgrade on each independent side; none for a row without two sides. */
export const sidesTaken = (learned: bigint, row: number): IconMeaning[] => {
  const marks = SIDE_MARKS[row];
  if (!marks) return [];
  return marks.flatMap((mark, side) => Array.from({ length: researchPicks(learned, row, side) }, () => mark));
};

/** The tiers a row spent on its make side (Fields, Tools, Drill): each adds a share of the building's base output. */
export const makePicks = (learned: bigint, row: number): number => researchPicks(learned, row, 0);
