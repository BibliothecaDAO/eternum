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

/** The tiers a row spent on its make side (Fields, Tools, Drill): each adds a share of the building's base output. */
export const makePicks = (learned: bigint, row: number): number =>
  Array.from({ length: researchTier(learned, row) }, (_, index) => researchChoice(learned, row, index + 1)).filter(
    (side) => side === 0,
  ).length;

/**
 * Each side of a choosing row with the tiers bought on it, make side first ("fields" 2, "granary" 1); none for a row
 * without a choice. A side's gem counts from Common I as its row's does: I is a side never picked.
 */
export const sidePicks = (learned: bigint, row: number): { icon: IconMeaning; picks: number }[] | undefined => {
  const marks = SIDE_MARKS[row];
  if (!marks) return undefined;
  const taken = sidesTaken(learned, row);
  return marks.map((icon) => ({ icon, picks: taken.filter((mark) => mark === icon).length }));
};
