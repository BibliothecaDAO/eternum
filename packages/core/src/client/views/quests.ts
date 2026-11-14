import { SCOPE_INPUT_MODELS } from "../../sync/model-manifest";
import { dailyQuests, StructureType } from "@bibliothecadao/types";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import { dayOf } from "../../utils/days";
import { dailyQuest } from "../../utils/daily-quest";
import { heldRealmForHome } from "../../utils/home-claim";

export const DAILY_QUEST_MODELS = [
  ...SCOPE_INPUT_MODELS,
  "QuestRules",
  "QuestProgress",
  "LaborGrant",
  "CampaignHome",
  "SettledRealm",
] as const;

/** How far a home is in today's quest, what it pays and whether it was collected: facts the store may not know yet. */
interface DailyQuestReading {
  target: bigint;
  progress: bigint;
  completed: boolean;
  claimed: boolean;
  /** What the quest pays at the level that finishes it, in whole units. */
  reward: { labor: bigint; essence: bigint };
}

/**
 * Today's quest for a home: what the rules and the calendar name (always known once the game's rules are), and its
 * reading, known only when every row it rests on is present or known not to exist (a snapshot still loading leaves it
 * unknown, with the reason). None in a game without quests, before its first day or after its last.
 */
export function readDailyQuest(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const today = questCalendar(store, gameId, home, timestamp);
  return today && readQuestOnDay(store, today);
}

/** The game's quest rules, today's index and the home, once the game has quests and the season has a today. */
function questCalendar(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const game_id = gameId;
  const rules = store.get("QuestRules", { game_id });
  if (!rules) return undefined;
  const game = store.require("GameRegistry", { game_id });
  const clock = store.require("SliceRules", { game_id });
  const calendar = {
    seed: game.seed,
    startMainAt: Number(game.start_main_at),
    endAt: Number(game.end_at),
    dayUnitSeconds: clock.day_unit_seconds,
  };
  const day = dayOf(calendar, timestamp);
  if (!day) return undefined;
  const structure = store.require("Structure", { game_id, entity_id: home });
  if (structure.base.category !== StructureType.Realm) throw new Error("A daily quest belongs to a Realm");
  return { game_id, home, seed: game.seed, rules, structure, day: day.index };
}

/** One day's quest for the home: the bag's quest for that day and its reading. */
function readQuestOnDay(store: NativeFactStore, at: NonNullable<ReturnType<typeof questCalendar>>) {
  const { day } = at;
  const kind = dailyQuest(at.seed, day);
  const quest = dailyQuests.find(({ id }) => id === kind);
  if (!quest || !at.rules.base_counts[kind]) throw new Error(`Missing daily quest ${kind}`);
  return {
    ...quest,
    day,
    reading: readQuestFacts(store, at, at.rules, at.rules.base_counts[kind]),
  };
}

/**
 * The home's progress, its receipt and its labor bonus, each present or known not to exist; the first that is
 * neither leaves the whole reading unknown, so no zero, no missing receipt and no missing bonus is ever guessed.
 */
function readQuestFacts(
  store: NativeFactStore,
  at: { game_id: number; home: number; day: number; structure: { owner: bigint; base: { level: number } } },
  rules: { labor: bigint; essence: bigint; bonus_percent: number },
  baseCount: number,
): NativeFactResult<DailyQuestReading> {
  const { game_id, home, day, structure } = at;
  const progress = store.requireOrAbsent("QuestProgress", { game_id, home, day });
  if (!progress.known) return { unknown: progress.unknown };
  const claimed = presentOrKnownAbsent(store, "LaborGrant", store.get("LaborGrant", { game_id, home, day }), {
    game_id,
    home,
    day,
    account: structure.owner,
  });
  if (!claimed.known) return claimed;
  const bonus = readLaborBonus(store, game_id, home);
  if (!bonus.known) return bonus;
  // A finished quest keeps the level that finished it; a running one is sized to the Realm's level now (1 to 4).
  const level = progress.known.completed_level || structure.base.level + 1;
  return {
    known: {
      target: BigInt(baseCount * level),
      progress: progress.known.progress,
      completed: progress.known.completed_level !== 0,
      claimed: claimed.known.present,
      reward: questReward(rules, level, bonus.known.present),
    },
  };
}

/**
 * The labor bonus as quests.cairo's labor_bonus grants it: a campaign home, or the home of a held Realm. Either row,
 * when missing, must be known not to exist.
 */
function readLaborBonus(store: NativeFactStore, gameId: number, home: number): NativeFactResult<{ present: boolean }> {
  const campaign = presentOrKnownAbsent(store, "CampaignHome", store.get("CampaignHome", { game_id: gameId, home }), {
    game_id: gameId,
    home,
  });
  if (!campaign.known || campaign.known.present) return campaign;
  const held = heldRealmForHome(store, { gameId, entityId: home }) !== null;
  return presentOrKnownAbsent(store, "SettledRealm", held || undefined, { game_id: gameId, home });
}

function presentOrKnownAbsent(
  store: NativeFactStore,
  model: "LaborGrant" | "CampaignHome" | "SettledRealm",
  present: unknown,
  row: Record<string, unknown>,
): NativeFactResult<{ present: boolean }> {
  if (present) return { known: { present: true } };
  const absence = store.absenceKnown(model, row);
  return absence.known ? { known: { present: false } } : { unknown: absence.unknown };
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
