import { type Call, hash, num, type ProviderInterface } from "starknet";

import {
  type ChestContent,
  decodeChest,
  decodeChestContent,
  decodeCredits,
  decodeBlitzSeason,
  decodeLedgerPreset,
  decodeLedgerSlot,
  decodePlayerResult,
  decodeRegistration,
  decodeSeasonWinner,
  decodeWithdrawalPayment,
} from "@realms-world/value-ledger/codecs";

import { L2_LEDGER, l2Provider } from "@/runtime/l2-rpc";

/**
 * The client's side of GameLedger on Starknet: the reads the value screens show and the calls a player's own wallet
 * signs, on the environment's one ledger, decoded by the ledger's one codec module.
 */

export interface LedgerPrices {
  seat: bigint;
  sword: bigint;
  shield: bigint;
}

/** The preset's season payout: the share of participants paid and how each place's weight decays from the one above. */
export interface PayoutCurve {
  paidFractionBps: number;
  decayBps: number;
}

/** A Blitz season on the ledger: its window, its pool, and its top list once posted. Times are Unix seconds. */
export interface BlitzSeason {
  participants: number;
  winners: number;
  posted: boolean;
  challenged: boolean;
  reviewUntil: number;
  presetId: number;
  start: number;
  end: number;
  pool: bigint;
}

/**
 * Where a game's pot goes at settle: the treasury's cut first, then the chests' share of what is left to the season's
 * chest reserve, the rest to the season pool.
 */
export interface EntrySplit {
  protocolCutBps: number;
  chestLordsBps: number;
}

/** A registration slot on the ledger: the shard its games are created on, and its slot number there. */
export interface SlotKey {
  shard: string;
  slotId: number;
}

/** A played game on the ledger, for its result and chests: its shard's chain id and its game id there. */
export interface GameKey {
  shard: string;
  gameId: number;
}

const LORDS_UNIT = 10n ** 18n;

/** LORDS in whole units, as a player counts them (18 decimals on chain): what is held, rounded down. */
export const lordsOf = (wei: bigint): number => Number(wei / LORDS_UNIT);

/** LORDS still to find, in whole units rounded up: 0.4 short is 1 more, never 0. */
export const lordsShortOf = (wei: bigint): number => Number((wei + LORDS_UNIT - 1n) / LORDS_UNIT);

const CHEST_OPENED = hash.getSelectorFromName("ChestOpened");
const WITHDRAWAL_PAID = hash.getSelectorFromName("WithdrawalPaid");
const REGISTERED = hash.getSelectorFromName("Registered");

const keyCalldata = (key: SlotKey | GameKey) => [key.shard, String("slotId" in key ? key.slotId : key.gameId)];
const u256 = (value: bigint) => [String(value & ((1n << 128n) - 1n)), String(value >> 128n)];
const flag = (value: boolean) => (value ? "1" : "0");

