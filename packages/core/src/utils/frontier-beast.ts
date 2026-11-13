import { StructureType, BEAST_NAMES, FALLEN_REALM_DEPTHS, ROAMING_BEASTS, SITE_GUARDS } from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { expeditionDepth, isGuardedSite, readExpeditionRules } from "./expeditions";

export type FrontierSpecies = keyof typeof BEAST_NAMES;
export interface FrontierBeast {
  beast: FrontierSpecies;
  name: string;
  scale: number;
}
export type BeastBand = "lowly" | "stronger";
/** One identity for model, plate and panel. Neither casualties nor reward rank can change it. */
export function frontierBeast(depth: number, category = StructureType.Ruin, band?: BeastBand): FrontierBeast {
  const entry = FALLEN_REALM_DEPTHS[depth];
  if (!entry) throw new Error(`No Frontier beast for depth ${depth}`);
  if (category === StructureType.Beasts) {
    if (!band) throw new Error("Beast identity requires its initial strength band");
    const roaming = ROAMING_BEASTS[band];
    return { ...roaming, name: BEAST_NAMES[roaming.beast] };
  }
  if (category === StructureType.Camp) return { ...SITE_GUARDS.camp, name: BEAST_NAMES[SITE_GUARDS.camp.beast] };
  if (category === StructureType.Rift) return { ...SITE_GUARDS.rift, name: BEAST_NAMES[SITE_GUARDS.rift.beast] };
  return { ...entry, name: BEAST_NAMES[entry.beast] };
}

export function readFrontierBeast(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  entityId: number,
): FrontierBeast | undefined {
  const site = store.get("ExpeditionSite", { game_id: gameId, entity_id: entityId });
  return site && siteFrontierBeast(store, gameId, entityId, site);
}

/** The site's guard from its own row (its kind, its depth, its initial strength) and the game's shared rules. */
export function siteFrontierBeast(
  store: Pick<NativeFactStore, "get">,
  gameId: number,
  entityId: number,
  site: Pick<NativeRows["ExpeditionSite"], "category" | "row" | "beast_kind">,
): FrontierBeast | undefined {
  const category = site.category;
  if (!isGuardedSite(category)) return undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error(`Frontier site ${entityId} stands without expedition rules`);
  const depth = expeditionDepth(rules, { y: site.row });
  if (category !== StructureType.Beasts) return frontierBeast(depth, category);
  const band = site.beast_kind === "Cyclops" ? "lowly" : site.beast_kind === "Wraith" ? "stronger" : undefined;
  if (!band) throw new Error(`Frontier beast ${entityId} has no drawn kind`);
  return frontierBeast(depth, category, band);
}
