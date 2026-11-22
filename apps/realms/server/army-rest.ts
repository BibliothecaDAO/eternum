import { normalizeStarknetAddress as canonicalFelt } from "@realms-world/identity";
import { safeInteger } from "../../../packages/core/src/utils/safe-integer";
import { readBaneEffects } from "@bibliothecadao/eternum";
import { fetchHeraldGameDirectory, NativeFactStore, nativeBaneConstants } from "@bibliothecadao/eternum/game-client";
import { readGameFacts, type ReleaseCatalogue } from "./game-facts";
import type { HeraldStoryHistoryPage } from "@bibliothecadao/eternum/game-sync";
import { expeditionDepth, isCurrentExpeditionArmy, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import {
  STAMINA_MODELS,
  affordableAt,
  staminaAt,
  troopStaminaLimits,
  resolveExplorerTroops,
  type TroopStaminaRules,
} from "@bibliothecadao/eternum/troop-stamina";
import type { TroopTier, TroopType, Troops } from "@bibliothecadao/types";

/**
 * The earliest one army can be rested; confirmed again at that second, replaced by the player's next action.
 * `attempts` counts wakes that failed to read it.
 */
export interface RestWatch {
  gameId: number;
  actor: string;
  owner: string;
  armyId: number;
  fullAt: number;
  attempts: number;
}

/** One player in one game whose armies are worth watching: they act, and a device of theirs wants game alerts. */
export interface RestingActor {
  gameId: number;
  actor: string;
  owner: string;
}

interface ActorArmy {
  armyId: number;
  fullAt: number | null;
  full: boolean;
}

export const restWatchKey = (watch: { gameId: number; actor: string; armyId?: number }) =>
  `rest:${watch.gameId}:${watch.actor}:${watch.armyId ?? ""}`;

/**
 * Splits entries by whether their game still runs, by Herald's phase for it at its chain clock. An ended game's armies
 * cannot act, so they are never read or alerted; a finalized game's Herald no longer serves them at all. One directory
 * read covers every entry, and none is made for none.
 */
export const partitionByRunningGame = async <Entry extends { gameId: number }>(
  shardUrl: string,
  entries: readonly Entry[],
): Promise<{ running: Entry[]; ended: Entry[] }> => {
  if (entries.length === 0) return { running: [], ended: [] };
  const { games } = await fetchHeraldGameDirectory({ url: shardUrl });
  const running = new Set(
    games.filter(({ status }) => status !== "Ended" && status !== "Settled").map(({ game_id }) => game_id),
  );
  return {
    running: entries.filter(({ gameId }) => running.has(gameId)),
    ended: entries.filter(({ gameId }) => !running.has(gameId)),
  };
};

/**
 * Every player whose armies this page may have changed, once per game: one story or many cost one read. Herald's story
 * history carries the chain's stories, not its execution records: a player's own actions arrive as stories they own
 * (an explore as its reward, a march, a new army), and fights as battle or raid events naming their players.
 */
export const actorsWhoActed = (page: HeraldStoryHistoryPage): { gameId: number; actor: string }[] => {
  const acted = new Map<string, { gameId: number; actor: string }>();
  const add = (gameId: number, player: unknown) => {
    if (typeof player !== "string" && typeof player !== "bigint" && typeof player !== "number") return;
    if (BigInt(player) === 0n) return;
    const actor = canonicalFelt(BigInt(player));
    acted.set(`${gameId}:${actor}`, { gameId, actor });
  };
  for (const { model, value } of page.items) {
    const gameId = Number(value.game_id);
    if (model === "StoryEvent") add(gameId, value.owner);
    if (model === "BattleEvent")
      for (const side of [value.attacker, value.defender])
        add(gameId, (side as { player?: unknown } | undefined)?.player);
    if (model === "RaidEvent") add(gameId, value.player);
  }
  return [...acted.values()];
};

/**
 * A player's armies in one game and when each is full, from the shard's own rules for that game. Herald narrows the
 * read to the armies the player's structures own, so its cost is one player's, not the game's. In a game of daily
 * expeditions an army from an earlier day is no army any more, whether or not its row remains.
 */
export const readActorArmies = async (
  shardUrl: string,
  gameId: number,
  actor: string,
  now: number,
  catalogue: ReleaseCatalogue,
): Promise<ActorArmy[]> => {
  const store = await readGameFacts(
    shardUrl,
    gameId,
    [...STAMINA_MODELS, "PlayerEntry", "DeepArmy", "DeepGuard", "DeepRules"],
    now,
    { actor, owner: actor },
    catalogue,
  );
  const rules = store.require("SliceRules", { game_id: gameId });
  const tickSeconds = Number(rules.tick_config.armies_tick_in_seconds);
  const timestamp = Math.floor(now / 1000);
  const expedition = readExpeditionRules(store, gameId);
  return [...store.inGame("ExplorerTroops", gameId)]
    .filter(
      (army) =>
        !store.get("DeepGuard", { game_id: gameId, explorer_id: army.explorer_id }) &&
        (!expedition ||
          isCurrentExpeditionArmy(
            expedition,
            store.require("ArmyDay", { game_id: gameId, explorer_id: army.explorer_id }).day,
            timestamp,
          )),
    )
    .flatMap((army) => {
      const troops = resolveExplorerTroops(store, army, timestamp);
      if (!troops) throw new Error(`Incomplete stamina facts for army ${army.explorer_id}`);
      if (troops.count === 0n) return [];
      const stamina = staminaAt(troops, timestamp, rules.troop_stamina_config, tickSeconds);
      const { staminaMax } = troopStaminaLimits(
        rules.troop_stamina_config,
        army.troops.category as TroopType,
        army.troops.tier as TroopTier,
      );
      const maximum = troops.staminaMax ?? staminaMax;
      const full = Number(stamina.amount) >= maximum;
      const position = store.entityOccupancy(gameId, army.explorer_id);
      const aboveDeep = expedition && position && expeditionDepth(expedition, { y: position.row }) !== 3;
      const fullSecond = full
        ? affordableAt(troops, troops.stamina.settled_at || timestamp, rules.troop_stamina_config, tickSeconds, maximum)
        : earliestRestCheck(
            store,
            gameId,
            army.owner,
            troops,
            timestamp,
            rules.troop_stamina_config,
            tickSeconds,
            maximum,
            Boolean(aboveDeep),
          );
      return [
        {
          armyId: safeInteger(army.explorer_id),
          full,
          fullAt: fullSecond === null ? null : fullSecond * 1000,
        },
      ];
    });
};

/** A teammate can end Mist Tide now. Wake at that earliest possibility, then confirm the recorded facts again. */
function earliestRestCheck(
  store: NativeFactStore,
  gameId: number,
  home: bigint,
  troops: Troops,
  now: number,
  rules: TroopStaminaRules,
  tickSeconds: number,
  maximum: number,
  aboveDeep: boolean,
): number | null {
  const effects = troops.staminaEffects;
  if (!aboveDeep || !effects) return affordableAt(troops, now, rules, tickSeconds, maximum);
  const reading = readBaneEffects(store, gameId, home, now, effects.until);
  if (!reading.known) throw new Error(reading.unknown);
  const { staminaPercent } = reading.known;
  const mist = reading.known.windows.find(
    (window) => window.kinds.includes(nativeBaneConstants.MIST_TIDE) && window.start <= now,
  );
  if (!mist) return affordableAt(troops, now, rules, tickSeconds, maximum);
  const boundaries = [
    ...new Set([
      troops.stamina.settled_at,
      now,
      mist.end,
      effects.until,
      ...effects.windows.flatMap((window) => [window.start, window.end]),
    ]),
  ].sort((a, b) => a - b);
  const windows = boundaries.slice(0, -1).map((start, index) => {
    const rate = effects.windows.find((window) => window.start <= start && start < window.end)?.rateBps ?? 10_000;
    return {
      start,
      end: boundaries[index + 1]!,
      rateBps: start >= now && start < mist.end ? (rate * 100) / staminaPercent : rate,
    };
  });
  return affordableAt({ ...troops, staminaEffects: { ...effects, windows } }, now, rules, tickSeconds, maximum);
}

/** A player's armies that are still recovering become watches; a rested or gone army has none. */
export const restWatchesOf = (actor: RestingActor, armies: ActorArmy[]): RestWatch[] =>
  armies.flatMap((army) =>
    army.full || army.fullAt === null ? [] : [{ ...actor, armyId: army.armyId, fullAt: army.fullAt, attempts: 0 }],
  );
