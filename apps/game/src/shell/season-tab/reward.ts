import { useQuery } from "@tanstack/react-query";

import { mainnetProvider } from "@/runtime/mainnet-rpc";

import type { DirectoryGame } from "../herald";
import {
  type Chest,
  type ChestContent,
  type GameKey,
  ledgerReader,
  type PlayerResult,
  type Registration,
} from "../value/ledger";

/**
 * A finished paid Blitz on the ledger (design 5h, owner 9 Oct: the result mints a chest token the player holds,
 * opens with their own wallet, or keeps and trades). The directory names the ledger and the chest collection a game
 * was played on; a game it does not name has no reward to show.
 */
export interface GameLedger {
  address: string;
  chest: string;
  key: GameKey;
}

export const gameLedgerOf = (game: DirectoryGame): GameLedger | null => {
  const ledger = (game as { ledger?: unknown }).ledger;
  if (typeof ledger !== "object" || ledger === null) return null;
  const { address, chest } = ledger as Record<string, unknown>;
  return typeof address === "string" && typeof chest === "string"
    ? { address, chest, key: { shard: game.chainId, gameId: game.game_id } }
    : null;
};

export interface Reward {
  result: PlayerResult;
  chest: Chest | null;
  /** Whether the payout wallet holds the chest token (a requested chest is burnt and held by nobody). */
  held: boolean;
  /** What the chest delivered, once its opening is finished. */
  content: ChestContent | null;
  /** The chest's season end: after it, the season's chest LORDS are swept into the prize pool. */
  seasonEnd: number;
  registration: Registration;
  strk: bigint;
}

type RewardState = "pending" | "sealed" | "no-strk" | "opening" | "opened" | "traded";

/**
 * Pending until the results are on the ledger; then a sealed chest the wallet holds (or no STRK for the open's fee);
 * opening from the wallet's request until the draw is finished about ten blocks later; then what it delivered. A chest
 * that left the wallet unopened, or that someone else opened, is gone from this player.
 */
export const rewardState = (reward: Reward, wallet: string): RewardState => {
  const { chest } = reward;
  if (reward.result.rank === 0 || !chest) return "pending";
  if (chest.requested && BigInt(chest.requester) === BigInt(wallet)) return chest.finished ? "opened" : "opening";
  if (!reward.held) return "traded";
  return reward.strk === 0n ? "no-strk" : "sealed";
};

export const rewardKey = (ledger: GameLedger, wallet: string) =>
  ["ledger", "reward", ledger.address, ledger.key.shard, ledger.key.gameId, wallet] as const;

/** Read every 30 s, every 5 s while the chest's draw is under way so the reveal comes as soon as it lands. */
export const useReward = (ledger: GameLedger | null, wallet: string | null) =>
  useQuery({
    queryKey: rewardKey(ledger ?? { address: "", chest: "", key: { shard: "", gameId: 0 } }, wallet ?? ""),
    queryFn: () => readReward(ledger as GameLedger, wallet as string),
    enabled: ledger !== null && wallet !== null,
    refetchInterval: (query) =>
      query.state.data?.chest?.requested && !query.state.data.chest.finished ? 5_000 : 30_000,
  });

const readReward = async (ledger: GameLedger, wallet: string): Promise<Reward> => {
  const read = ledgerReader(mainnetProvider(), ledger.address);
  const [result, registration, strk] = await Promise.all([
    read.result(ledger.key, wallet),
    read.registration(ledger.key, wallet),
    read.strk(wallet),
  ]);
  const none = { chest: null, held: false, content: null, seasonEnd: 0, registration, strk };
  if (result.rank === 0 || result.chestId === 0n) return { result, ...none };
  const chest = await read.chest(result.chestId);
  const [season, held, content] = await Promise.all([
    read.season(chest.seasonId),
    // A requested chest is burnt: no owner to ask.
    chest.requested
      ? false
      : read.chestOwner(ledger.chest, result.chestId).then((owner) => BigInt(owner) === BigInt(wallet)),
    chest.finished ? read.chestContent(result.chestId, chest.requestBlock) : null,
  ]);
  return { result, chest, held, content, seasonEnd: season.end, registration, strk };
};
