import { dailyQuests, StructureType } from "@bibliothecadao/types";
import type { NativeFactStore } from "../native-fact-store";
import { dayOf } from "../../utils/days";
import { dailyQuest } from "../../utils/daily-quest";
import { heldRealmForHome } from "../../utils/home-claim";

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
    reward: questReward(rules, level, hasLaborBonus(store, game_id, home)),
    ...quest,
    day: day.index,
    target: BigInt(rules.base_counts[kind] * level),
    progress: progress?.progress ?? 0n,
    completed: Boolean(progress?.completed_level),
    claimed: store.get("LaborGrant", { game_id, home, day: day.index }) !== undefined,
  };
}

/**
 * What the quest pays at a Realm level (1 to 4), in whole units, as quests.cairo's reward computes it: the base labor
 * and Essence doubled at each level above the first, the labor at the bonus percent for a home that has it.
 */
function questReward(
  rules: { labor: bigint; essence: bigint; bonus_percent: number },
  level: number,
  bonus: boolean,
): { labor: bigint; essence: bigint } {
  const multiplier = 1n << BigInt(level - 1);
  const percent = BigInt(bonus ? rules.bonus_percent : 100);
  return { labor: (rules.labor * multiplier * percent) / 100n, essence: rules.essence * multiplier };
}

/** The labor bonus as quests.cairo's labor_bonus grants it: a campaign home, or the home of a held Realm. */
function hasLaborBonus(store: NativeFactStore, gameId: number, home: number): boolean {
  return (
    store.get("CampaignHome", { game_id: gameId, home }) !== undefined ||
    heldRealmForHome(store, { gameId, entityId: home }) !== null
  );
}
