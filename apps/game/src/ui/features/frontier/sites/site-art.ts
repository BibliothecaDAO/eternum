import type { SitePayoutSystemUpdate } from "@bibliothecadao/eternum";

/** Each site kind's art, the one picture a card shows of it: the camp and rift renders, and the fallen realm's glyph. */
export const SITE_ART: Record<SitePayoutSystemUpdate["kind"], string> = {
  Camp: "/images/buildings/construction/camp.png",
  Rift: "/images/buildings/construction/essence-rift.png",
  FallenRealm: "/images/frontier/sites/fallen-realm.svg",
};
