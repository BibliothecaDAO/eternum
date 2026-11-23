import {
  StructureType,
  beastModel,
  beastOf,
  siteBeastOf,
  type BeastFamily,
  type BeastIdle,
  type BeastModel,
  type BeastRow,
} from "@bibliothecadao/types";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { beastBand, type BeastBand } from "./frontier-beast-band";
import { expeditionDepth, hasSharedDeep, isGuardedSite, readExpeditionRules } from "./expeditions";

export type FrontierSpecies = BeastModel;
export interface FrontierBeast {
  beast: FrontierSpecies;
  name: string;
  scale: number;
  idle: BeastIdle;
}

const ROAMING_FAMILY: Record<BeastBand, BeastFamily> = { lowly: "herd", stronger: "band" };

function siteFamily(category: StructureType, band?: BeastBand): BeastFamily {
  if (category === StructureType.Beasts) {
    if (!band) throw new Error("Beast identity requires its initial strength band");
    return ROAMING_FAMILY[band];
  }
  if (category === StructureType.Camp) return "camp";
  if (category === StructureType.Rift) return "rift";
  if (category === StructureType.Ruin) return "ruin";
  throw new Error(`No Frontier beast guards structure category ${category}`);
}

const identityOf = (beast: BeastRow): FrontierBeast => ({
  beast: beastModel(beast),
  name: beast.name,
  scale: beast.scale,
  idle: beast.idle,
});

export function frontierBeast(depth: number, category = StructureType.Ruin, band?: BeastBand): FrontierBeast {
  return identityOf(beastOf(siteFamily(category, band), depth));
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
  site: Pick<NativeRows["ExpeditionSite"], "category" | "row" | "initial_guard_count">,
): FrontierBeast | undefined {
  const category = site.category;
  if (!isGuardedSite(category)) return undefined;
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error(`Frontier site ${entityId} stands without expedition rules`);
  const depth = expeditionDepth(rules, { y: site.row });
  const gameHasDeep = hasSharedDeep(store, gameId);
  if (category !== StructureType.Beasts) return identityOf(siteBeastOf(siteFamily(category), depth, gameHasDeep));
  const bounds = store.get("DepthRules", { game_id: gameId, depth });
  if (!bounds) throw new Error(`Frontier beast ${entityId} stands without depth rules`);
  const band = beastBand(site.initial_guard_count, bounds);
  return identityOf(siteBeastOf(siteFamily(category, band), depth, gameHasDeep));
}
