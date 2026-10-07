/** The modes as the lore's four ages (ruled), each with its painting, so a player learns the ages by sight. */
export type AgeMode = "blitz" | "frontier" | "eternum" | "dominion";

type Age = {
  mode: AgeMode;
  numeral: string;
  name: string;
  /** The lore site's words for the age. */
  lore: string;
  /** The kit landscape it wears, served at 800 and 1600 px (public/images/landscapes/SOURCE.md). */
  painting: string;
  /** Its own page, opened from its tile or band. */
  page: string;
};

export const AGES: readonly Age[] = [
  {
    mode: "blitz",
    numeral: "I",
    name: "Blitz",
    lore: "The struggle for what remained",
    painting: "twilight-tundra",
    page: "/blitz",
  },
  {
    mode: "frontier",
    numeral: "II",
    name: "Frontier",
    lore: "The last lights of the world",
    painting: "wheat",
    page: "/frontier",
  },
  {
    mode: "eternum",
    numeral: "III",
    name: "Eternum",
    lore: "The return to greatness",
    painting: "castle",
    page: "/eternum",
  },
  {
    mode: "dominion",
    numeral: "IV",
    name: "Dominion",
    lore: "The world that continues",
    painting: "hidden-castle",
    page: "/dominion",
  },
];

export const ageOf = (mode: AgeMode): Age => AGES.find((age) => age.mode === mode)!;

/** A kit landscape at the width a surface needs, as an img srcset pair. */
export const paintingSources = (painting: string) => ({
  src: `/images/landscapes/${painting}-800.webp`,
  srcSet: `/images/landscapes/${painting}-800.webp 800w, /images/landscapes/${painting}-1600.webp 1600w`,
});
