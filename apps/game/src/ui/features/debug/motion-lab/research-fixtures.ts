import type { ResearchNodeView, ResearchPlan } from "@/ui/features/frontier/research/research-plan";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";

/**
 * Frontier's research table as its preset publishes it (config/source/frontier/native.ts, t5), learned bits as a mask.
 * A lab fixture only: the live sheet is built from RealmKnowledge and ResearchNode by core's research reader.
 */
const NODES: readonly { node: number; prerequisites: number; price: number; effect: ResearchNodeView["effect"] }[] = [
  { node: 0, prerequisites: 0, price: 150, effect: { kind: "tier", category: BuildingType.ResourceWheat, tier: 2 } },
  {
    node: 1,
    prerequisites: 1 << 0,
    price: 12_000,
    effect: { kind: "tier", category: BuildingType.ResourceWheat, tier: 3 },
  },
  {
    node: 2,
    prerequisites: 0,
    price: 3_000,
    effect: { kind: "tier", category: BuildingType.ResourceKnightT1, tier: 2 },
  },
  {
    node: 3,
    prerequisites: 1 << 2,
    price: 40_000,
    effect: { kind: "tier", category: BuildingType.ResourceKnightT1, tier: 3 },
  },
  { node: 4, prerequisites: 0, price: 1_000, effect: { kind: "tier", category: BuildingType.Storehouse, tier: 2 } },
  {
    node: 5,
    prerequisites: 1 << 4,
    price: 15_000,
    effect: { kind: "tier", category: BuildingType.Storehouse, tier: 3 },
  },
  { node: 6, prerequisites: 0, price: 400, effect: { kind: "tier", category: BuildingType.WorkersHut, tier: 2 } },
  {
    node: 7,
    prerequisites: 1 << 6,
    price: 12_000,
    effect: { kind: "tier", category: BuildingType.WorkersHut, tier: 3 },
  },
  { node: 8, prerequisites: 0, price: 2_000, effect: { kind: "site", site: "Shrine" } },
  { node: 9, prerequisites: 0, price: 6_000, effect: { kind: "site", site: "Well" } },
  { node: 10, prerequisites: 0, price: 80_000, effect: { kind: "depth", depth: 1 } },
  { node: 11, prerequisites: 1 << 10, price: 200_000, effect: { kind: "depth", depth: 2 } },
  { node: 12, prerequisites: 1 << 11, price: 450_000, effect: { kind: "depth", depth: 3 } },
];

/** What each building tier changes, as the tier rules' multipliers give it on the lab's buildings. */
const GAINS: Partial<Record<number, ResearchNodeView["gain"]>> = {
  0: { icon: `/images/resources/${ResourcesIds.Wheat}.png`, now: 300, next: 600 },
  1: { icon: `/images/resources/${ResourcesIds.Wheat}.png`, now: 600, next: 1_200 },
  4: { icon: `/images/resources/${ResourcesIds.Essence}.png`, now: 10_000, next: 20_000 },
  6: { icon: "/image-icons/ui-person.png", now: 6, next: 12 },
  7: { icon: "/image-icons/ui-person.png", now: 12, next: 18 },
};

export const researchPlanFixture = (learned: number, essence: number): ResearchPlan => ({
  essence,
  nodes: NODES.map(({ node, prerequisites, price, effect }) => ({
    node,
    price,
    effect,
    gain: GAINS[node],
    state: learned & (1 << node) ? "learned" : (learned & prerequisites) === prerequisites ? "open" : "locked",
  })),
});
