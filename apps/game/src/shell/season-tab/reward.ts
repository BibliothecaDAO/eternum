import { skipToken, useQuery } from "@tanstack/react-query";

import { isSameStarknetAddress } from "@realms-world/identity";
import type { ChestContent, PlayerResult, Registration } from "@realms-world/value-ledger/codecs";

import type { EnvironmentLedger, GameKey, SlotKey } from "../value/ledger";

type Chest = Awaited<ReturnType<EnvironmentLedger["chest"]>>;

/*
 * A finished paid Blitz on the environment's ledger (design 5: the result mints a chest token the player holds,
 * opens with their own wallet, or keeps and trades), read by the game's own key for its seat's wallet; the
 * registration that paid the seat is the slot's.
 */

/** Where a played game's value is read: its own key, and the slot it was filled from. */
export interface PlayedGameKeys {
  game: GameKey;
  slot: SlotKey;
}

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
  /**
   * The chest's token reward: `shares` entry fees of its season's preset (`entryFee`, in the token's smallest unit),
   * paid whole while the season's reserve holds them, else replaced by another reward. No shares for a rank band that
   * draws no tokens, and none without a chest.
   */
  token: TokenReward;
  registration: Registration;
}

export interface TokenReward {
  shares: number;
  entryFee: bigint;
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
  if (chest.requested && isSameStarknetAddress(chest.requester, wallet)) return chest.finished ? "opened" : "opening";
  if (!reward.held) return "traded";
  return "sealed";
};

export const rewardKey = (keys: PlayedGameKeys, wallet: string) =>
  ["ledger", "reward", keys.game.shard, keys.game.gameId, wallet] as const;

/** Read every 30 s, every 5 s while the chest's draw is under way so the reveal comes as soon as it lands. */
export const useReward = (ledger: EnvironmentLedger, keys: PlayedGameKeys, wallet: string) =>
  useQuery({
    queryKey: rewardKey(keys, wallet),
    queryFn: () => readReward(ledger, keys, wallet),
    refetchInterval: (query) =>
      query.state.data?.chest?.requested && !query.state.data.chest.finished ? 5_000 : 30_000,
  });

/** The seat a finished game rewards: the ledger, the game's keys, and the wallet the roster froze for the player. */
export interface RewardSeat {
  ledger: EnvironmentLedger;
  keys: PlayedGameKeys;
  owner: string;
}

/**
 * Whether the seat's chest waits sealed in its wallet: its Open is then the Results page's one gold step. The same read
 * as the reward panel's, so it is asked once.
 */
export const useSealedChest = (seat: RewardSeat | null): boolean => {
  const reward = useQuery({
    queryKey: seat ? rewardKey(seat.keys, seat.owner) : ["ledger", "reward", "no-seat"],
    queryFn: seat ? () => readReward(seat.ledger, seat.keys, seat.owner) : skipToken,
  });
  return seat !== null && reward.data !== undefined && rewardState(reward.data, seat.owner) === "sealed";
};

const readReward = async (read: EnvironmentLedger, keys: PlayedGameKeys, wallet: string): Promise<Reward> => {
  const [result, registration, collection] = await Promise.all([
    read.result(keys.game, wallet),
    read.registration(keys.slot, wallet),
    read.chestCollection(),
  ]);
  const none = { collection, chest: null, held: false, content: null, seasonEnd: 0, token: NO_TOKENS, registration };
  if (result.rank === 0 || result.chestId === 0n) return { result, ...none };
  const chest = await read.chest(result.chestId);
  const [season, held, content] = await Promise.all([
    read.season(chest.seasonId),
    // A requested chest is burnt: no owner to ask.
    chest.requested
      ? false
      : read.chestOwner(collection, result.chestId).then((owner) => isSameStarknetAddress(owner, wallet)),
    chest.finished ? read.chestContent(result.chestId, chest.requestBlock) : null,
  ]);
  const token = await readTokenReward(read, season.presetId, chest.band);
  return { result, collection, chest, held, content, seasonEnd: season.end, token, registration };
};

const NO_TOKENS: TokenReward = { shares: 0, entryFee: 0n };

/**
 * A rank band's token reward under its season's preset: the band's shares of that preset's entry fee. A band the
 * preset gives no odds of tokens has no shares to show, whatever it stores.
 */
const readTokenReward = async (read: EnvironmentLedger, presetId: number, band: number): Promise<TokenReward> => {
  const [terms, drawn] = await Promise.all([read.preset(presetId), read.chestBand(presetId, band)]);
  return { shares: drawn.lordsOdds > 0 ? drawn.lordsShares : 0, entryFee: terms.seat };
};

/**
 * How many entry fees a delivered token reward is. The ledger pays a chest's tokens as whole shares of its slot's
 * entry, so this is a whole number; null where no entry fee divides the amount, and the amount then stands alone.
 */
export const entryMultipleOf = (amount: bigint, entryFee: bigint): number | null =>
  entryFee > 0n && amount % entryFee === 0n ? Number(amount / entryFee) : null;
