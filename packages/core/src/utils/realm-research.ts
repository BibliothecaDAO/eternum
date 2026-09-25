import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

/** Unknown realm knowledge remains unknown; learned bits must resolve through the game's node table. */
export function learnedResearchNodes(
  store: Pick<NativeFactStore, "get" | "require">,
  gameId: number,
  structureId: number,
): NativeRows["ResearchNode"][] | undefined {
  const knowledge = store.get("RealmKnowledge", { game_id: gameId, structure_id: structureId });
  if (!knowledge) return undefined;
  const nodes: NativeRows["ResearchNode"][] = [];
  let learned = knowledge.learned;
  for (let node = 0; learned !== 0; node++, learned >>>= 1) {
    if (learned & 1) nodes.push(store.require("ResearchNode", { game_id: gameId, node }));
  }
  return nodes;
}

export function researchedDepths(
  store: Pick<NativeFactStore, "get" | "require">,
  gameId: number,
  structureId: number,
): number[] | undefined {
  return learnedResearchNodes(store, gameId, structureId)
    ?.flatMap(({ effect }) => ("Depth" in effect ? [effect.Depth] : []))
    .sort((a, b) => a - b);
}

export function researchedBuildingTier(
  store: Pick<NativeFactStore, "get" | "require">,
  gameId: number,
  structureId: number,
  category: number,
): number | undefined {
  const nodes = learnedResearchNodes(store, gameId, structureId);
  if (!nodes) return undefined;
  return nodes.reduce(
    (tier, { effect }) =>
      "BuildingTier" in effect && effect.BuildingTier[0] === category ? Math.max(tier, effect.BuildingTier[1]) : tier,
    1,
  );
}
