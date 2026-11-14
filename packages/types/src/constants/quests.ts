import { nativeQuestConstants as quest } from "../../../../contracts/l3/world-native/schema/client.gen";

export const dailyQuests = [
  { id: quest.HUNT, unit: "herds or bands", name: "The Hunt", objective: "Clear Cyclops herds or Wraith bands" },
  { id: quest.CAMPS, unit: "camps", name: "Camp-breakers", objective: "Clear Troll camps" },
  { id: quest.RIFTS, unit: "rifts", name: "Rift-closers", objective: "Clear Dark fey rifts" },
  { id: quest.RELICS, unit: "ruins", name: "Relic-seekers", objective: "Find ruins" },
  { id: quest.VETERANS, unit: "skill points", name: "Veterans", objective: "Earn skill points" },
  { id: quest.FINDS, unit: "sites", name: "Pathfinders", objective: "Find sites" },
  { id: quest.REVEALS, unit: "tiles", name: "Cartographers", objective: "Reveal tiles" },
] as const;

export type DailyQuestId = (typeof dailyQuests)[number]["id"];