/** register(slot, sword, shield), after approving the ledger's LORDS token for what the flags and seat cost in cash. */
export const registerCalls = (
  ledger: string,
  lords: string,
  key: SlotKey,
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

/**
 * claim_season(season, position): a winner pulls their share once the review hour has passed, naming its zero-based
 * place on the posted list, which the ledger checks names the caller.
 */
export const claimSeasonCall = (ledger: string, seasonId: number, position: number): Call => ({
  contractAddress: ledger,
  entrypoint: "claim_season",
  calldata: [String(seasonId), String(position)],
});

/** refund(slot): a cancelled slot's, or an unseated registration's, paid LORDS and spent credits come back to the payer. */
export const refundCall = (ledger: string, key: SlotKey): Call => ({
  contractAddress: ledger,
  entrypoint: "refund",
  calldata: keyCalldata(key),
});

/** A preset's entry prices, payout curve and pot split, as the entry and the season panels read them. */
const presetTermsOf = (preset: ReturnType<typeof decodeLedgerPreset>): LedgerPrices & PayoutCurve & EntrySplit => ({
  seat: BigInt(preset.entryFee),
  sword: BigInt(preset.swordPrice),
  shield: BigInt(preset.shieldPrice),
  paidFractionBps: preset.paidFraction,
  decayBps: preset.decay,
  protocolCutBps: preset.protocolCut,
  chestLordsBps: preset.chestLords,
});

const blitzSeasonOf = (season: ReturnType<typeof decodeBlitzSeason>): BlitzSeason => ({
  participants: season.participantCount,
  winners: season.topCount,
  posted: season.posted,
  challenged: season.challenged,
  reviewUntil: season.reviewUntil,
  presetId: season.presetId,
  start: season.start,
  end: season.end,
  pool: BigInt(season.pool),
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
    /** A listed slot the ledger does not hold is a broken listing, said as one. */
    slot: async (key: SlotKey) => {
      const slot = decodeLedgerSlot(await view("get_slot", keyCalldata(key)));
      if (!slot.exists) throw new Error("invalid_ledger_slot");
      return slot;
    },
    preset: async (presetId: number) => presetTermsOf(decodeLedgerPreset(await view("get_preset", [String(presetId)]))),
    season: async (seasonId: number) => blitzSeasonOf(decodeBlitzSeason(await view("get_season", [String(seasonId)]))),
    seasonWinner: async (seasonId: number, index: number) =>
      decodeSeasonWinner(await view("get_season_winner", [String(seasonId), String(index)])),
    seasonClaimed: async (seasonId: number, owner: string) =>
      BigInt((await view("season_claimed", [String(seasonId), owner]))[0]) !== 0n,
    registration: async (key: SlotKey, owner: string) =>
      decodeRegistration(await view("get_registration", [...keyCalldata(key), owner])),
    /**
     * Every slot a wallet ever registered in: its own Registered events (keyed by slot and owner), one filtered query
     * followed to its last page.
     */
    registeredSlots: async (owner: string): Promise<SlotKey[]> => {
      const slots: SlotKey[] = [];
      let token: string | undefined;
      do {
        const page = await provider.getEvents({
          address: ledger,
          from_block: { block_number: 0 },
          to_block: "latest",
          keys: [[REGISTERED], [], [], [num.toHex(owner)]],
          chunk_size: 100,
          ...(token ? { continuation_token: token } : {}),
        });
        for (const event of page.events) slots.push({ shard: event.keys[1], slotId: Number(BigInt(event.keys[2])) });
        token = page.continuation_token;
      } while (token);
      return slots;
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
    /** Whether payouts are paused: the ledger then pays no withdrawal until it resumes. */
    paused: async () => BigInt((await view("is_paused", []))[0]) !== 0n,
    /** A Frontier withdrawal on the ledger, by its shard and claim (the withdrawal's transaction there); null until reported. */
    payment: async (shard: string, claimId: string) =>
      decodeWithdrawalPayment(await view("get_payment", [shard, claimId])),
    /** The Starknet transaction that paid a claim: its WithdrawalPaid event, searched from the block the claim was made at. */
    paymentTransaction: async (shard: string, claimId: string, fromBlock: number): Promise<string | null> => {
      const { events } = await provider.getEvents({
        address: ledger,
        from_block: { block_number: fromBlock },
        to_block: "latest",
        keys: [[WITHDRAWAL_PAID], [num.toHex(shard)], [num.toHex(claimId)]],
        chunk_size: 10,
      });
      return events[0]?.transaction_hash ?? null;
    },
    latestBlock: () => provider.getBlockNumber(),
    chestOwner: async (chest: string, tokenId: bigint) =>
      (await provider.callContract({ contractAddress: chest, entrypoint: "owner_of", calldata: u256(tokenId) }))[0],
  };
};

/**
 * The environment's one ledger and its reads (the address from its address book, never from a service's reply); null
 * until the ledger is deployed on the environment's L2, when every paid surface shows that it cannot be read.
 */
export const environmentLedger = () =>
  L2_LEDGER === null ? null : { address: L2_LEDGER, ...ledgerReader(l2Provider(), L2_LEDGER) };

export type EnvironmentLedger = NonNullable<ReturnType<typeof environmentLedger>>;
