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
    name: "Blitz",
    painting: "blitz-spires",
  },
  {
    mode: "frontier",
    numeral: "II",
    name: "Frontier",
    painting: "frontier-mist",
  },
  {
    mode: "eternum",
    numeral: "III",
    name: "Eternum",
    painting: "eternum-restoration",
  },
  {
    mode: "dominion",
    numeral: "IV",
    name: "Dominion",
    painting: "dominion-first-adventurer",
  },
];

export const ageOf = (mode: AgeMode): Age => AGES.find((age) => age.mode === mode)!;
