import type {
  HeraldFrontierLeaderboard,
  HeraldFrontierLeaderboardEntry,
  HeraldHistoryEvent,
} from "@bibliothecadao/eternum/game-sync";
import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";
import { ResourcesIds } from "@bibliothecadao/types";
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
  const amounts = record(required(modelRows("ChestRules"), gameId, "ChestRules").lords_amounts);
  const players = settledPlayers(gameRows(modelRows("Structure"), gameId));
  const receipts = new Set<string>();
  for (const event of history) {
    if (integer(event.game_id) !== integer(gameId)) throw new Error("Frontier history game mismatch");
    const receipt = `${event.transaction_hash}:${event.event_index}`;
    if (receipts.has(receipt)) continue;
    receipts.add(receipt);
    const player = players.get(address(event.value.owner));
    if (!player) throw new Error("Frontier reward has no settled realm");
    applyStory(player, record(event.value.story), amounts, event);
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
        sites_cleared: { total: 0, camps: 0, rifts: 0, fallen_realms: 0 },
        chests_earned: 0,
        rewards: { lords: "0", essence: "0", labor: "0" },
        deepest_depth: number(record(structure.metadata).deepest_depth),
      },
    });
  }
  return players;
}

function applyStory(player: Standing, story: Row, amounts: Row, event: HeraldHistoryEvent): void {
  if (story.SitePayout) creditSiteClear(player, record(story.SitePayout), event);
  else if (story.ExplorationReward) creditResource(player.entry, record(story.ExplorationReward));
  else if (story.ChestReward) creditChest(player.entry, record(story.ChestReward), amounts);
  else throw new Error("Unexpected Frontier leaderboard story");
}

function creditSiteClear(player: Standing, payout: Row, event: HeraldHistoryEvent): void {
  const counts = player.entry.sites_cleared;
  switch (payout.kind) {
    case "Camp":
      counts.camps++;
      break;
    case "Rift":
      counts.rifts++;
      break;
    case "FallenRealm":
      counts.fallen_realms++;
      break;
    default:
      throw new Error("Unknown Frontier site kind");
  }
  counts.total++;
  if (!player.lastClear || comparePosition(player.lastClear, event) < 0) player.lastClear = event;
  if (payout.reward !== null) creditResource(player.entry, record(payout.reward));
}

function creditChest(entry: HeraldFrontierLeaderboardEntry, chest: Row, amounts: Row): void {
  const quality = number(chest.quality);
  const key = ["common", "uncommon", "rare", "epic"][quality];
  if (!key) throw new Error("Invalid Frontier chest quality");
  const amount = integer(amounts[key]);
  if (amount <= 0n) throw new Error("Missing Frontier LORDS amount");
  if (chest.kind !== "Token" && chest.kind !== "Relic") throw new Error("Invalid Frontier chest kind");
  entry.chests_earned++;
  if (chest.kind === "Token") entry.rewards.lords = (integer(entry.rewards.lords) + amount).toString();
}

function creditResource(entry: HeraldFrontierLeaderboardEntry, reward: Row): void {
  const resource = number(reward.resource_type);
  const key = resource === ResourcesIds.Essence ? "essence" : resource === ResourcesIds.Labor ? "labor" : undefined;
  if (!key) return;
  const amount = integer(reward.amount);
  if (amount < 0n) throw new Error("Negative Frontier reward");
  entry.rewards[key] = (integer(entry.rewards[key]) + amount).toString();
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
