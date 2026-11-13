import type { IconMeaning } from "@/ui/design-system/icon";
import { knownAmount } from "@/ui/utils/utils";
import {
  configManager,
  entityHomeNamespace,
  getBalance,
  getBuildingQuantity,
  liveHomeArmies,
  realmLearned,
  researchTier,
} from "@bibliothecadao/eternum";
import {
  nativeResearchConstants,
  safeInteger,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import { BuildingType, ResourcesIds } from "@bibliothecadao/types";
import { OPENING_MOMENTS, type OpeningMoment } from "@realms-world/identity";

/**
 * The interface that opens as you play (the frozen design, "The interface opens as you play"): each moment, the facts
 * that say a realm reached it, and the painting its one line wears. A moment's parts show once the realm's facts show
 * it, or once the account kept it (an army that fought is gone the next day, its fight is not): never a tutorial step.
 * The moments that open nothing yet (a skill point's boons, the spire's odds, a layer down, the City, a bane, the shop)
 * join the table in the change that brings their part.
 */
export const OPENING = {
  launch: { icon: "realm", reached: () => true },
  barracks: {
    icon: "barracks",
    reached: (store, realm) => getBuildingQuantity(realmIdOf(realm), BuildingType.ResourceKnightT1, store) > 0,
  },
  guard: { icon: "camp", reached: (store, realm) => foundAGuard(store, realm) },
  fight: { icon: "attack", reached: (store, realm, timestamp) => anArmyFought(store, realm, timestamp) },
  essence: { icon: "essence", reached: (store, realm, timestamp) => earnedEssence(store, realm, timestamp) },
  "well-lore": { icon: "well", reached: (store, realm) => hasLore(store, realm, nativeResearchConstants.ROW_WELL) },
  "shrine-lore": {
    icon: "shrine",
    reached: (store, realm) => hasLore(store, realm, nativeResearchConstants.ROW_SHRINE),
  },
  deep: { icon: "depth-3", reached: (store, realm, timestamp) => wentIntoTheDeep(store, realm, timestamp) },
} as const satisfies Record<
  OpeningMoment,
  {
    icon: IconMeaning;
    reached: (store: NativeFactStore, realm: NativeRows["Structure"], timestamp: number) => boolean;
  }
>;

/** The parts of the HUD that wait on a moment; every other part shows from launch. */
export const OPENING_PARTS = {
  /** Troops at home, on the strip and the realm panel. */
  "troops-store": "barracks",
  /** The build sheet's list of buildings; before it, the sheet offers the lit plot's first build only. */
  "building-list": "barracks",
  /** An army's XP, on its row, its card and its panel. */
  "army-xp": "fight",
  "essence-store": "essence",
  research: "essence",
  /** Today, with the week's quests, from the day's clock. */
  today: "essence",
  /** The realm's Glory, beside its rank on the realm panel and in a phone's purse. */
  glory: "deep",
} as const satisfies Record<string, OpeningMoment>;
export type OpeningPart = keyof typeof OPENING_PARTS;

/** The moments the realm's facts show now, in the table's order. */
export const momentsReached = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  timestamp: number,
): OpeningMoment[] => OPENING_MOMENTS.filter((moment) => OPENING[moment].reached(store, realm, timestamp));

const realmIdOf = (realm: NativeRows["Structure"]) => safeInteger(realm.entity_id);

/** A guarded site found on the realm's own maps, cleared since or not. */
const foundAGuard = (store: NativeFactStore, realm: NativeRows["Structure"]) => {
  const home = entityHomeNamespace(realm.entity_id);
  for (const site of store.inGame("ExpeditionSite", realm.game_id))
    if (entityHomeNamespace(site.entity_id) === home) return true;
  return false;
};

/** One of the realm's armies today holds XP: it won a fight. */
const anArmyFought = (store: NativeFactStore, realm: NativeRows["Structure"], timestamp: number) =>
  liveHomeArmies(store, realmIdOf(realm), configManager.getActiveGameId(), timestamp).some(
    (army) => (store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id })?.xp ?? 0) > 0,
  );

/** The design's moment: a quest reward collected (its receipt), or Essence held. */
const earnedEssence = (store: NativeFactStore, realm: NativeRows["Structure"], timestamp: number) => {
  for (const grant of store.inGame("LaborGrant", realm.game_id)) if (grant.home === realm.entity_id) return true;
  return (knownAmount(getBalance(realmIdOf(realm), ResourcesIds.Essence, timestamp, store).balance) ?? 0) > 0;
};

/** One of the realm's armies stands in the Deep today, or the realm earned there before (its race row). */
const wentIntoTheDeep = (store: NativeFactStore, realm: NativeRows["Structure"], timestamp: number) =>
  store.get("RaceMember", { game_id: realm.game_id, entity_id: realm.entity_id }) !== undefined ||
  liveHomeArmies(store, realmIdOf(realm), realm.game_id, timestamp).some(
    (army) => store.get("DeepArmy", { game_id: army.game_id, explorer_id: army.explorer_id }) !== undefined,
  );

const hasLore = (store: NativeFactStore, realm: NativeRows["Structure"], row: number) => {
  const learned = realmLearned(store, realm.game_id, realm.entity_id);
  return learned !== undefined && researchTier(learned, row) > 0;
};
