import { type Call, hash, num, type ProviderInterface } from "starknet";

import {
  type ChestContent,
  decodeChest,
  decodeChestContent,
  decodeCredits,
  decodeGame,
  decodePlayerResult,
  decodePreset,
  decodeRegistration,
  decodeSeason,
} from "@realms-world/value-ledger/codecs";

/**
 * The client's side of GameLedger on Starknet (infra-pr/ledger-interface.txt): the reads the value screens show and
 * the calls a player's own wallet signs, decoded by the ledger's one codec module.
 */

/** A game on the ledger: its shard's chain id and its game id there. */
interface GameKey {
  shard: string;
  gameId: number;
}

const LORDS_UNIT = 10n ** 18n;

/** LORDS in whole units, as a player counts them (18 decimals on chain): what is held, rounded down. */
export const lordsOf = (wei: bigint): number => Number(wei / LORDS_UNIT);

/** LORDS still to find, in whole units rounded up: 0.4 short is 1 more, never 0. */
export const lordsShortOf = (wei: bigint): number => Number((wei + LORDS_UNIT - 1n) / LORDS_UNIT);

const CHEST_OPENED = hash.getSelectorFromName("ChestOpened");

const keyCalldata = (key: GameKey) => [key.shard, String(key.gameId)];
const u256 = (value: bigint) => [String(value & ((1n << 128n) - 1n)), String(value >> 128n)];
const flag = (value: boolean) => (value ? "1" : "0");

/** register(key, sword, shield), after approving the ledger's LORDS token for what the flags and seat cost in cash. */
export const registerCalls = (
  ledger: string,
  lords: string,
  key: GameKey,
  sword: boolean,
  shield: boolean,
  cash: bigint,
): Call[] => [
  ...(cash > 0n ? [{ contractAddress: lords, entrypoint: "approve", calldata: [ledger, ...u256(cash)] }] : []),
  { contractAddress: ledger, entrypoint: "register", calldata: [...keyCalldata(key), flag(sword), flag(shield)] },
];

/** Chest.approve(ledger, token) then open_request(token): the holder's one signature; the chest burns, no way back. */
export const openChestCalls = (ledger: string, chest: string, tokenId: bigint): Call[] => [
  { contractAddress: chest, entrypoint: "approve", calldata: [ledger, ...u256(tokenId)] },
  { contractAddress: ledger, entrypoint: "open_request", calldata: u256(tokenId) },
];

/** claim_season(season): a winner pulls their share once the review hour has passed. */
export const claimSeasonCall = (ledger: string, seasonId: number): Call => ({
  contractAddress: ledger,
  entrypoint: "claim_season",
  calldata: [String(seasonId)],
});

/** refund(key): a cancelled game's paid LORDS and spent credits come back to the payer. */
export const refundCall = (ledger: string, key: GameKey): Call => ({
  contractAddress: ledger,
  entrypoint: "refund",
  calldata: keyCalldata(key),
});

/**
 * The ledger's views and token balances, read at the latest block through our RPC. The LORDS token and the chest
 * collection are the ledger's own (its lords and chest_collection views), never constants of one network.
 */
export const ledgerReader = (provider: ProviderInterface, ledger: string) => {
  const view = (entrypoint: string, calldata: string[]) =>
    provider.callContract({ contractAddress: ledger, entrypoint, calldata });
  const balanceOf = async (token: string, owner: string) => {
    const [low, high] = await provider.callContract({
      contractAddress: token,
      entrypoint: "balance_of",
      calldata: [owner],
    });
    return BigInt(low) + (BigInt(high) << 128n);
  };
  return {
    lordsToken: async () => (await view("lords", []))[0],
    chestCollection: async () => (await view("chest_collection", []))[0],
    balanceOf,
    game: async (key: GameKey) => decodeGame(await view("get_game", keyCalldata(key))),
    preset: async (presetId: number) => decodePreset(await view("get_preset", [String(presetId)])),
    season: async (seasonId: number) => decodeSeason(await view("get_season", [String(seasonId)])),
    seasonWinner: async (seasonId: number, index: number) => {
      const [wallet, low, high] = await view("get_season_winner", [String(seasonId), String(index)]);
      return { wallet, share: BigInt(low) + (BigInt(high) << 128n) };
    },
    seasonClaimed: async (seasonId: number, owner: string) =>
      BigInt((await view("season_claimed", [String(seasonId), owner]))[0]) !== 0n,
    registration: async (key: GameKey, owner: string) =>
      decodeRegistration(await view("get_registration", [...keyCalldata(key), owner])),
    /** The game's registration at an index, in the order they were made: the wallet that paid and its account. */
    registeredPlayer: async (key: GameKey, index: number) => {
      const [wallet, account] = await view("get_registered_player", [...keyCalldata(key), String(index)]);
      return { wallet, account };
    },
    credits: async (owner: string) => decodeCredits(await view("get_credits", [owner])),
    result: async (key: GameKey, owner: string) =>
      decodePlayerResult(await view("get_player_result", [...keyCalldata(key), owner])),
    chest: async (tokenId: bigint) => decodeChest(await view("get_chest", u256(tokenId))),
    /** What a finished chest delivered: its ChestOpened event, searched from the block its request fixed. */
    chestContent: async (tokenId: bigint, fromBlock: number): Promise<ChestContent | null> => {
      const { events } = await provider.getEvents({
        address: ledger,
        from_block: { block_number: fromBlock },
        to_block: "latest",
        keys: [[CHEST_OPENED], ...u256(tokenId).map((limb) => [num.toHex(limb)])],
        chunk_size: 10,
      });
      return events[0] ? decodeChestContent(events[0].data) : null;
    },
    chestOwner: async (chest: string, tokenId: bigint) =>
      (await provider.callContract({ contractAddress: chest, entrypoint: "owner_of", calldata: u256(tokenId) }))[0],
  };
};
