import { baneQuest, readWorldBane } from "../../utils/world-banes";
import { nativeQuestConstants as quests } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { baneQuests, RESOURCE_PRECISION, dailyQuests, StructureType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { dayOf } from "../../utils/days";
import { dailyQuest } from "../../utils/daily-quest";
import { rowInGameSyncScope } from "../../sync/model-manifest";

export function readDailyQuest(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const game_id = gameId;
  const rules = store.get("QuestRules", { game_id });
  if (!rules) return undefined;
  const scope = store.subscriptionScope().known;
  if (!scope) return undefined;
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
  const structure = store.get("Structure", { game_id, entity_id: home });
  if (!structure) return undefined;
  if (structure.base.category !== StructureType.Realm) throw new Error("A daily quest belongs to a Realm");
  const key = { game_id, home, day: day.index };
  const receiptScope = { ...key, account: structure.owner };
  const inScope = ["QuestProgress", "LaborGrant", "BaneGrant"].every((model) =>
    rowInGameSyncScope(model, receiptScope, scope),
  );
  if (!inScope) return undefined;
  const progress = store.requireOrAbsent("QuestProgress", key).known;
  if (!progress) return undefined;
  const bane = readWorldBane(store, game_id, home, day.index);
  const kind = bane ? baneQuest(bane.kind) : dailyQuest(game.seed, day.index);
  const quest = [...dailyQuests, ...baneQuests].find(({ id }) => id === kind);
  if (!quest) throw new Error(`Missing daily quest ${kind}`);
  const level = progress.completed_level || structure.base.level + 1;
  const countUnit = kind === quests.CULL ? BigInt(RESOURCE_PRECISION) : 1n;
  return {
    ...quest,
    day: day.index,
    target: bane
      ? store.require("BaneRules", { game_id }).quest_counts[(kind - quests.STAND) * 4 + level - 1]
      : BigInt(rules.base_counts[kind] * level),
    bane,
    bonusClaimed: store.get("BaneGrant", key) !== undefined,
    progress: progress.progress / countUnit,
    completed: Boolean(progress.completed_level),
    claimed: store.get("LaborGrant", key) !== undefined,
  };
}
