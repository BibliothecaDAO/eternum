import { dailyQuests, StructureType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { dayOf } from "../../utils/days";
import { dailyQuest } from "../../utils/daily-quest";

export function readDailyQuest(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const game_id = gameId;
  const rules = store.get("QuestRules", { game_id });
  if (!rules) return undefined;
  const game = store.require("GameRegistry", { game_id });
  const clock = store.require("SliceRules", { game_id });
  const day = dayOf(
    {
      seed: game.seed,
      startMainAt: Number(game.start_main_at),
      endAt: Number(game.end_at),
      dayUnitSeconds: clock.day_unit_seconds,
    },
    timestamp,
  );
  if (!day) return undefined;
  const structure = store.require("Structure", { game_id, entity_id: home });
  if (structure.base.category !== StructureType.Realm) throw new Error("A daily quest belongs to a Realm");
  const kind = dailyQuest(game.seed, day.index);
  const quest = dailyQuests.find(({ id }) => id === kind);
  if (!quest || !rules.base_counts[kind]) throw new Error(`Missing daily quest ${kind}`);
  const progress = store.get("QuestProgress", { game_id, home, day: day.index });
  const level = progress?.completed_level || structure.base.level + 1;
  return {
    ...quest,
    day: day.index,
    target: BigInt(rules.base_counts[kind] * level),
    progress: progress?.progress ?? 0n,
    completed: Boolean(progress?.completed_level),
    claimed: store.get("LaborGrant", { game_id, home, day: day.index }) !== undefined,
  };
}
