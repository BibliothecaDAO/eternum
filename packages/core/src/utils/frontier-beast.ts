import { StructureType, RESOURCE_PRECISION, BEAST_NAMES } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { expeditionDepth, readExpeditionRules } from "./expeditions";

export type FrontierSpecies = keyof typeof BEAST_NAMES;
export interface FrontierBeast {
  beast: FrontierSpecies;
  name: string;
  scale: number;
}
export const FALLEN_REALM_DEPTHS: readonly { beast: FrontierSpecies; scale: number }[] = [
  { beast: "troll", scale: 1.2 },
  { beast: "wyvern", scale: 1.35 },
  { beast: "hydra", scale: 1.45 },
  { beast: "hydra", scale: 1.7 },
];
export type BeastBand = "lowly" | "stronger";
const ROAMING_BEASTS = { lowly: { beast: "minotaur", scale: 0.8 }, stronger: { beast: "cyclops", scale: 1 } } as const;
type BeastBounds = Pick<
  NativeRows["DepthRules"],
  "beast_weak_lower" | "beast_weak_upper" | "beast_strong_lower" | "beast_strong_upper"
>;

/** Initial guard strength identifies the encounter even after casualties. */
export function beastBand(initialCount: bigint, bounds: BeastBounds): BeastBand {
  const precision = BigInt(RESOURCE_PRECISION);
  const weakLower = BigInt(bounds.beast_weak_lower) * precision;
  const weakUpper = BigInt(bounds.beast_weak_upper) * precision;
  const strongLower = BigInt(bounds.beast_strong_lower) * precision;
  const strongUpper = BigInt(bounds.beast_strong_upper) * precision;
  if (weakLower <= 0n || weakUpper < weakLower || strongLower <= weakUpper || strongUpper < strongLower)
    throw new Error("Beast depth rules require positive, separate strength ranges");
  if (initialCount >= weakLower && initialCount <= weakUpper) return "lowly";
  if (initialCount >= strongLower && initialCount <= strongUpper) return "stronger";
  throw new Error(`Initial beast strength ${initialCount} is outside its depth ranges`);
}

/** One identity for model, plate and panel. Neither casualties nor reward rank can change it. */
export function frontierBeast(depth: number, category = StructureType.Ruin, band?: BeastBand): FrontierBeast {
  const entry = FALLEN_REALM_DEPTHS[depth];
  if (!entry) throw new Error(`No Frontier beast for depth ${depth}`);
  if (category === StructureType.Beasts) {
    if (!band) throw new Error("Beast identity requires its initial strength band");
    const roaming = ROAMING_BEASTS[band];
    return { ...roaming, name: BEAST_NAMES[roaming.beast] };
  }
  return {
    beast: entry.beast,
    scale: category === StructureType.Ruin ? entry.scale : 0.85,
    name: BEAST_NAMES[entry.beast],
  };
}

export function readFrontierBeast(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  entityId: number,
): FrontierBeast | undefined {
  const site = store.get("ExpeditionSite", { game_id: gameId, entity_id: entityId });
  if (!site) return undefined;
  const category = site.category;
  if (![StructureType.Ruin, StructureType.Camp, StructureType.Rift, StructureType.Beasts].includes(category))
    return undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error(`Frontier site ${entityId} stands without expedition rules`);
  const depth = expeditionDepth(rules, { y: site.row });
  if (category !== StructureType.Beasts) return frontierBeast(depth, category);
  const bounds = store.get("DepthRules", { game_id: gameId, depth });
  if (!bounds) throw new Error(`Frontier beast ${entityId} stands without depth rules`);
  return frontierBeast(depth, category, beastBand(site.initial_guard_count, bounds));
}
