import { baneQuests, dailyQuests, RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { nativeQuestConstants as quests } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import { dayOf } from "../../utils/days";
import { dailyQuest } from "../../utils/daily-quest";
import { heldRealmForHome } from "../../utils/home-claim";
import { readDayBane, type DayBane } from "../../utils/world-banes";

/** A quest of the catalog: one of the seven daily quests, or a bane quest that replaces it on a bane day. */
type Quest = (typeof dailyQuests)[number] | (typeof baneQuests)[number];

/** The bane a day is under, and for a world bane whether its second reward was collected (null for a team bane). */
type BaneReading = DayBane & { secondClaimed: boolean | null };

/**
 * How far a home is in a day's quest in whole counts (the Cull in troops), what it pays and whether it was collected,
 * and the bane the day is under. Facts the store may not know yet.
 */
interface QuestReading {
  target: bigint;
  progress: bigint;
  completed: boolean;
  claimed: boolean;
  /** What the quest pays at the level that finishes it, in whole units: once, and again for a world bane ended. */
  reward: { labor: bigint; essence: bigint };
  bane: BaneReading | null;
}

/**
 * Today's quest for a home: which (the bane quest on a bane day; null while the day's bane cannot be told), and its
 * reading, known only when every row it rests on is present or known not to exist (a snapshot still loading leaves it
 * unknown, with the reason). None in a game without quests, before its first day or after its last.
 */
export function readDailyQuest(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const today = questCalendar(store, gameId, home, timestamp);
  return today && readQuestOnDay(store, today, today.day);
}

/**
 * The week of quests around today, as the quest bag deals them (one of each quest a week, days 1 to 7 of the season's
 * week), up to the season's last day: each day's quest and reading, today's among them, so a player sees what came and
 * what comes. A day gone or today reads its bane; a coming day shows the bag's quest, since nobody knows a bane's day
 * before it comes. None where readDailyQuest has none.
 */
export function readQuestWeek(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const today = questCalendar(store, gameId, home, timestamp);
  if (!today) return undefined;
  const first = today.day - (today.day % QUEST_WEEK);
  const days = Math.min(QUEST_WEEK, today.lastDay - first + 1);
  return {
    today: today.day,
    days: Array.from({ length: days }, (_, index) => readQuestOnDay(store, today, first + index)),
  };
}

/** The quests a week holds: the bag deals each of the seven once. */
const QUEST_WEEK = dailyQuests.length;

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
  const lastDay = dayOf(calendar, calendar.endAt - 1)!.index;
  return { game_id, home, seed: game.seed, rules, structure, day: day.index, lastDay };
}

/** One day's quest for the home and its reading: the bane quest under a bane, else the bag's quest for that day. */
function readQuestOnDay(
  store: NativeFactStore,
  at: NonNullable<ReturnType<typeof questCalendar>>,
  day: number,
): { day: number; quest: Quest | null; reading: NativeFactResult<QuestReading> } {
  const bane = day <= at.day ? readDayBane(store, at.game_id, at.home, day) : undefined;
  if (bane?.unknown !== undefined) return { day, quest: null, reading: { unknown: bane.unknown } };
  const dayBane = bane?.known ?? null;
  const quest = catalogQuest(dayBane ? dayBane.quest : dailyQuest(at.seed, day));
  return { day, quest, reading: readQuestFacts(store, { ...at, day }, at.rules, quest, dayBane) };
}

/** A quest of the catalog by the id the contract gives it; one the catalog lacks is a fault. */
function catalogQuest(id: number): Quest {
  const quest = [...dailyQuests, ...baneQuests].find((entry) => entry.id === id);
  if (!quest) throw new Error(`Missing quest ${id}`);
  return quest;
}

/** The quest's size at a Realm level (1 to 4), as banes.cairo's target sets it: the bane quests from BaneRules. */
function questTarget(
  store: NativeFactStore,
  game_id: number,
  rules: { base_counts: readonly number[] },
  quest: Quest,
  level: number,
) {
  if (quest.id < quests.QUEST_COUNT) {
    const base = rules.base_counts[quest.id];
    if (!base) throw new Error(`Missing daily quest ${quest.id}`);
    return BigInt(base * level);
  }
  const count = store.require("BaneRules", { game_id }).quest_counts[(quest.id - quests.STAND) * 4 + level - 1];
  if (count === undefined) throw new Error(`Missing bane quest ${quest.id} count at level ${level}`);
  return count;
}

/** Progress in whole counts: the Cull counts guard troops, which the chain keeps in resource precision. */
const wholeProgress = (quest: Quest, progress: bigint) =>
  quest.id === quests.CULL ? progress / BigInt(RESOURCE_PRECISION) : progress;

/**
 * The home's progress, its receipt and its labor bonus, each present or known not to exist; the first that is
 * neither leaves the whole reading unknown, so no zero, no missing receipt and no missing bonus is ever guessed.
 */
function readQuestFacts(
  store: NativeFactStore,
  at: { game_id: number; home: number; day: number; structure: { owner: bigint; base: { level: number } } },
  rules: { labor: bigint; essence: bigint; bonus_percent: number; base_counts: readonly number[] },
  quest: Quest,
  dayBane: DayBane | null,
): NativeFactResult<QuestReading> {
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
  const bane = readSecondReward(store, at, dayBane);
  if (!bane.known) return bane;
  // A finished quest keeps the level that finished it; a running one is sized to the Realm's level now (1 to 4).
  const level = progress.known.completed_level || structure.base.level + 1;
  return {
    known: {
      target: questTarget(store, game_id, rules, quest, level),
      progress: wholeProgress(quest, progress.known.progress),
      completed: progress.known.completed_level !== 0,
      claimed: claimed.known.present,
      reward: questReward(rules, level, bonus.known.present),
      bane: bane.known.reading,
    },
  };
}

/**
 * The day's bane with, for a world bane, whether its second reward was collected (BaneGrant, present or known absent):
 * quests.cairo pays the daily reward again once the Aspect ended a world bane. A team bane pays no second reward.
 */
function readSecondReward(
  store: NativeFactStore,
  at: { game_id: number; home: number; day: number; structure: { owner: bigint } },
  dayBane: DayBane | null,
): NativeFactResult<{ reading: BaneReading | null }> {
  if (!dayBane) return { known: { reading: null } };
  if (dayBane.source === "team") return { known: { reading: { ...dayBane, secondClaimed: null } } };
  const { game_id, home, day } = at;
  const granted = store.get("BaneGrant", { game_id, home, day });
  if (granted) return { known: { reading: { ...dayBane, secondClaimed: true } } };
  const absent = store.absenceKnown("BaneGrant", { game_id, home, day });
  return absent.known ? { known: { reading: { ...dayBane, secondClaimed: false } } } : { unknown: absent.unknown };
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
