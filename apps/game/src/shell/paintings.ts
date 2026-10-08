/** The widths each painting is served at, up to its master's own (public/images/landscapes/SOURCE.md). */
const LORE = [800, 1536] as const;
const KIT = [800, 1600, 1920, 2688] as const;

const WIDTHS = {
  "blitz-spires": LORE,
  "frontier-mist": LORE,
  "eternum-restoration": LORE,
  "dominion-first-adventurer": LORE,
  "dark-plains": KIT,
  "brooding-plains": KIT,
  stormy: KIT,
  "winter-fortress": KIT,
} as const;

export type Painting = keyof typeof WIDTHS;

const fileOf = (painting: Painting, width: number) => `/images/landscapes/${painting}-${width}.webp`;

/** A painting at the width a surface needs, as an img src and srcset. */
export const paintingSources = (painting: Painting) => ({
  src: fileOf(painting, WIDTHS[painting][0]),
  srcSet: WIDTHS[painting].map((width) => `${fileOf(painting, width)} ${width}w`).join(", "),
});
