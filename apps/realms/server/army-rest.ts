import {
  fetchHeraldGameDirectory,
  fetchHeraldGameSnapshot,
  NativeFactStore,
  entityMapPosition,
} from "@bibliothecadao/eternum/game-client";
import type { HeraldStoryHistoryPage } from "@bibliothecadao/eternum/game-sync";
import { isCurrentExpeditionArmy, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import {
  fullAtTick,
  staminaAt,
  troopStaminaLimits,
  resolveExplorerTroops,
} from "@bibliothecadao/eternum/troop-stamina";
import type { TroopTier, TroopType } from "@bibliothecadao/types";

/**
 * When one army of one player will be rested; replaced by the player's next action, dropped when the army is gone.
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
    const actor = `0x${BigInt(player).toString(16)}`;
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
): Promise<ActorArmy[]> => {
  const snapshot = await fetchHeraldGameSnapshot(
    { url: shardUrl },
    gameId,
    [
      "SliceRules",
      "SettlementRules",
      "GameRegistry",
      "Structure",
      "PlayerEntry",
      "ExplorerTroops",
      "ArmySlot",
      "TileOccupancy",
    ],
    actor,
    actor,
  );
  const store = new NativeFactStore();
  store.applyFacts(
    snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, key: row.key, value: row.value }))),
  );
  store.setSnapshot({ gameId, actor, complete: true, timestamp: Math.floor(now / 1000) });
  const rules = store.require("SliceRules", { game_id: gameId });
  const tickSeconds = Number(rules.tick_config.armies_tick_in_seconds);
  const currentTick = Math.floor(now / 1000 / tickSeconds);
  const expedition = readExpeditionRules(store, gameId);
  return [...store.inGame("ExplorerTroops", gameId)]
    .filter(
      (army) =>
        !expedition ||
        isCurrentExpeditionArmy(expedition, entityMapPosition(store, gameId, army.explorer_id), now / 1000),
    )
    .flatMap((army) => {
      const troops = resolveExplorerTroops(store, army);
      if (!troops) return [];
      const stamina = staminaAt(troops, currentTick, rules.troop_stamina_config);
      const { staminaMax } = troopStaminaLimits(
        rules.troop_stamina_config,
        army.troops.category as TroopType,
        army.troops.tier as TroopTier,
      );
      const fullTick = fullAtTick(troops, currentTick, rules.troop_stamina_config);
      return [
        {
          armyId: army.explorer_id,
          full: Number(stamina.amount) >= staminaMax,
          fullAt: fullTick === null ? null : fullTick * tickSeconds * 1000,
        },
      ];
    });
};

/** A player's armies that are still recovering become watches; a rested or gone army has none. */
export const restWatchesOf = (actor: RestingActor, armies: ActorArmy[]): RestWatch[] =>
  armies.flatMap((army) =>
    army.full || army.fullAt === null ? [] : [{ ...actor, armyId: army.armyId, fullAt: army.fullAt, attempts: 0 }],
  );
