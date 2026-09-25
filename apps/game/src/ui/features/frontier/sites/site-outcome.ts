import { RESOURCE_PRECISION, type ResourcesIds } from "@bibliothecadao/types";

/**
 * A cleared site's payout story as the agreed shapes carry it (backend shapes v4): the site's kind, and the resource a
 * camp or rift pays in game precision; a fallen realm pays none, leaving a closed chest instead. The sites train's
 * generated row replaces this type when it lands.
 */
export interface SitePayoutFacts {
  structure_id: number;
  explorer_id: number;
  site_id: number;
  kind: "Camp" | "Rift" | "FallenRealm";
  reward: { resource_type: number; amount: bigint } | null;
}

export interface SiteClear {
  title: string;
  /** What the site paid, in whole units; null for a fallen realm. */
  reward: { resourceId: ResourcesIds; amount: number } | null;
  /** A fallen realm leaves its closed chest on the tile. */
  leavesChest: boolean;
}

const TITLES: Record<SitePayoutFacts["kind"], string> = {
  Camp: "Camp cleared",
  Rift: "Rift cleared",
  FallenRealm: "Fallen realm cleared",
};

/** What clearing a site gave: a camp or rift its payout, a fallen realm its chest. Anything else is an error. */
export const readSiteClear = (story: SitePayoutFacts): SiteClear => {
  if (story.kind === "FallenRealm") {
    if (story.reward) throw new Error("A fallen realm pays a chest, never a resource");
    return { title: TITLES.FallenRealm, reward: null, leavesChest: true };
  }
  if (!story.reward) throw new Error(`A cleared ${story.kind} must pay a resource`);
  return {
    title: TITLES[story.kind],
    reward: {
      resourceId: story.reward.resource_type as ResourcesIds,
      amount: Number(story.reward.amount) / RESOURCE_PRECISION,
    },
    leavesChest: false,
  };
};

const MIN_SPRITES = 6;
const MAX_SPRITES = 20;

/** How many icons fly home for a payout: six to twenty, growing with the amount's order of magnitude. */
export const payoutSprites = (amount: number): number =>
  Math.round(Math.min(MAX_SPRITES, Math.max(MIN_SPRITES, 4 * Math.log10(Math.max(1, amount)))));
