import { fetchHeraldGameSnapshot, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldStoryHistoryPage } from "@bibliothecadao/eternum/game-sync";
import { isCurrentExpeditionArmy, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import { fullAtTick, staminaAt, troopStaminaLimits } from "@bibliothecadao/eternum/troop-stamina";
import type { TroopTier, TroopType } from "@bibliothecadao/types";

/** When one army of one player will be rested; replaced by the player's next action, dropped when the army is gone. */
export interface RestWatch {
  gameId: number;
  actor: string;
  owner: string;
  armyId: number;
  fullAt: number;
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

/** Every player who acted in this page, once per game: one recorded action or many cost one read. */
export const actorsWhoActed = (page: HeraldStoryHistoryPage): { gameId: number; actor: string }[] => {
  const acted = new Map<string, { gameId: number; actor: string }>();
  for (const item of page.items) {
    if (item.model !== "ExecutionRecorded") continue;
    const actor = `0x${BigInt(item.value.actor as string).toString(16)}`;
    const gameId = Number(item.value.game_id);
    acted.set(`${gameId}:${actor}`, { gameId, actor });
  }
  return [...acted.values()];
};

/**
 * A player's armies in one game and when each is full, from the shard's own rules for that game. In a game of daily
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
    ["SliceRules", "SettlementRules", "GameRegistry", "Structure", "ExplorerTroops"],
    actor,
  );
  const store = new NativeFactStore();
  store.applyFacts(
    snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, key: row.key, value: row.value }))),
  );
  const rules = store.require("SliceRules", { game_id: gameId });
  const tickSeconds = Number(rules.tick_config.armies_tick_in_seconds);
  const currentTick = Math.floor(now / 1000 / tickSeconds);
  const expedition = readExpeditionRules(store, gameId);
  const homes = new Set([...store.structuresOwnedBy(gameId, BigInt(actor))].map((structure) => structure.entity_id));
  return [...store.inGame("ExplorerTroops", gameId)]
    .filter((army) => homes.has(army.owner))
    .filter((army) => !expedition || isCurrentExpeditionArmy(expedition, army.coord, now / 1000))
    .map((army) => {
      const stamina = staminaAt(army.troops, currentTick, rules.troop_stamina_config);
      const { staminaMax } = troopStaminaLimits(
        rules.troop_stamina_config,
        army.troops.category as TroopType,
        army.troops.tier as TroopTier,
      );
      const fullTick = fullAtTick(army.troops, currentTick, rules.troop_stamina_config);
      return {
        armyId: army.explorer_id,
        full: Number(stamina.amount) >= staminaMax,
        fullAt: fullTick === null ? null : fullTick * tickSeconds * 1000,
      };
    });
};

/** A player's armies that are still recovering become watches; a rested or gone army has none. */
export const restWatchesOf = (actor: RestingActor, armies: ActorArmy[]): RestWatch[] =>
  armies.flatMap((army) =>
    army.full || army.fullAt === null ? [] : [{ ...actor, armyId: army.armyId, fullAt: army.fullAt }],
  );
