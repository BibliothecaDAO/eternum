import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { knownBalance } from "@/ui/utils/utils";
import { getBalance, learnedResearchNodes } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { type BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import { readBuildingEffect } from "../build/build-options";
import { effectGain } from "../build/effect-gain";
import type { ResearchNodeView, ResearchPlan } from "./research-plan";

const RESEARCH_MODELS = [
  "RealmKnowledge",
  "ResearchNode",
  "BuildingTierRule",
  "BuildingRule",
  "ResourceBalance",
  "ResourceProduction",
] as const;

/** The realm's research tree as its sheet draws it, from its facts; unknown while the realm's knowledge is. */
export const useResearchPlan = (realm: NativeRows["Structure"]): ResearchPlan | undefined => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const revision = useNativeRevision(RESEARCH_MODELS);
  return useMemo(() => readResearchPlan(setup.store, realm, tick), [realm, revision, setup.store, tick]);
};

/**
 * Each node of the game's table in order, learned (core's learnedResearchNodes), open once every prerequisite is
 * learned, else locked; its Essence price; and for a building tier what one building of it gives before and with it.
 */
export const readResearchPlan = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  tick: number,
): ResearchPlan | undefined => {
  const learned = learnedResearchNodes(store, realm.game_id, realm.entity_id);
  if (!learned) return undefined;
  const known = new Set(learned.map(({ node }) => node));
  const nodes = [...store.inGame("ResearchNode", realm.game_id)].toSorted((left, right) => left.node - right.node);
  return {
    essence: knownBalance(getBalance(realm.entity_id, ResourcesIds.Essence, tick, store).balance),
    nodes: nodes.map((node) => {
      const effect = nodeEffect(node);
      return {
        node: node.node,
        state: known.has(node.node) ? "learned" : prerequisitesLearned(node.prerequisites, known) ? "open" : "locked",
        price: Number(node.essence_cost) / RESOURCE_PRECISION,
        effect,
        gain: effect.kind === "tier" ? tierGain(store, realm, effect.category, effect.tier) : undefined,
      };
    }),
  };
};

const prerequisitesLearned = (prerequisites: number, known: ReadonlySet<number>): boolean => {
  for (let node = 0, mask = prerequisites; mask !== 0; node++, mask >>>= 1)
    if (mask & 1 && !known.has(node)) return false;
  return true;
};

const nodeEffect = ({ effect }: NativeRows["ResearchNode"]): ResearchNodeView["effect"] => {
  if ("BuildingTier" in effect)
    return {
      kind: "tier",
      category: effect.BuildingTier[0] as BuildingType,
      tier: effect.BuildingTier[1] as 2 | 3,
    };
  if ("MapContent" in effect) return { kind: "site", site: effect.MapContent };
  return { kind: "depth", depth: effect.Depth as 1 | 2 | 3 };
};

/** What one building of a category gives at the tier before this one and at this one. */
const tierGain = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  category: BuildingType,
  tier: 2 | 3,
): ResearchNodeView["gain"] => {
  const now = effectGain(readBuildingEffect(store, realm, category, (tier - 1) as 1 | 2, 1));
  const next = effectGain(readBuildingEffect(store, realm, category, tier, 1));
  return { icon: next.icon, now: now.value, next: next.value };
};
