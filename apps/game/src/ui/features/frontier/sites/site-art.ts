import type { SiteKind } from "@bibliothecadao/eternum";

/**
 * Each site kind's art, the one picture a card shows of it: the camp and rift renders and the ruin's glyph. Stragglers
 * show the camp render until their own art lands.
 */
export const SITE_ART: Record<SiteKind, string> = {
  Camp: "/images/buildings/construction/camp.png",
  Rift: "/images/buildings/construction/essence-rift.png",
  Ruin: "/images/frontier/sites/fallen-realm.svg",
  Stragglers: "/images/buildings/construction/camp.png",
};

/** The single-use sites' art: the pictures the research tree and their tile card show of them. */
export const MAP_SITE_ART = {
  Shrine: "/images/frontier/sites/shrine.svg",
  Well: "/images/frontier/sites/well.svg",
} as const;
