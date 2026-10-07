import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { knownBalance } from "@/ui/utils/utils";
import { getBalance, learnedResearchNodes } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { type BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo } from "react";
import type { ResearchNodeView, ResearchPlan } from "./research-plan";

const RESEARCH_MODELS = [
  "RealmKnowledge",
  "ResearchNode",
  "BuildingTierRule",
  "BuildingRule",
  "ResourceBalance",
  "ResourceProduction",
] as const;

/** The realm's research tree as its sheet draws it, from its facts; unknown while the realm's knowledge is (or with no realm). */
export const useResearchPlan = (realm: NativeRows["Structure"] | null): ResearchPlan | undefined => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  const revision = useNativeRevision(RESEARCH_MODELS);
  return useMemo(
    () => (realm ? readResearchPlan(setup.store, realm, tick) : undefined),
    [realm, revision, setup.store, tick],
  );
};

/**
 * Each node of the game's table in order, learned (core's learnedResearchNodes), open once every prerequisite is
 * learned, else locked; and its Essence price.
 */
const readResearchPlan = (
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
