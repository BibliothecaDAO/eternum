import type {
  HeraldAspectRace,
  HeraldGameDirectory,
  HeraldGameDirectoryEntry,
  HeraldPlayerQuest,
  HeraldPlayerStructure,
} from "@bibliothecadao/eternum/game-sync";
import { DAILY_QUEST_MODELS, nativeGameModeOfFamily, readDailyQuest } from "@bibliothecadao/eternum";
import { dayOf, expeditionRealmSite, entityHomeNamespace, isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import { NativeFactStore, questBonusPercent, raceFinishHeight } from "@bibliothecadao/eternum/game-client";
import { aspects, isSeasonGame, RESOURCE_PRECISION, type AspectId, StructureType } from "@bibliothecadao/types";
import { isCheckGame, resolveDirectoryStatus, type DirectoryInput } from "../game-directory";
import type { FoldRow } from "../types";

/** The game-scoped facts a finalized game's directory entry and standings read; its review snapshot keeps the rest. */
export const FINALIZED_GAME_MODELS: ReadonlySet<string> = new Set([
  "GameRegistry",
  "SliceRules",
  "SettlementRules",
  "SettlementProgress",
  "Structure",
  "TileOccupancy",
  "PlayerEntry",
  "AspectRules",
  "AspectMembers",
  "RaceRules",
  "AspectHyperstructure",
  "ChestRules",
  "LordsBudget",
  "FrontierPrize",
  "LordsWithdrawal",
  "DepositSource",
  "SpendLords",
  "PrincipalWithdrawal",
  "DepositReceipt",
]);

import { integer, number, address, record, gameRows, required, type Row } from "./values";

type DailyQuestModel = (typeof DAILY_QUEST_MODELS)[number];
type QuestRowSelector = "game" | "home" | "entity" | "account" | "bane-game" | "bane-aspect" | "unused";

const QUEST_MODEL_SELECTOR = {
  GameRegistry: "game",
  SliceRules: "game",
  SettlementRules: "game",
  QuestRules: "game",
  Structure: "entity",
  QuestProgress: "home",
  LaborGrant: "home",
  BaneGrant: "home",
  Seal: "account",
  SettledRealm: "home",
  HomeAspect: "home",
  BaneRules: "bane-game",
  FirstTeamBane: "bane-game",
  WorldBane: "bane-game",
  TeamBane: "bane-aspect",
  BaneProgress: "bane-aspect",
  AspectActivity: "bane-aspect",
  DeepSite: "unused",
  AspectHyperstructure: "unused",
  DeepGuard: "unused",
  ArmyDay: "unused",
  PlayerEntry: "unused",
  ExplorerTroops: "unused",
  TileOccupancy: "unused",
  ExpeditionSite: "unused",
} as const satisfies Record<DailyQuestModel, QuestRowSelector>;

const DAILY_QUEST_MODEL_LIST: readonly DailyQuestModel[] = [...new Set(DAILY_QUEST_MODELS)];

interface DirectoryRows {
  structures: FoldRow[];
  position: DirectoryInput["fold"]["structurePosition"];
  rules: FoldRow[];
  settlementRules: FoldRow[];
  progress: FoldRow[];
  entries: FoldRow[];
  entitlements: FoldRow[];
  aspectRules: FoldRow[];
  aspectMembers: FoldRow[];
  raceRules: FoldRow[];
  questRules: FoldRow[];
  aspectHyperstructures: FoldRow[];
}

const FIRST_SEASON = 1;

export function buildNativeDirectory(input: DirectoryInput): HeraldGameDirectory {
  const rows = (model: string) => input.fold.modelRows(model);
  const facts = directoryRows(input);
  // Launcher-created check names are reserved for deployment; they never offer a player a joinable listing.
  const publicGames = rows("GameRegistry").filter(({ value }) => !isCheckGame(value));
  const seasons = publicGames
    .filter(
      ({ value }) =>
        nativeGameModeOfFamily(number(value.family)) === "frontier" && isSeasonGame(shortString(value.name)),
    )
    .sort((a, b) => number(a.value.game_id) - number(b.value.game_id));
  const seasonNumbers = new Map(seasons.map(({ value }, index) => [number(value.game_id), FIRST_SEASON + index]));
  const games = publicGames
    .map(({ value }) => directoryEntry(value, facts, input))
    .map((game) => ({ ...game, season_number: seasonNumbers.get(game.game_id) ?? null }))
    .sort((left, right) => right.game_id - left.game_id);
  return { chain: input.chain, confirmed_block: input.confirmedBlock, games };
}

/** Add only the requesting player's state to the shared directory; never retain an address-keyed response. */
export function directoryForPlayer(directory: HeraldGameDirectory, input: DirectoryInput): HeraldGameDirectory {
  if (!input.playerAddress) return directory;
  const facts = directoryRows(input);
  const games = new Map(
    input.fold
      .modelRows("GameRegistry")
      .filter(({ value }) => !isCheckGame(value))
      .map(({ value }) => [number(value.game_id), value]),
  );
  return {
    ...directory,
    games: directory.games.map((entry) => ({
      ...entry,
      player_state: directoryPlayerState(games.get(entry.game_id)!, facts, input),
    })),
  };
}

function directoryRows(input: DirectoryInput): DirectoryRows {
  const rows = (model: string) => input.fold.modelRows(model);
  return {
    structures: rows("Structure"),
    position: (gameId, entityId) => input.fold.structurePosition(gameId, entityId),
    rules: rows("SliceRules"),
    settlementRules: rows("SettlementRules"),
    progress: rows("SettlementProgress"),
    entries: rows("PlayerEntry"),
    entitlements: rows("EntryEntitlement"),
    aspectRules: rows("AspectRules"),
    aspectMembers: rows("AspectMembers"),
    raceRules: rows("RaceRules"),
    questRules: rows("QuestRules"),
    aspectHyperstructures: rows("AspectHyperstructure"),
  };
}

function directoryPlayerState(
  game: Row,
  facts: DirectoryRows,
  input: DirectoryInput,
): HeraldGameDirectoryEntry["player_state"] {
  if (!input.playerAddress) return null;
  const player = address(input.playerAddress);
  const structures = gameRows(facts.structures, game.game_id).filter((row) => address(row.owner) === player);
  const entitlements = gameRows(facts.entitlements, game.game_id);
  const own = entitlements.find((row) => address(row.owner) === player);
  const held = own && number(own.pass_kind) === 2 ? own : null;
  const settlement = required(facts.settlementRules, game.game_id, "SettlementRules");
  return {
    registered: gameRows(facts.entries, game.game_id).some((row) => address(row.player) === player),
    settled: structures.some((row) => isRealmCategory(number(record(row.base).category))),
    held_realm_id: held ? number(held.realm_id) : null,
    has_home_source: own !== undefined,
    taken_realm_ids: entitlements.filter((row) => number(row.pass_kind) === 2).map((row) => number(row.realm_id)),
    structures: structures.map((row) => playerStructure(row, game, settlement, facts, input.timestamp)),
    today_quest: todayQuestOf(number(game.game_id), structures, facts, input, player),
  };
}

function todayQuestOf(
  gameId: number,
  structures: readonly Row[],
  directory: DirectoryRows,
  input: DirectoryInput,
  player: string,
): HeraldPlayerQuest | null {
  const realm = structures.find((row) => isRealmCategory(number(record(row.base).category)));
  if (!realm) return null;
  const targetGame = BigInt(gameId);
  const homeId = integer(realm.entity_id);
  const rowsForGame = (model: DailyQuestModel): FoldRow[] => {
    const source =
      model === "Structure"
        ? directory.structures
        : model === "SliceRules"
          ? directory.rules
          : model === "SettlementRules"
            ? directory.settlementRules
            : input.fold.modelRows(model);
    return source.filter(({ value }) => integer(value.game_id) === targetGame);
  };
  if (rowsForGame("QuestRules").length === 0) return null;
  const hasBaneRules = rowsForGame("BaneRules").length > 0;
  const homeAspectRow = hasBaneRules
    ? rowsForGame("HomeAspect").find(({ value }) => integer(value.home) === homeId)
    : undefined;
  const aspect = homeAspectRow ? number(homeAspectRow.value.aspect) : null;
  const facts = DAILY_QUEST_MODEL_LIST.flatMap((model) => {
    const selector = QUEST_MODEL_SELECTOR[model];
    if (selector === "unused") return [];
    if ((selector === "bane-game" || selector === "bane-aspect") && !hasBaneRules) return [];
    if (selector === "bane-aspect" && aspect === null) return [];
    const rows = rowsForGame(model).filter(({ value }) => {
      switch (selector) {
        case "game":
        case "bane-game":
          return true;
        case "entity":
          return integer(value.entity_id) === homeId;
        case "home":
          return integer(value.home) === homeId;
        case "account":
          return address(value.account) === player;
        case "bane-aspect":
          return number(value.aspect) === aspect;
      }
    });
    return rows.map(({ key, value }) => ({ model, key, value }));
  });
  const store = new NativeFactStore();
  store.applyFacts(facts);
  store.setSnapshot({ gameId, complete: true, actor: player, timestamp: input.timestamp });
  const reading = readDailyQuest(store, gameId, number(realm.entity_id), input.timestamp)?.reading.known;
  if (!reading) return null;
  return {
    quest_id: reading.quest.id,
    progress: Number(reading.progress),
    target: Number(reading.target),
    labor: Number(reading.reward.labor) / RESOURCE_PRECISION,
  };
}

/** Only fields visible in the directory invalidate it; troop combat and production writes do not. */
export function directoryFact(model: string, row: Row | undefined): unknown {
  if (!row) return undefined;
  switch (model) {
    case "GameRegistry":
      return row;
    case "SliceRules":
      return row.day_unit_seconds;
    case "SettlementRules":
      return row;
    case "SettlementProgress":
      return row.registered;
    case "EntryEntitlement":
      return row;
    case "PlayerEntry":
      return row.player;
    case "AspectRules":
      return row.orders;
    case "AspectMembers":
      return [row.aspect, row.members];
    case "RaceRules":
      return [row.stage_height, row.season_days];
    case "QuestRules":
      return row.bonus_percent;
    case "AspectHyperstructure":
      return [row.aspect, row.height];
    case "Structure":
      return [
        row.owner,
        record(row.base).category,
        record(row.base).level,
        record(row.metadata).realm_id,
        row.resources_packed,
      ];
    default:
      return undefined;
  }
}

export function directoryStatus(game: Row, timestamp: number) {
  return resolveDirectoryStatus(
    game.settled ? "Settled" : "Registration",
    { start_main_at: number(game.start_main_at), end_at: number(game.end_at) },
    game.dev_mode_on === true,
    timestamp,
  );
}

const SETTLEMENT_CATEGORIES: readonly number[] = [StructureType.Realm, StructureType.Village];

function gameDayOf(game: Row, facts: DirectoryRows, timestamp: number) {
  const mode = nativeGameModeOfFamily(number(game.family));
  const dayUnitSeconds = number(required(facts.rules, game.game_id, "SliceRules").day_unit_seconds);
  if (mode !== "frontier" || dayUnitSeconds === 0) return null;
  const calendar = {
    seed: integer(game.seed),
    scheduledEndAt: number(game.scheduled_end_at),
    endAt: number(game.end_at),
    startMainAt: number(game.start_main_at),
    dayUnitSeconds,
  };
  const day = game.settled !== true ? dayOf(calendar, timestamp) : null;
  const nextDay = day ? dayOf(calendar, day.end) : null;
  return { day, nextDay };
}

function directoryEntry(game: Row, facts: DirectoryRows, input: DirectoryInput): HeraldGameDirectoryEntry {
  const { settlementRules, progress, structures } = facts;
  const mode = nativeGameModeOfFamily(number(game.family));
  const settlement = required(settlementRules, game.game_id, "SettlementRules");
  const dayUnitSeconds = number(required(facts.rules, game.game_id, "SliceRules").day_unit_seconds);
  const state = gameRows(progress, game.game_id)[0];
  const settlements = gameRows(structures, game.game_id).filter(
    (row) => SETTLEMENT_CATEGORIES.includes(number(record(row.base).category)) && integer(row.owner) !== 0n,
  );
  const realms = settlements.filter((row) => isRealmCategory(number(record(row.base).category)));
  const clock = {
    start_settling_at: number(game.start_settling_at),
    start_main_at: number(game.start_main_at),
    end_at: number(game.end_at),
    scheduled_end_at: number(game.scheduled_end_at),
  };
  const activeDay = gameDayOf(game, facts, input.timestamp);
  const day = activeDay?.day ?? null;
  const nextDay = activeDay?.nextDay ?? null;
  return {
    game_id: number(game.game_id),
    name: shortString(game.name),
    mode,
    day_index: day?.index ?? null,
    day_ends_at: day?.end ?? null,
    next_day_length: nextDay ? nextDay.end - nextDay.start : null,
    expedition: dayUnitSeconds === 0 ? null : { day_unit_seconds: dayUnitSeconds, seed: integer(game.seed).toString() },
    dev_mode_on: game.dev_mode_on === true,
    clock_scale: number(game.clock_scale),
    status: directoryStatus(game, input.timestamp),
    clock,
    player_count: new Set(settlements.map((row) => address(row.owner))).size,
    aspect_members: aspectMembersOf(facts, game.game_id),
    aspect_race: aspectRaceOf(facts, game.game_id),
    quest_bonus_percent: questBonusPercentOf(facts, game.game_id),
    player_state: directoryPlayerState(game, facts, input),
    registration: {
      count:
        mode === "frontier"
          ? new Set(gameRows(facts.entries, game.game_id).map((entry) => address(entry.player))).size
          : state
            ? number(state.registered)
            : 0,
      max: number(settlement.registration_limit),
      start_at: number(settlement.registration_start),
    },
    settled_realms_count: realms.length,
    settled_villages_count: settlements.length - realms.length,
    // Native placement is described by SettlementRules and SettlementPool in the snapshot.
    settlement: null,
  };
}

function questBonusPercentOf(facts: DirectoryRows, gameId: unknown): number | null {
  const rules = gameRows(facts.questRules, gameId)[0];
  return rules ? questBonusPercent({ bonus_percent: number(rules.bonus_percent) }) : null;
}

function aspectRaceOf(facts: DirectoryRows, gameId: unknown): HeraldAspectRace | null {
  const rules = gameRows(facts.raceRules, gameId)[0];
  if (!rules) return null;
  const rows = gameRows(facts.aspectHyperstructures, gameId);
  return {
    finish_height: raceFinishHeight(number(rules.stage_height)),
    season_days: number(rules.season_days),
    heights: Object.fromEntries(
      aspects.map(({ id }) => [id, number(rows.find((row) => number(row.aspect) === id)?.height ?? 0)]),
    ) as Record<AspectId, number>,
  };
}

/**
 * Each Aspect's homes in a game with Aspects: AspectMembers' count, or 0 where an Aspect has no row yet (its absence
 * rule under AspectRules); null in a game without them.
 */
function aspectMembersOf(facts: DirectoryRows, gameId: unknown): Record<AspectId, number> | null {
  if (gameRows(facts.aspectRules, gameId).length === 0) return null;
  const members = gameRows(facts.aspectMembers, gameId);
  return Object.fromEntries(
    aspects.map(({ id }) => [id, number(members.find((row) => number(row.aspect) === id)?.members ?? 0)]),
  ) as Record<AspectId, number>;
}

function playerStructure(
  row: Row,
  game: Row,
  settlement: Row,
  facts: DirectoryRows,
  timestamp: number,
): HeraldPlayerStructure {
  const base = record(row.base);
  const position = structurePosition(row, game, settlement, facts, timestamp);
  return {
    entity_id: number(row.entity_id),
    category: number(base.category),
    level: number(base.level),
    realm_id: number(record(row.metadata).realm_id),
    coord_x: position?.col ?? null,
    coord_y: position?.row ?? null,
    resources_packed: integer(row.resources_packed).toString(),
  };
}

function structurePosition(
  row: Row,
  game: Row,
  settlement: Row,
  facts: DirectoryRows,
  timestamp: number,
): { col: number; row: number } | null {
  const rules = required(facts.rules, game.game_id, "SliceRules");
  const dayUnitSeconds = number(rules.day_unit_seconds);
  if (dayUnitSeconds !== 0 && isRealmCategory(number(record(row.base).category))) {
    return expeditionRealmSite(
      {
        dayUnitSeconds,
        spacing: number(settlement.spacing),
        scheduledEndAt: number(game.scheduled_end_at),
        endAt: number(game.end_at),
        startMainAt: number(game.start_main_at),
        seed: integer(game.seed),
      },
      entityHomeNamespace(integer(row.entity_id)),
      timestamp,
    );
  }
  const tile = facts.position(integer(row.game_id).toString(), integer(row.entity_id).toString());
  if (tile) return { col: number(tile.col), row: number(tile.row) };
  // A structure with no tile keeps its row without a position, never failing the player's whole directory; it is
  // reported with its game and entity.
  console.warn(
    JSON.stringify({
      event: "herald_directory_structure_unplaced",
      game_id: integer(row.game_id).toString(),
      entity_id: integer(row.entity_id).toString(),
      category: number(record(row.base).category),
    }),
  );
  return null;
}

function shortString(value: unknown): string {
  const hex = integer(value).toString(16);
  return Buffer.from(hex.length % 2 ? `0${hex}` : hex, "hex").toString("utf8");
}
