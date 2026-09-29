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
  node: number;
  state: "learned" | "open" | "locked";
  /** Whole Essence. */
  price: number;
  effect:
    | { kind: "tier"; category: BuildingType; tier: 2 | 3 }
    | { kind: "site"; site: "Shrine" | "Well" }
    | { kind: "depth"; depth: 1 | 2 | 3 };
  /** What a building tier changes, now and with it: a hut's population room 6 → 12. */
  gain?: { icon: string; now: number; next: number };
}

/** The tree's building columns, in the mockup's order; each holds its tier II and III nodes. */
export const TREE_BUILDINGS = [
  BuildingType.ResourceWheat,
  BuildingType.WorkersHut,
  BuildingType.Storehouse,
  BuildingType.ResourceKnightT1,
] as const;

export const tierNode = (plan: ResearchPlan, category: BuildingType, tier: 2 | 3) =>
  plan.nodes.find(({ effect }) => effect.kind === "tier" && effect.category === category && effect.tier === tier);

export const siteNode = (plan: ResearchPlan, site: "Shrine" | "Well") =>
  plan.nodes.find(({ effect }) => effect.kind === "site" && effect.site === site);

export const depthNode = (plan: ResearchPlan, depth: 1 | 2 | 3) =>
  plan.nodes.find(({ effect }) => effect.kind === "depth" && effect.depth === depth);

/** The node the sheet opens on: the first one open to research, else the first. */
export const firstOpenNode = (plan: ResearchPlan): ResearchNodeView | undefined =>
  plan.nodes.find(({ state }) => state === "open") ?? plan.nodes[0];
