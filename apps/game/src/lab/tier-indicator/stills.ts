/**
 * The tier indicator's stills, one list for the pick page and its test: each place a tier is drawn (research panel C's
 * tiles, a build card's Barracks gate, an army's attributes), today's pips and each draft, on a desktop rail and a
 * phone. Screenshots of the game's own HUD lab states with the draft swapped into HudRarity, taken once
 * (evidence/frontier-tier-indicator-1/capture-tier-stills.sh in the lanes folder), kept in
 * asset-sources/lab/tier-indicator and served at /lab/tier-indicator in the dev build only (build/lab-artwork.ts).
 */
export const LOOKS = ["pips", "gem", "word", "frame"] as const;
export type TierLook = (typeof LOOKS)[number];
export const PLACES = ["research", "build", "army"] as const;
export type TierPlace = (typeof PLACES)[number];
export type StillDevice = "desktop" | "phone";

export const stillName = (place: TierPlace, look: TierLook, device: StillDevice) => `${place}-${look}-${device}`;

/** Where a still is served. */
export const stillUrl = (name: string) => `/lab/tier-indicator/${name}.webp`;
