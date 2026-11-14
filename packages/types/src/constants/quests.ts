import {
  nativeQuestConstants as quest,
  nativeBaneConstants as bane,
} from "../../../../contracts/l3/world-native/schema/client.gen";

export const dailyQuests = [
  { id: quest.HUNT, unit: "herds or bands", name: "The Hunt", objective: "Clear Cyclops herds or Wraith bands" },
  { id: quest.CAMPS, unit: "camps", name: "Camp-breakers", objective: "Clear Troll camps" },
  { id: quest.RIFTS, unit: "rifts", name: "Rift-closers", objective: "Clear Dark fey rifts" },
  { id: quest.RELICS, unit: "ruins", name: "Relic-seekers", objective: "Find ruins" },
  { id: quest.VETERANS, unit: "skill points", name: "Veterans", objective: "Earn skill points" },
  { id: quest.FINDS, unit: "sites", name: "Pathfinders", objective: "Find sites" },
  { id: quest.REVEALS, unit: "tiles", name: "Cartographers", objective: "Reveal tiles" },
] as const;

export const baneQuests = [
  { id: quest.STAND, unit: "sites", name: "The Stand", objective: "Clear guarded sites" },
  { id: quest.LIGHTS, unit: "tiles", name: "The Lights", objective: "Reveal tiles" },
  { id: quest.CULL, unit: "troops", name: "The Cull", objective: "Defeat guard troops" },
] as const;

export const questCatalog = [...dailyQuests, ...baneQuests] as const;
export type QuestId = (typeof questCatalog)[number]["id"];

export const worldBanes = [
  { id: bane.BLOOD_MOON, name: "Blood Moon", quest: bane.BLOOD_MOON_QUEST },
  { id: bane.MIST_TIDE, name: "Mist Tide", quest: bane.MIST_TIDE_QUEST },
  { id: bane.ASH_FALL, name: "Ash Fall", quest: bane.ASH_FALL_QUEST },
] as const;
export type WorldBaneId = (typeof worldBanes)[number]["id"];
