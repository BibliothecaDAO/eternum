import type { Painting } from "../paintings";

/** The modes as the lore's four ages (ruled), each with the lore's painting, so a player learns the ages by sight. */
export type AgeMode = "blitz" | "frontier" | "eternum" | "dominion";

type Age = {
  mode: AgeMode;
  numeral: string;
  name: string;
  /** The lore site's words for the age. */
  lore: string;
  /** The lore site's painting of the age (public/images/landscapes/SOURCE.md). */
  painting: Painting;
  /** Its own page, opened from its tile or band. */
  page: string;
};

export const AGES: readonly Age[] = [
  {
    mode: "blitz",
    numeral: "I",
    name: "Blitz",
    lore: "The struggle for what remained",
    painting: "blitz-spires",
    page: "/blitz",
  },
  {
    mode: "frontier",
    numeral: "II",
    name: "Frontier",
    lore: "The last lights of the world",
    painting: "frontier-mist",
    page: "/frontier",
  },
  {
    mode: "eternum",
    numeral: "III",
    name: "Eternum",
    lore: "The return to greatness",
    painting: "eternum-restoration",
    page: "/eternum",
  },
  {
    mode: "dominion",
    numeral: "IV",
    name: "Dominion",
    lore: "The world that continues",
    painting: "dominion-first-adventurer",
    page: "/dominion",
  },
];

export const ageOf = (mode: AgeMode): Age => AGES.find((age) => age.mode === mode)!;
