import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { nativeQuestConstants as quest } from "@bibliothecadao/eternum/game-client";
import { questCatalog, type QuestId } from "@bibliothecadao/types";
import type { DayQuestFace } from "./day-banner-view";

const QUEST_ICONS = {
  [quest.HUNT]: "beast-cyclops",
  [quest.CAMPS]: "beast-troll",
  [quest.RIFTS]: "rift",
  [quest.RELICS]: "ruin",
  [quest.VETERANS]: "order-skill",
  [quest.FINDS]: "eye",
  [quest.REVEALS]: "explore",
  [quest.STAND]: "defend",
  [quest.LIGHTS]: "sun",
  [quest.CULL]: "skull",
} satisfies Record<QuestId, IconMeaning>;

export function dayQuestFace(id: QuestId): DayQuestFace {
  const quest = questCatalog.find((quest) => quest.id === id);
  if (!quest) throw new Error(`Missing quest ${id}`);
  return { icon: QUEST_ICONS[id], name: quest.name, unit: quest.unit };
}
