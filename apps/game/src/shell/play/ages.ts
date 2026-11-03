import { GAME_MODE_NAMES } from "@bibliothecadao/types";
import type { Painting } from "@/ui/design-system/kit/paintings";

/** The modes as the lore's four ages, each with the lore's painting and words, for the app's paintings and labels. */
export type AgeMode = "blitz" | "frontier" | "eternum" | "dominion";

type Age = {
  mode: AgeMode;
  numeral: string;
  name: string;
  /** The lore site's painting of the age (public/images/landscapes/SOURCE.md). */
  painting: Painting;
};

const AGES: readonly Age[] = [
  {
    mode: "blitz",
    numeral: "I",
    name: GAME_MODE_NAMES.blitz,
    painting: "blitz-spires",
  },
  {
    mode: "frontier",
    numeral: "II",
    name: GAME_MODE_NAMES.frontier,
    painting: "frontier-mist",
  },
  {
    mode: "eternum",
    numeral: "III",
    name: GAME_MODE_NAMES.eternum,
    painting: "eternum-restoration",
  },
  {
    mode: "dominion",
    numeral: "IV",
    // No game is created in Dominion yet, so the catalog of modes has no row for it.
    name: "Dominion",
    painting: "dominion-first-adventurer",
  },
];

export const ageOf = (mode: AgeMode): Age => AGES.find((age) => age.mode === mode)!;
