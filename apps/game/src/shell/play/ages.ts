import type { Painting } from "../paintings";

/** The modes as the lore's four ages, each with the lore's painting and words, for Play's paintings and Learn's chronicle. */
export type AgeMode = "blitz" | "frontier" | "eternum" | "dominion";

type Age = {
  mode: AgeMode;
  numeral: string;
  name: string;
  /** The lore site's words for the age. */
  lore: string;
  /** The chronicle's name for the era. */
  era: string;
  /** The chronicle's telling of the age, from the lore site, for Learn. */
  chronicle: string;
  /** The lore site's painting of the age (public/images/landscapes/SOURCE.md). */
  painting: Painting;
};

export const AGES: readonly Age[] = [
  {
    mode: "blitz",
    numeral: "I",
    name: "Blitz",
    lore: "The struggle for what remained",
    era: "Chaos & war",
    chronicle:
      "Thousands of kingdoms rose and fell in the struggle for the Hyperstructures. Then the Spires emerged from the land, tore at the air and bent the laws of space and time.",
    painting: "blitz-spires",
  },
  {
    mode: "frontier",
    numeral: "II",
    name: "Frontier",
    lore: "The last lights of the world",
    era: "The dark age",
    chronicle:
      "The last lights of the world shone within the Realms. Beyond them, the mist swallowed the ruins of civilisation. Aspiring Lords ventured out to reestablish the frontier.",
    painting: "frontier-mist",
  },
  {
    mode: "eternum",
    numeral: "III",
    name: "Eternum",
    lore: "The return to greatness",
    era: "Restoration & conquest",
    chronicle:
      "The Realms came alive. Lords set out to recover the world they had lost, uncovering the foundations of ruined Hyperstructures and restoring them to their former glory.",
    painting: "eternum-restoration",
  },
  {
    mode: "dominion",
    numeral: "IV",
    name: "Dominion",
    lore: "The world that continues",
    era: "The first adventurer",
    chronicle:
      "The spark shone for an eternity, and then another. Then, at last, someone stepped through. An adventurer. And he was holding Loot.",
    painting: "dominion-first-adventurer",
  },
];

export const ageOf = (mode: AgeMode): Age => AGES.find((age) => age.mode === mode)!;

/** Dominion waits for its opening: drawn greyed, with no way in. */
export const isLocked = (mode: AgeMode) => mode === "dominion";
