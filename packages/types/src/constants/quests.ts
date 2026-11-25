import {
  nativeQuestConstants as quest,
  nativeBaneConstants as bane,
} from "../../../../contracts/l3/world-native/schema/balance.gen";

export const dailyQuests = [
  { id: quest.HUNT, name: "The Hunt", verb: "Clear", unit: { one: "Beast site", many: "Beast sites" } },
  { id: quest.CAMPS, name: "Camp-breakers", verb: "Clear", unit: { one: "Camp", many: "Camps" } },
  { id: quest.RIFTS, name: "Rift-closers", verb: "Clear", unit: { one: "Rift", many: "Rifts" } },
  { id: quest.RELICS, name: "Relic-seekers", verb: "Find", unit: { one: "Ruin", many: "Ruins" } },
  { id: quest.VETERANS, name: "Veterans", verb: "Swear", unit: { one: "Oath", many: "Oaths" } },
  { id: quest.FINDS, name: "Pathfinders", verb: "Find", unit: { one: "site", many: "sites" } },
  { id: quest.REVEALS, name: "Cartographers", verb: "Reveal", unit: { one: "tile", many: "tiles" } },
] as const;

export const baneQuests = [
  { id: quest.STAND, name: "The Stand", verb: "Clear", unit: { one: "guarded site", many: "guarded sites" } },
  { id: quest.LIGHTS, name: "The Lights", verb: "Reveal", unit: { one: "tile", many: "tiles" } },
  { id: quest.CULL, name: "The Cull", verb: "Defeat", unit: { one: "guard troop", many: "guard troops" } },
] as const;

export const questCatalog = [...dailyQuests, ...baneQuests] as const;
export type QuestLine = Pick<(typeof questCatalog)[number], "verb" | "unit">;
export type QuestUnit = QuestLine["unit"];
export type QuestId = (typeof questCatalog)[number]["id"];

export const worldBanes = [
  { id: bane.BLOOD_MOON, name: "Blood Moon", quest: bane.BLOOD_MOON_QUEST },
  { id: bane.MIST_TIDE, name: "Mist Tide", quest: bane.MIST_TIDE_QUEST },
  { id: bane.ASH_FALL, name: "Ash Fall", quest: bane.ASH_FALL_QUEST },
] as const;
