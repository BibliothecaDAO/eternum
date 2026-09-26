import type { SitePayoutSystemUpdate } from "@bibliothecadao/eternum";

/** Each site kind's art, the one picture a card shows of it: the camp and rift renders, and the fallen realm's glyph. */
export const SITE_ART: Record<SitePayoutSystemUpdate["kind"], string> = {
  Camp: "/images/buildings/construction/camp.png",
  Rift: "/images/buildings/construction/essence-rift.png",
  FallenRealm: "/images/frontier/sites/fallen-realm.svg",
};

/** The single-use sites' art: the pictures the research tree and their tile card show of them. */
export const MAP_SITE_ART = {
  Shrine: "/images/frontier/sites/shrine.svg",
  Well: "/images/frontier/sites/well.svg",
} as const;
