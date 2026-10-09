import { useQuery } from "@tanstack/react-query";

import { mainnetProvider } from "@/runtime/mainnet-rpc";

import type { DirectoryGame } from "../herald";
import { type Chest, type GameKey, ledgerReader, type PlayerResult, type Registration } from "../value/ledger";

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

/** The chest's rank band, the one fact a sealed chest shows (rewards.html 3b: (rank − 1) ÷ (players − 1)). */
type Band = "top" | "upper" | "middle" | "lower" | "bottom";

export const bandOf = (rank: number, players: number): Band => {
  const share = players > 1 ? (rank - 1) / (players - 1) : 0;
  if (share <= 0.1) return "top";
  if (share <= 0.25) return "upper";
  if (share <= 0.5) return "middle";
  if (share <= 0.75) return "lower";
  return "bottom";
};

export interface Reward {
  result: PlayerResult;
  chest: Chest | null;
  /** Whether the payout wallet still holds the chest token. */
  held: boolean;
  registration: Registration;
  strk: bigint;
}

type RewardState = "pending" | "sealed" | "no-strk" | "opened" | "traded";

/**
 * Pending until the results are on the ledger; then a sealed chest the wallet holds (no STRK for the fee to open it,
 * or ready to), what it held once opened, or a chest that has left the wallet.
 */
export const rewardState = (reward: Reward): RewardState => {
  if (reward.result.rank === 0 || !reward.chest) return "pending";
  if (reward.chest.opened) return "opened";
  if (!reward.held) return "traded";
  return reward.strk === 0n ? "no-strk" : "sealed";
};

export const rewardKey = (ledger: GameLedger, wallet: string) =>
  ["ledger", "reward", ledger.address, ledger.key.shard, ledger.key.gameId, wallet] as const;

export const useReward = (ledger: GameLedger | null, wallet: string | null) =>
  useQuery({
    queryKey: rewardKey(ledger ?? { address: "", chest: "", key: { shard: "", gameId: 0 } }, wallet ?? ""),
    queryFn: () => readReward(ledger as GameLedger, wallet as string),
    enabled: ledger !== null && wallet !== null,
    refetchInterval: 30_000,
  });

const readReward = async (ledger: GameLedger, wallet: string): Promise<Reward> => {
  const read = ledgerReader(mainnetProvider(), ledger.address);
  const [result, registration, strk] = await Promise.all([
    read.result(ledger.key, wallet),
    read.registration(ledger.key, wallet),
    read.strk(wallet),
  ]);
  if (result.rank === 0 || result.chestId === 0n) return { result, chest: null, held: false, registration, strk };
  const chest = await read.chest(result.chestId);
  // An opened chest is burnt: no owner to ask.
  const held = !chest.opened && BigInt(await read.chestOwner(ledger.chest, result.chestId)) === BigInt(wallet);
  return { result, chest, held, registration, strk };
};
