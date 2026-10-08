import type { Painting } from "../paintings";

/** The modes as the lore's four ages (ruled), each with the lore's painting, so a player learns the ages by sight. */
export type AgeMode = "blitz" | "frontier" | "eternum" | "dominion";

type Age = {
  mode: AgeMode;
  numeral: string;
  name: string;
  /** The lore site's words for the age. */
  lore: string;
  /** The chronicle's name for the era and its one line, as the lore site captions the age's painting. */
  era: string;
  caption: string;
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
    era: "Chaos & war",
    caption: "The Spires emerge. The laws of the world begin to fracture.",
    painting: "blitz-spires",
    page: "/blitz",
  },
  {
    mode: "frontier",
    numeral: "II",
    name: "Frontier",
    lore: "The last lights of the world",
    era: "The dark age",
    caption: "Beyond the last lights, the frontier waits.",
    painting: "frontier-mist",
    page: "/frontier",
  },
  {
    mode: "eternum",
    numeral: "III",
    name: "Eternum",
    lore: "The return to greatness",
    era: "Restoration & conquest",
    caption: "From ancient foundations, the Hyperstructures rise again.",
    painting: "eternum-restoration",
    page: "/eternum",
  },
  {
    mode: "dominion",
    numeral: "IV",
    name: "Dominion",
    lore: "The world that continues",
    era: "The first adventurer",
    caption: "The spark shone for an eternity, and then another.",
    painting: "dominion-first-adventurer",
    page: "/dominion",
  },
];

export const ageOf = (mode: AgeMode): Age => AGES.find((age) => age.mode === mode)!;

/** Dominion waits for its opening: drawn greyed, with no way in. */
export const isLocked = (mode: AgeMode) => mode === "dominion";
