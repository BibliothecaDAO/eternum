import { BuildingType } from "@bibliothecadao/types";

/**
 * The castle's tree as its page draws it (wireframe 09): a row per building type that stands, and the castle rows
 * (shrine, well, the three reaches) with their state and Essence price. Built from facts by the research reader; the
 * page owns no rule of its own.
 */
export interface ResearchPlan {
  /** The realm's Essence in whole units; unknown shows as "—". */
  essence: number | undefined;
  nodes: readonly ResearchNodeView[];
  types: readonly TypeRowView[];
}

/** A building type's research row, for a type standing on the realm: its tier, the sides taken, its next price. */
export interface TypeRowView {
  row: number;
  category: BuildingType;
  /** The row's tier above common, 0 (common) to 4 (legendary). */
  tier: number;
  learned: bigint;
  /** The next tier's Essence and labor in whole units; undefined at legendary. */
  next: { essence: number; labor: number } | undefined;
}

export interface ResearchNodeView {
  /** The tier's own id on the sheet. */
  node: number;
  /** Its research row; buying it buys the row's next tier. */
  row: number;
  state: "learned" | "open" | "locked";
  /** Whole Essence. */
  price: number;
  effect: { kind: "site"; site: "Shrine" | "Well" } | { kind: "depth"; depth: 1 | 2 | 3 };
}

export const siteNode = (plan: ResearchPlan, site: "Shrine" | "Well") =>
  plan.nodes.find(({ effect }) => effect.kind === "site" && effect.site === site);

export const depthNode = (plan: ResearchPlan, depth: 1 | 2 | 3) =>
  plan.nodes.find(({ effect }) => effect.kind === "depth" && effect.depth === depth);

/** Whether the realm can research a castle row now: one is open and its Essence is held. The nav's Research dot. */
export const canResearchNow = (plan: ResearchPlan | undefined): boolean => {
  const essence = plan?.essence;
  if (!plan || essence === undefined) return false;
  return plan.nodes.some(({ state, price }) => state === "open" && price <= essence);
};
