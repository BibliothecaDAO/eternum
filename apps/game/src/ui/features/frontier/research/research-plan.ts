import { BuildingType } from "@bibliothecadao/types";

/**
 * The research tree as its sheet draws it (design §3.9, mockup 3): each node's state, Essence price and effect, and
 * what a building tier changes. Built from facts by the research reader; the sheet owns no rule of its own.
 */
export interface ResearchPlan {
  /** The realm's Essence in whole units; unknown shows as "—". */
  essence: number | undefined;
  nodes: readonly ResearchNodeView[];
}

export interface ResearchNodeView {
  /** The tier's own id on the sheet. */
  node: number;
  /** Its research row; buying it buys the row's next tier. */
  row: number;
  state: "learned" | "open" | "locked";
  /** Whole Essence. */
  price: number;
  effect:
    | { kind: "tier"; category: BuildingType; tier: 2 | 3 }
    | { kind: "site"; site: "Shrine" | "Well" }
    | { kind: "depth"; depth: 1 | 2 | 3 };
}

export const siteNode = (plan: ResearchPlan, site: "Shrine" | "Well") =>
  plan.nodes.find(({ effect }) => effect.kind === "site" && effect.site === site);

export const depthNode = (plan: ResearchPlan, depth: 1 | 2 | 3) =>
  plan.nodes.find(({ effect }) => effect.kind === "depth" && effect.depth === depth);

/**
 * Whether the realm can research a castle row now: one is open and its Essence is held. The nav's Research dot; the
 * building tiers move to the type rows' Upgrade with the contracts' research rows.
 */
export const canResearchNow = (plan: ResearchPlan | undefined): boolean => {
  const essence = plan?.essence;
  if (!plan || essence === undefined) return false;
  return plan.nodes.some(({ state, price, effect }) => effect.kind !== "tier" && state === "open" && price <= essence);
};
