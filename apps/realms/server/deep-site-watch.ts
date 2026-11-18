import { readDeepSites, NativeFactStore, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { readGameFacts, type ReleaseCatalogue } from "./game-facts";
import { dayOf, expeditionDepth, readExpeditionRules } from "@bibliothecadao/eternum/expeditions";
import { STAMINA_MODELS } from "@bibliothecadao/eternum/troop-stamina";
import { clearsEveryDefender, mapCenter, readCombatRules, researchedDepth } from "@bibliothecadao/eternum";

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
  player: Pick<DeepSiteWatch, "gameId" | "actor" | "owner">,
  now: number,
): DeepSiteWatch[] {
  const gameId = player.gameId;
  if (!store.get("DeepRules", { game_id: gameId })) return [];
  const calendar = readExpeditionRules(store, gameId);
  if (!calendar) throw new Error("Deep alerts require expedition rules");
  const timestamp = Math.floor(now / 1000);
  const day = dayOf(calendar, timestamp);
  if (!day) return [];
  const army = largestOutsideArmy(store, gameId, BigInt(player.actor), day.index);
  if (!army) return [];
  const home = army.owner;
  const depth = researchedDepth(store, gameId, home);
  if (depth === undefined) throw new Error("Deep alerts require the home's research");
  if (depth === 0) return [];
  const aspect = store.require("HomeAspect", { game_id: gameId, home }).aspect;
  const tickSeconds = readCombatRules(store, gameId).tickSeconds;
  const center = mapCenter(store.require("SliceRules", { game_id: gameId }).map_center_offset);
  return readDeepSites(store, timestamp, gameId).flatMap((site) => {
    if (depth < expeditionDepth(calendar, site.position)) return [];
    const defender = site.guards[0];
    if (!defender || site.beastTroops > 0n) return [];
    if (store.require("HomeAspect", { game_id: gameId, home: defender.army.owner }).aspect === aspect) return [];
    const due = firstClearableTick(store, army, site.id, timestamp, day.end, tickSeconds);
    return due === null
      ? []
      : [
          {
            ...player,
            home: String(home),
            siteId: String(site.id),
            siteName: site.name,
            col: site.position.x - center,
            row: site.position.y - center,
            day: day.index,
            dueAt: due * 1000,
            attempts: 0,
            until: day.end * 1000,
          },
        ];
  });
}

function largestOutsideArmy(store: NativeFactStore, gameId: number, actor: bigint, day: number) {
  let largest: NativeRows["ExplorerTroops"] | undefined;
  for (const army of store.inGame("ExplorerTroops", gameId)) {
    if (army.troops.count === 0n) continue;
    if (store.require("Structure", { game_id: gameId, entity_id: army.owner }).owner !== actor) continue;
    const key = { game_id: gameId, explorer_id: army.explorer_id };
    if (store.get("DeepArmy", key) || store.get("DeepGuard", key)) continue;
    if (store.require("ArmyDay", key).day !== BigInt(day)) continue;
    if (
      !largest ||
      army.troops.count > largest.troops.count ||
      (army.troops.count === largest.troops.count && army.explorer_id < largest.explorer_id)
    )
      largest = army;
  }
  return largest;
}

function firstClearableTick(
  store: NativeFactStore,
  army: NativeRows["ExplorerTroops"],
  siteId: bigint,
  now: number,
  end: number,
  tickSeconds: number,
): number | null {
  const attacker = { game_id: army.game_id, entity_id: army.explorer_id };
  const target = { game_id: army.game_id, entity_id: siteId };
  for (let at = now; at < end; at = (Math.floor(at / tickSeconds) + 1) * tickSeconds) {
    const site = readDeepSites(store, at, army.game_id).find((candidate) => candidate.id === siteId);
    if (!site?.guards.length) return null;
    const clears = clearsEveryDefender(store, attacker, target, at, { besideTarget: true });
    if (clears === undefined) throw new Error("Deep alert is missing the fight's combat facts");
    if (clears) return at;
  }
  return null;
}

/** One confirmed, scoped read holds the player's armies and every public Deep guard. */
export async function readDeepSiteWatches(
  shardUrl: string,
  player: Pick<DeepSiteWatch, "gameId" | "actor" | "owner">,
  now: number,
  catalogue: ReleaseCatalogue,
): Promise<DeepSiteWatch[]> {
  const store = await readGameFacts(
    shardUrl,
    player.gameId,
    [...STAMINA_MODELS, "PlayerEntry", "RealmKnowledge", "ArmyRelicEffect", "ChestRules", "DeepSite", "DeepEntries", "Guard"],
    now,
    { actor: player.actor },
    catalogue,
  );
  return planDeepSiteWatches(store, player, now);
}
