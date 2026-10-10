import { useQuery } from "@tanstack/react-query";

import type { Chest, ChestContent, PlayerResult, Registration } from "@realms-world/value-ledger/codecs";
import type { PaidGameLedger } from "@realms-world/identity";

import { ledgerOf } from "../value/game-entry";

/*
 * A finished paid Blitz on the ledger (design 5h, owner 9 Oct: the result mints a chest token the player holds,
 * opens with their own wallet, or keeps and trades). The directory names the ledger a game was played on
 * (game-entry.ts); a free game has no reward to show.
 */

export interface Reward {
  result: PlayerResult;
  /** The ledger's chest collection, which holds the chest token. */
  collection: string;
  chest: Chest | null;
  /** Whether the payout wallet holds the chest token (a requested chest is burnt and held by nobody). */
  held: boolean;
  /** What the chest delivered, once its opening is finished. */
  content: ChestContent | null;
  /** The chest's season end: after it, the season's chest LORDS are swept into the prize pool. */
  seasonEnd: number;
  registration: Registration;
}

type RewardState = "pending" | "sealed" | "opening" | "opened" | "traded";

/**
 * Pending until the results are on the ledger; then a sealed chest the wallet holds;
 * opening from the wallet's request until the draw is finished about ten blocks later; then what it delivered. A chest
 * that left the wallet unopened, or that someone else opened, is gone from this player.
 */
export const rewardState = (reward: Reward, wallet: string): RewardState => {
  const { chest } = reward;
  if (reward.result.rank === 0 || !chest) return "pending";
  if (chest.requested && BigInt(chest.requester) === BigInt(wallet)) return chest.finished ? "opened" : "opening";
  if (!reward.held) return "traded";
  return "sealed";
};

export const rewardKey = (ledger: PaidGameLedger, wallet: string) =>
  ["ledger", "reward", ledger.address, ledger.shard, ledger.gameId, wallet] as const;

/** Read every 30 s, every 5 s while the chest's draw is under way so the reveal comes as soon as it lands. */
export const useReward = (ledger: PaidGameLedger | null, wallet: string | null) =>
  useQuery({
    queryKey: ledger ? rewardKey(ledger, wallet ?? "") : (["ledger", "reward", "none"] as const),
    queryFn: () => readReward(ledger as PaidGameLedger, wallet as string),
    enabled: ledger !== null && wallet !== null,
    refetchInterval: (query) =>
      query.state.data?.chest?.requested && !query.state.data.chest.finished ? 5_000 : 30_000,
  });

const readReward = async (ledger: PaidGameLedger, wallet: string): Promise<Reward> => {
  const read = ledgerOf(ledger);
  const [result, registration, collection] = await Promise.all([
    read.result(ledger, wallet),
    read.registration(ledger, wallet),
    read.chestCollection(),
  ]);
  const none = { collection, chest: null, held: false, content: null, seasonEnd: 0, registration };
  if (result.rank === 0 || result.chestId === 0n) return { result, ...none };
  const chest = await read.chest(result.chestId);
  const [season, held, content] = await Promise.all([
    read.season(chest.seasonId),
    // A requested chest is burnt: no owner to ask.
    chest.requested
      ? false
      : read.chestOwner(collection, result.chestId).then((owner) => BigInt(owner) === BigInt(wallet)),
    chest.finished ? read.chestContent(result.chestId, chest.requestBlock) : null,
  ]);
  return { result, collection, chest, held, content, seasonEnd: season.end, registration };
};
