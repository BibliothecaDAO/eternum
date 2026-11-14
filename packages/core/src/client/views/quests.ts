import { SCOPE_INPUT_MODELS } from "../../sync/model-manifest";
import { questCatalog, RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { nativeQuestConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactResult, NativeFactStore } from "../native-fact-store";
import { dayOf } from "../../utils/days";
import { dailyQuest } from "../../utils/daily-quest";
import { heldRealmForHome } from "../../utils/home-claim";
import { BANE_MODELS, readBaneDay, type BaneDay } from "./banes";

export const DAILY_QUEST_MODELS = [
  ...SCOPE_INPUT_MODELS, ...BANE_MODELS,
  "QuestRules", "QuestProgress", "LaborGrant", "BaneGrant", "CampaignHome", "SettledRealm",
] as const;

/** Unknown recorded rolls leave the quest itself unknown; no ordinary quest is invented while loading. */
export function readDailyQuest(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const at = questCalendar(store, gameId, home, timestamp);
  return at && { day: at.day.index, reading: readQuestOnDay(store, at) };
}

function questCalendar(store: NativeFactStore, gameId: number, home: number, timestamp: number) {
  const game_id = gameId;
  const rules = store.get("QuestRules", { game_id });
  if (!rules) return undefined;
  const game = store.require("GameRegistry", { game_id });
  const clock = store.require("SliceRules", { game_id });
  const day = dayOf({
    seed: game.seed, startMainAt: Number(game.start_main_at),
    endAt: Number(game.end_at), dayUnitSeconds: clock.day_unit_seconds,
  }, timestamp);
  if (!day) return undefined;
  const structure = store.require("Structure", { game_id, entity_id: home });
  if (structure.base.category !== StructureType.Realm) throw new Error("A daily quest belongs to a Realm");
  return { game_id, home, seed: game.seed, rules, structure, day, timestamp };
}

type QuestAt = NonNullable<ReturnType<typeof questCalendar>>;
type Reward = { labor: bigint; essence: bigint };
interface QuestReading {
  quest: (typeof questCatalog)[number];
  bane: BaneDay | null;
  target: bigint;
  progress: bigint;
  state: "running" | "done" | "collected" | "again";
  /** Resource precision for the next collection, or the exact received total once nothing waits. */
  reward: Reward;
  /** The actual amounts, in resource precision, including storage-cap clipping. */
  receipts: { ordinary: NativeRows["LaborGrant"] | undefined; bonus: NativeRows["BaneGrant"] | undefined };
}

function readQuestOnDay(store: NativeFactStore, at: QuestAt): NativeFactResult<QuestReading> {
  const identity = readBaneDay(store, at.game_id, at.home, at.day);
  if (!identity.known) return identity;
  const bane = identity.known.bane;
  const kind = bane?.quest ?? dailyQuest(at.seed, at.day.index);
  const quest = questCatalog.find(({ id }) => id === kind);
  if (!quest) throw new Error(`Missing quest ${kind}`);
  const facts = readQuestFacts(store, at, bane);
  if (!facts.known) return facts;
  const { progress, receipts, bonus } = facts.known;
  const level = progress.completed_level || at.structure.base.level + 1;
  const won = bane?.type === "world" && bane.endedAt !== 0 && bane.endedAt <= at.timestamp;
  const grants = (receipts.ordinary ? 0 : 1) + (won && !receipts.bonus ? 1 : 0);
  const state = progress.completed_level === 0 ? "running"
    : !receipts.ordinary ? "done" : grants > 0 ? "again" : "collected";
  const reward = grants === 0 ? receivedReward(receipts) : questReward(at.rules, level, bonus, grants);
  return { known: {
    quest, bane, target: questTarget(store, at, kind, level), progress: progress.progress, state, reward, receipts,
  } };
}

function questTarget(store: NativeFactStore, at: QuestAt, kind: number, level: number): bigint {
  if (kind < nativeQuestConstants.QUEST_COUNT) {
    const base = at.rules.base_counts[kind];
    if (!base) throw new Error(`Missing ordinary quest target ${kind}`);
    return BigInt(base) * BigInt(level);
  }
  const rules = store.require("BaneRules", { game_id: at.game_id });
  const target = rules.quest_counts[(kind - nativeQuestConstants.STAND) * 4 + level - 1];
  if (!target) throw new Error(`Missing bane quest target ${kind} at level ${level}`);
  return target;
}

function readQuestFacts(store: NativeFactStore, at: QuestAt, bane: BaneDay | null) {
  const { game_id, home } = at;
  const key = { game_id, home, day: at.day.index };
  const progress = store.requireOrAbsent("QuestProgress", key);
  if (!progress.known) return { unknown: progress.unknown };
  const ordinary = readReceipt(store, "LaborGrant", key, at.structure.owner);
  if (!ordinary.known) return ordinary;
  const extra: NativeFactResult<{ row: NativeRows["BaneGrant"] | undefined }> = bane?.type === "world"
    ? readReceipt(store, "BaneGrant", key, at.structure.owner) : { known: { row: undefined } };
  if (!extra.known) return extra;
  const bonus = readLaborBonus(store, game_id, home);
  if (!bonus.known) return bonus;
  return { known: {
    progress: progress.known, bonus: bonus.known.present,
    receipts: { ordinary: ordinary.known.row, bonus: extra.known.row },
  } };
}

function readReceipt(
  store: NativeFactStore, model: "LaborGrant" | "BaneGrant", key: { game_id: number; home: number; day: number }, account: bigint,
): NativeFactResult<{ row: NativeRows["LaborGrant"] | undefined }> {
  const row = store.get(model, key);
  if (row) return { known: { row } };
  const absent = store.absenceKnown(model, { ...key, account });
  return absent.known ? { known: { row: undefined } } : { unknown: absent.unknown };
}

function readLaborBonus(store: NativeFactStore, gameId: number, home: number): NativeFactResult<{ present: boolean }> {
  const campaign = presentOrKnownAbsent(store, "CampaignHome", store.get("CampaignHome", { game_id: gameId, home }), {
    game_id: gameId, home,
  });
  if (!campaign.known || campaign.known.present) return campaign;
  const held = heldRealmForHome(store, { gameId, entityId: home }) !== null;
  return presentOrKnownAbsent(store, "SettledRealm", held || undefined, { game_id: gameId, home });
}

function presentOrKnownAbsent(
  store: NativeFactStore, model: "CampaignHome" | "SettledRealm", present: unknown, row: Record<string, unknown>,
): NativeFactResult<{ present: boolean }> {
  if (present) return { known: { present: true } };
  const absence = store.absenceKnown(model, row);
  return absence.known ? { known: { present: false } } : { unknown: absence.unknown };
}

function questReward(
  rules: { labor: bigint; essence: bigint; bonus_percent: number }, level: number, bonus: boolean, grants: number,
): Reward {
  const multiplier = 1n << BigInt(level - 1);
  const percent = BigInt(bonus ? rules.bonus_percent : 100);
  return {
    labor: ((rules.labor * multiplier * percent) / 100n) * BigInt(grants) * BigInt(RESOURCE_PRECISION),
    essence: rules.essence * multiplier * BigInt(grants) * BigInt(RESOURCE_PRECISION),
  };
}

function receivedReward(receipts: QuestReading["receipts"]): Reward {
  return {
    labor: (receipts.ordinary?.amount ?? 0n) + (receipts.bonus?.amount ?? 0n),
    essence: (receipts.ordinary?.essence ?? 0n) + (receipts.bonus?.essence ?? 0n),
  };
}
