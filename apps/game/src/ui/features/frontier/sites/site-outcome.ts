import type { SitePayoutSystemUpdate } from "@bibliothecadao/eternum";

/** What the site-cleared moment shows: the site, and what it paid home; a ruin pays its chest, stragglers only XP. */
export type SiteClear = Pick<SitePayoutSystemUpdate, "siteId" | "kind" | "reward">;

const MIN_SPRITES = 6;
const MAX_SPRITES = 20;

/** How many icons fly home for a payout: six to twenty, growing with the amount's order of magnitude. */
export const payoutSprites = (amount: number): number =>
  Math.round(Math.min(MAX_SPRITES, Math.max(MIN_SPRITES, 4 * Math.log10(Math.max(1, amount)))));
