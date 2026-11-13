import {
  nativeBaneConstants as bane,
  nativeQuestConstants as quest,
} from "../../../../contracts/l3/world-native/schema/client.gen";

export const dailyQuests = [
  { id: quest.HUNT, name: "The Hunt", objective: "Clear Cyclops herds or Wraith bands", baseCount: 1 },
  { id: quest.CAMPS, name: "Camp-breakers", objective: "Clear Troll camps", baseCount: 1 },
  { id: quest.RIFTS, name: "Rift-closers", objective: "Clear Dark fey rifts", baseCount: 1 },
  { id: quest.RELICS, name: "Relic-seekers", objective: "Find ruins", baseCount: 1 },
  { id: quest.VETERANS, name: "Veterans", objective: "Earn skill points", baseCount: 1 },
  { id: quest.FINDS, name: "Pathfinders", objective: "Find sites", baseCount: 2 },
  { id: quest.REVEALS, name: "Cartographers", objective: "Reveal tiles", baseCount: 15 },
] as const;

export const baneQuests = [
  { id: quest.STAND, name: "The Stand", objective: "Clear guarded sites" },
  { id: quest.LIGHTS, name: "The Lights", objective: "Reveal tiles" },
  { id: quest.CULL, name: "The Cull", objective: "Defeat guard troops" },
] as const;

/** The mist's three world banes (the frozen design's Banes and Triumphs), each with the bane quest it brings. */
export const worldBanes = [
  { id: bane.BLOOD_MOON, name: "Blood Moon", quest: quest.STAND },
  { id: bane.MIST_TIDE, name: "Mist Tide", quest: quest.LIGHTS },
  { id: bane.ASH_FALL, name: "Ash Fall", quest: quest.CULL },
] as const;
