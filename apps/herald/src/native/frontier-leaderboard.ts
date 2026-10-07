import type {
  HeraldFrontierLeaderboard,
  HeraldFrontierLeaderboardEntry,
  HeraldHistoryEvent,
} from "@bibliothecadao/eternum/game-sync";
import { isRealmCategory, siteKindOf } from "@bibliothecadao/eternum/expeditions";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import type { FoldRow } from "../types";
import { address, gameRows, integer, number, record, required, type Row } from "./values";

interface Standing {
  entry: HeraldFrontierLeaderboardEntry;
  lastClear?: HeraldHistoryEvent;
}

export function buildFrontierLeaderboard(
  modelRows: (model: string) => FoldRow[],
  gameId: string,
  history: readonly HeraldHistoryEvent[],
): HeraldFrontierLeaderboard {
  required(modelRows("GameRegistry"), gameId, "GameRegistry");
  const players = settledPlayers(gameRows(modelRows("Structure"), gameId));
  const receipts = new Set<string>();
  for (const event of history) {
    if (integer(event.game_id) !== integer(gameId)) throw new Error("Frontier history game mismatch");
    const receipt = `${event.transaction_hash}:${event.event_index}`;
    if (receipts.has(receipt)) continue;
    receipts.add(receipt);
    const player = players.get(address(event.value.owner));
    if (!player) throw new Error("Frontier reward has no settled realm");
    applyStory(player, record(event.value.story), event);
  }
  const entries = [...players.values()]
    .sort(compareStandings)
    .map(({ entry }, index) => ({ ...entry, rank: index + 1 }));
  return { game_id: integer(gameId).toString(), mode: "frontier", entries };
}

function settledPlayers(structures: Row[]): Map<string, Standing> {
  const players = new Map<string, Standing>();
  for (const structure of structures) {
    if (!isRealmCategory(number(record(structure.base).category))) continue;
    const owner = address(structure.owner);
    if (players.has(owner)) throw new Error("Frontier player has multiple settled realms");
    players.set(owner, {
      entry: {
        address: owner,
        structure_id: integer(structure.entity_id).toString(),
        rank: 0,
        sites_cleared: { total: 0, camps: 0, rifts: 0, ruins: 0, stragglers: 0 },
        chests_earned: 0,
        rewards: { lords: "0", essence: "0", labor: "0" },
        deepest_depth: number(record(structure.metadata).deepest_depth),
        order: number(record(structure.metadata).order),
      },
    });
  }
  return players;
}

function applyStory(player: Standing, story: Row, event: HeraldHistoryEvent): void {
  if (story.SitePayout) creditSiteClear(player, record(story.SitePayout), event);
  else if (story.ExplorationReward) creditResource(player.entry, record(story.ExplorationReward));
  else throw new Error("Unexpected Frontier leaderboard story");
}

function creditSiteClear(player: Standing, payout: Row, event: HeraldHistoryEvent): void {
  const counts = player.entry.sites_cleared;
  switch (siteKindOf(number(payout.category))) {
    case "Camp":
      counts.camps++;
      break;
    case "Rift":
      counts.rifts++;
      break;
    case "Ruin":
      counts.ruins++;
      player.entry.chests_earned++;
      break;
    case "Stragglers":
      counts.stragglers++;
      break;
  }
  counts.total++;
  if (!player.lastClear || comparePosition(player.lastClear, event) < 0) player.lastClear = event;
  if (payout.reward !== null) creditResource(player.entry, record(payout.reward));
}

/** Essence and labor stay in game precision; a ruin's chest counts in whole LORDS. */
function creditResource(entry: HeraldFrontierLeaderboardEntry, reward: Row): void {
  const resource = number(reward.resource_type);
  const amount = integer(reward.amount);
  if (amount < 0n) throw new Error("Negative Frontier reward");
  if (resource === ResourcesIds.Lords) {
    entry.rewards.lords = (integer(entry.rewards.lords) + amount / BigInt(RESOURCE_PRECISION)).toString();
    return;
  }
  const key = resource === ResourcesIds.Essence ? "essence" : resource === ResourcesIds.Labor ? "labor" : undefined;
  if (key) entry.rewards[key] = (integer(entry.rewards[key]) + amount).toString();
}

function comparePosition(a: HeraldHistoryEvent, b: HeraldHistoryEvent): number {
  return a.block_number - b.block_number || a.transaction_index - b.transaction_index || a.event_index - b.event_index;
}

function compareStandings(a: Standing, b: Standing): number {
  return (
    b.entry.sites_cleared.total - a.entry.sites_cleared.total ||
    b.entry.deepest_depth - a.entry.deepest_depth ||
    (a.lastClear && b.lastClear ? comparePosition(a.lastClear, b.lastClear) : 0) ||
    a.entry.address.localeCompare(b.entry.address)
  );
}
