import { BiomeType } from "@bibliothecadao/types";
import { fetchHeraldGameSnapshot, readDeepSites, NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { dayOf, expeditionDepth, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import { forecastFight, type CombatRules } from "@bibliothecadao/eternum/combat-exchange";
import { resolveExplorerCombatTroops, STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import { mapCenter, researchedDepth } from "@bibliothecadao/eternum";

export interface DeepSiteWatch {
  gameId: number;
  actor: string;
  owner: string;
  home: string;
  siteId: string;
  day: number;
  dueAt: number;
  attempts: number;
  until: number;
  siteName: string;
  col: number;
  row: number;
}

/** A confirmed snapshot plans one wake per rival site, without polling guard counts. */
export function planDeepSiteWatches(
  store: NativeFactStore,
  player: Pick<DeepSiteWatch, "gameId" | "actor" | "owner" | "home">,
  now: number,
): DeepSiteWatch[] {
  const gameId = player.gameId;
  if (!store.get("DeepRules", { game_id: gameId })) return [];
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) throw new Error("Deep alerts require expedition rules");
  const timestamp = Math.floor(now / 1000);
  const day = dayOf(calendar, timestamp);
  if (!day) return [];
  const home = BigInt(player.home);
  const depth = researchedDepth(store, gameId, home);
  if (depth === undefined) throw new Error("Deep alerts require the home's research");
  if (depth === 0) return [];
  const army = largestOutsideArmy(store, gameId, home, day.index);
  if (!army) return [];
  const aspect = store.require("HomeAspect", { game_id: gameId, home }).aspect;
  const rules = combatRules(store, gameId);
  const center = mapCenter(store.require("SliceRules", { game_id: gameId }).map_center_offset);
  return readDeepSites(store, timestamp, gameId).flatMap((site) => {
    if (depth < expeditionDepth(calendar, site.position)) return [];
    const defender = site.guards[0];
    if (!defender || site.beastTroops > 0n) return [];
    if (store.require("HomeAspect", { game_id: gameId, home: defender.army.owner }).aspect === aspect) return [];
    const due = firstClearableTick(store, army, site.id, timestamp, day.end, rules);
    return due === null
      ? []
      : [{ ...player, siteId: String(site.id), siteName: site.name, col: site.position.x - center, row: site.position.y - center, day: day.index, dueAt: due * 1000, attempts: 0, until: day.end * 1000 }];
  });
}

function largestOutsideArmy(store: NativeFactStore, gameId: number, home: bigint, day: number) {
  let largest: NativeRows["ExplorerTroops"] | undefined;
  for (const army of store.inGame("ExplorerTroops", gameId)) {
    if (army.owner !== home || army.troops.count === 0n) continue;
    const key = { game_id: gameId, explorer_id: army.explorer_id };
    if (store.get("DeepArmy", key) || store.get("DeepGuard", key)) continue;
    if (store.require("ArmyDay", key).day !== BigInt(day)) continue;
    if (
      !largest ||
      army.troops.count > largest.troops.count ||
      (army.troops.count === largest.troops.count && army.explorer_id < largest.explorer_id)
    ) largest = army;
  }
  return largest;
}

function firstClearableTick(
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  siteId: bigint,
  now: number,
  end: number,
  rules: CombatRules,
): number | null {
  for (let at = now; at < end; at = (Math.floor(at / rules.tickSeconds) + 1) * rules.tickSeconds) {
    const site = readDeepSites(store, at, army.game_id).find((candidate) => candidate.id === siteId);
    if (!site?.guards.length) return null;
    if (clearsEveryGuard(store, army, site.guards, at, rules)) return at;
  }
  return null;
}

function clearsEveryGuard(
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  guards: ReturnType<typeof readDeepSites>[number]["guards"],
  timestamp: number,
  rules: CombatRules,
): boolean {
  let attacker = resolveExplorerCombatTroops(store, army, timestamp);
  if (!attacker) throw new Error("Deep alert is missing the attacker's combat facts");
  for (const guard of guards) {
    const defender = resolveExplorerCombatTroops(store, guard.army, timestamp);
    if (!defender) throw new Error("Deep alert is missing a guard's combat facts");
    const fight = forecastFight(attacker, defender, {
      timestamp,
      attackDistance: 1,
      attackerBiome: BiomeType.Underground,
      defenderBiome: BiomeType.Underground,
      attackerIsStructureGuard: false,
      defenderIsStructureGuard: true,
      attackerRoll: 0,
      defenderRoll: 0,
    }, rules);
    if (fight.outcome !== "wins") return false;
    attacker = fight.attacker;
  }
  return true;
}

function combatRules(store: NativeFactStore, gameId: number): CombatRules {
  const rules = store.require("SliceRules", { game_id: gameId });
  return {
    dayUnitSeconds: rules.day_unit_seconds,
    cooldownSeconds: rules.battle_config.cooldown_seconds,
    tickSeconds: Number(rules.tick_config.armies_tick_in_seconds),
    damage: rules.troop_damage_config,
    stamina: rules.troop_stamina_config,
  };
}

/** One confirmed, scoped read holds the player's armies and every public Deep guard. */
export async function readDeepSiteWatches(
  shardUrl: string,
  player: Pick<DeepSiteWatch, "gameId" | "actor" | "owner">,
  now: number,
): Promise<DeepSiteWatch[]> {
  const snapshot = await fetchHeraldGameSnapshot({ url: shardUrl }, player.gameId, [
    ...STAMINA_MODELS, "PlayerEntry", "RealmKnowledge", "ArmyRelicEffect", "ChestRules", "DeepSite", "Guard",
  ], player.actor, player.actor);
  if (BigInt(snapshot.game_id) !== BigInt(player.gameId)) throw new Error("Site watch read another game");
  const store = new NativeFactStore();
  store.applyFacts(snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, key: row.key, value: row.value }))));
  store.setSnapshot({ gameId: player.gameId, actor: player.actor, complete: true, timestamp: Math.floor(now / 1000) });
  return [...store.inGame("Structure", player.gameId)]
    .filter((home) => home.owner === BigInt(player.actor) && store.get("HomeAspect", { game_id: player.gameId, home: home.entity_id }))
    .flatMap((home) => planDeepSiteWatches(store, { ...player, home: String(home.entity_id) }, now));
}
