import type {
  HeraldFrontierLeaderboard,
  HeraldFrontierPrize,
  HeraldFrontierLeaderboardEntry,
  HeraldHistoryEvent,
} from "@bibliothecadao/eternum/game-sync";
import { isRealmCategory, siteKindOf } from "@bibliothecadao/eternum/expeditions";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import type { FoldRow } from "../types";
import { address, gameRows, integer, number, record, required, type Row } from "./values";
import { frontierRewardOf } from "./frontier-rewards";

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
  const players = settledPlayers(gameRows(modelRows("Structure"), gameId), gameRows(modelRows("CampaignHome"), gameId));
  const receipts = new Set<string>();
  for (const event of history) {
    if (integer(event.game_id) !== integer(gameId)) throw new Error("Frontier history game mismatch");
    const receipt = `${event.transaction_hash}:${event.event_index}`;
    if (receipts.has(receipt)) continue;
    receipts.add(receipt);
    const player = players.get(address(event.value.owner));
    if (!player) throw new Error("Frontier reward has no settled realm");
    applyStory(player, event);
  }
  const standings = [...players.values()].sort(
    (a, b) => compareStandings(a, b) || a.entry.address.localeCompare(b.entry.address),
  );
  let rank = 0;
  const entries = standings.map((standing, index) => {
    if (index === 0 || compareStandings(standings[index - 1]!, standing) !== 0) rank = index + 1;
    return { ...standing.entry, rank };
  });
  return { game_id: integer(gameId).toString(), mode: "frontier", entries, prize: prizeOf(modelRows, gameId) };
}

/**
 * The season's top prizes from the game's own rows: FrontierPrize's pool (whole LORDS) and posted count, ChestRules'
 * top_n, and the award receipts (LordsWithdrawal rows with a prize rank), which name who each paid place went to. None
 * while the pool is not published (no row, or a zero pool) or the chest rules are unknown.
 */
function prizeOf(modelRows: (model: string) => FoldRow[], gameId: string): HeraldFrontierPrize | null {
  const prize = gameRows(modelRows("FrontierPrize"), gameId)[0];
  const chests = gameRows(modelRows("ChestRules"), gameId)[0];
  if (!prize || !chests || integer(prize.pool) === 0n) return null;
  const awards = gameRows(modelRows("LordsWithdrawal"), gameId)
    .filter((receipt) => integer(receipt.prize_rank) > 0n)
    .map((receipt) => ({
      rank: number(receipt.prize_rank),
      address: address(receipt.account),
      lords: integer(receipt.amount).toString(),
    }))
    .sort((a, b) => a.rank - b.rank);
  if (awards.some((award, index) => award.rank === awards[index - 1]?.rank))
    throw new Error("Frontier prize awarded twice");
  return {
    pool: integer(prize.pool).toString(),
    top_n: number(chests.top_n),
    count: prize.count === null || prize.count === undefined ? null : number(prize.count),
    awards,
  };
}

function settledPlayers(structures: Row[], campaignHomes: Row[]): Map<string, Standing> {
  const campaigns = new Map(
    campaignHomes.map((home) => [
      integer(home.home),
      { campaign_id: integer(home.campaign_id).toString(), tier: number(home.tier) },
    ]),
  );
  const players = new Map<string, Standing>();
  for (const structure of structures) {
    if (!isRealmCategory(number(record(structure.base).category))) continue;
    const owner = address(structure.owner);
    if (players.has(owner)) throw new Error("Frontier player has multiple settled realms");
    players.set(owner, {
      entry: {
        address: owner,
        structure_id: integer(structure.entity_id).toString(),
        campaign: campaigns.get(integer(structure.entity_id)) ?? null,
        rank: 0,
        sites_cleared: { total: 0, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
        chests_earned: 0,
        rewards: { lords: "0", essence: "0", labor: "0" },
        deepest_depth: number(record(structure.metadata).deepest_depth),
        level: number(record(structure.base).level),
        order: number(record(structure.metadata).order),
      },
    });
  }
  return players;
}

function applyStory(player: Standing, event: HeraldHistoryEvent): void {
  const reward = frontierRewardOf(event);
  if (!reward) throw new Error("Unexpected Frontier leaderboard story");
  switch (reward.kind) {
    case "SitePayout":
      creditSiteClear(player, reward.payload, event);
      break;
    case "ExplorationReward":
      creditResource(player.entry, reward.payload);
      break;
    case "RewardChestOpened":
      creditOpenedChest(player.entry, reward.payload);
      break;
    default:
      throw new Error(`Unhandled Frontier reward: ${reward.kind satisfies never}`);
  }
}

/** An opening records whole LORDS, including zero for an expired chest; it is never a site clear. */
function creditOpenedChest(entry: HeraldFrontierLeaderboardEntry, reward: Row): void {
  const amount = integer(reward.amount);
  if (amount < 0n) throw new Error("Negative Frontier reward");
  entry.chests_earned++;
  entry.rewards.lords = (integer(entry.rewards.lords) + amount).toString();
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
    case "Beasts":
      counts.beasts++;
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
    (a.lastClear && b.lastClear ? comparePosition(a.lastClear, b.lastClear) : 0)
  );
}
