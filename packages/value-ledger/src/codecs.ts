import type { RpcProvider } from "starknet";

/**
 * GameLedger's structs as the views return them (infra-pr/ledger-interface.txt): felt arrays in the interface's field
 * order; u256 is low then high, bool is 0 or 1. The one decoder of each struct, for the client and the services.
 */

export interface Credits {
  swords: number;
  shields: number;
}

/**
 * A wallet's registration in a slot. `refundable` once the slot's close leaves it unseated; `gameId` the game that
 * consumed it (0 until one did); `paid` the cash it paid, 0 once refunded.
 */
export interface Registration {
  registered: boolean;
  sword: boolean;
  shield: boolean;
  swordCredit: boolean;
  shieldCredit: boolean;
  paid: bigint;
  refundable: boolean;
  gameId: number;
}

/** A game's result for one wallet: rank 0 until the results are on the ledger. MMR in whole points. */
export interface PlayerResult {
  rank: number;
  chestId: bigint;
  mmrBefore: number;
  mmrAfter: number;
}

/** What an opened chest delivered (the ChestOpened event): a cosmetic, a sword or shield credit, or LORDS. */
export type ChestContent =
  | { kind: "cosmetic"; attributes: string }
  | { kind: "sword" }
  | { kind: "shield" }
  | { kind: "lords"; amount: bigint };

/** Reads one felt array at a time, in the interface's order. */
const fields = (felts: readonly string[]) => {
  let at = 0;
  const next = () => {
    if (at >= felts.length) throw new Error("Ledger answer is shorter than its type");
    return BigInt(felts[at++]!);
  };
  return {
    number: () => Number(next()),
    bool: () => next() !== 0n,
    u128: () => next(),
    address: () => `0x${next().toString(16)}`,
    u256: () => {
      const low = next();
      return low + (next() << 128n);
    },
    skip: (count: number) => {
      for (let index = 0; index < count; index++) next();
    },
  };
};

/** A registration slot on the ledger: uncapped; its pool is the money not yet allocated to a game or refunded. */
export interface LedgerSlot {
  /** False until the launcher opens the slot on the ledger; every other field is then zero. */
  exists: boolean;
  seasonId: number;
  presetId: number;
  /** Registration closes at this Unix second, exclusive. */
  close: number;
  end: number;
  pool: string;
  registeredCount: number;
  cancelled: boolean;
}

/** Slot: season_id, exists, preset_id, close, end, pool (2), registered_count, cancelled. */
export const decodeLedgerSlot = (fields: readonly string[]): LedgerSlot => {
  if (fields.length !== 9) throw new Error("invalid_ledger_slot");
  return {
    exists: ledgerBool(fields[1]!),
    seasonId: ledgerInteger(fields[0]!),
    presetId: ledgerInteger(fields[2]!),
    close: ledgerInteger(fields[3]!),
    end: ledgerInteger(fields[4]!),
    pool: ledgerU256(fields[5]!, fields[6]!),
    registeredCount: ledgerInteger(fields[7]!),
    cancelled: ledgerBool(fields[8]!),
  };
};

/** PlayerResult: rank, chest_id, mmr_before, mmr_after. */
export const decodePlayerResult = (felts: readonly string[]): PlayerResult => {
  const read = fields(felts);
  return {
    rank: read.number(),
    chestId: read.u256(),
    mmrBefore: read.number(),
    mmrAfter: read.number(),
  };
};

/** ChestContent: kind, cosmetic, lords; kind 0 cosmetic, 1 sword credit, 2 shield credit, 3 LORDS (possibly zero). */
export const decodeChestContent = (felts: readonly string[]): ChestContent => {
  const read = fields(felts);
  const kind = read.number();
  const cosmetic = read.u128();
  const lords = read.u256();
  if (kind === 0) return { kind: "cosmetic", attributes: `0x${cosmetic.toString(16)}` };
  if (kind === 1) return { kind: "sword" };
  if (kind === 2) return { kind: "shield" };
  if (kind === 3) return { kind: "lords", amount: lords };
  throw new Error(`Unknown chest kind ${kind}`);
};

/** Credits: swords, shields. */
export const decodeCredits = (felts: readonly string[]): Credits => {
  const read = fields(felts);
  return { swords: read.number(), shields: read.number() };
};

export const ledgerInteger = (value: string): number => {
  const n = Number(unsigned(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("invalid_ledger_integer");
  return n;
};
export const ledgerBool = (value: string): boolean => {
  if (![0n, 1n].includes(unsigned(value))) throw new Error("invalid_ledger_bool");
  return unsigned(value) === 1n;
};
export const ledgerU256 = (low: string, high: string): string => {
  const a = unsigned(low),
    b = unsigned(high);
  if (a < 0n || b < 0n || a >= 2n ** 128n || b >= 2n ** 128n) throw new Error("invalid_u256_limb");
  return String(a + (b << 128n));
};
/**
 * Registration: registered, sword, shield, sword_credit, shield_credit, paid (2), refundable, game_id. It keeps
 * registered=true after a refund, which clears paid and the spent credits.
 */
export const decodeRegistration = (fields: readonly string[]): Registration => {
  if (fields.length !== 9) throw new Error("invalid_ledger_registration");
  return {
    registered: ledgerBool(fields[0]!),
    sword: ledgerBool(fields[1]!),
    shield: ledgerBool(fields[2]!),
    swordCredit: ledgerBool(fields[3]!),
    shieldCredit: ledgerBool(fields[4]!),
    paid: BigInt(ledgerU256(fields[5]!, fields[6]!)),
    refundable: ledgerBool(fields[7]!),
    gameId: ledgerInteger(fields[8]!),
  };
};

/** WithdrawalPayment: paid, season_id, wallet, amount (low, high); an all-zero row has no report. */
export const decodeWithdrawalPayment = (fields: readonly string[]) => {
  if (fields.length !== 5) throw new Error("invalid_payment_record");
  const paid = ledgerBool(fields[0]!);
  const seasonId = ledgerInteger(fields[1]!);
  const wallet = unsigned(fields[2]!);
  const amount = ledgerU256(fields[3]!, fields[4]!);
  if (amount === "0" && !paid && seasonId === 0 && wallet === 0n) return null;
  if (amount === "0" || (paid && wallet === 0n) || (!paid && wallet !== 0n)) throw new Error("invalid_payment_report");
  return { paid, seasonId, wallet: fields[2]!, amount };
};

/**
 * Chest: exists, season_id, band, requested, finished, requester, request_block. A mystery chest carries only its season
 * and rank band (0 best .. 4); its holder's open request burns it and fixes a future block, and the draw is finished
 * from that block's hash about ten blocks later, by anyone, delivering to the requester.
 */
export const decodeChest = (fields: readonly string[]) => {
  if (fields.length !== 7 || !ledgerBool(fields[0]!)) throw new Error("invalid_chest");
  return {
    seasonId: ledgerInteger(fields[1]!),
    band: ledgerInteger(fields[2]!),
    requested: ledgerBool(fields[3]!),
    finished: ledgerBool(fields[4]!),
    requester: fields[5]!,
    requestBlock: ledgerInteger(fields[6]!),
  };
};

/** get_season_winner returns the wallet and its allocated u256 share. */
export const decodeSeasonWinner = (fields: readonly string[]) => {
  if (fields.length !== 3 || unsigned(fields[0]!) === 0n) throw new Error("invalid_season_winner");
  return { wallet: fields[0]!, share: BigInt(ledgerU256(fields[1]!, fields[2]!)) };
};

export const decodeBlitzSeason = (fields: readonly string[]) => {
  if (fields.length !== 16 || !ledgerBool(fields[10]!)) throw new Error("invalid_ledger_season");
  return {
    participantCount: ledgerInteger(fields[2]!),
    topCount: ledgerInteger(fields[3]!),
    posted: ledgerBool(fields[4]!),
    challenged: ledgerBool(fields[5]!),
    reviewUntil: ledgerInteger(fields[6]!),
    settlementStarted: ledgerBool(fields[7]!),
    presetId: ledgerInteger(fields[11]!),
    start: ledgerInteger(fields[12]!),
    end: ledgerInteger(fields[13]!),
    pool: ledgerU256(fields[14]!, fields[15]!),
  };
};
/** One confirmed header format for immutable reads; no pending head can become a cache anchor. */
export const readConfirmedLedgerHead = async (provider: RpcProvider, number: number | "latest" = "latest") => {
  const block = await provider.getBlock(number);
  if (
    !("block_number" in block) ||
    !("block_hash" in block) ||
    !("status" in block) ||
    !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(block.status ?? "") ||
    !Number.isSafeInteger(block.block_number) ||
    block.block_number < 0 ||
    (number !== "latest" && block.block_number !== number) ||
    !Number.isSafeInteger(block.timestamp) ||
    block.timestamp < 0 ||
    typeof block.block_hash !== "string" ||
    !/^0x[0-9a-f]+$/i.test(block.block_hash)
  )
    throw new Error("ledger_head_unconfirmed");
  return { number: block.block_number, hash: block.block_hash, time: block.timestamp };
};

/** Published FrontierSeason backing and clock, shared by discovery and batched payments. */
export const decodeFrontierSeason = (fields: readonly string[]) => {
  if (fields.length !== 10) throw new Error("invalid_frontier_season");
  return {
    configured: ledgerBool(fields[0]!),
    start: ledgerInteger(fields[1]!),
    end: ledgerInteger(fields[2]!),
    pool: ledgerU256(fields[3]!, fields[4]!),
    paid: ledgerU256(fields[5]!, fields[6]!),
    closed: ledgerBool(fields[7]!),
    presetId: ledgerInteger(fields[8]!),
    seed: fields[9]!,
  };
};
/**
 * Preset: entry_fee (2), protocol_cut_bps, chest_lords_bps, paid_fraction_bps, decay_bps, sword_price (2),
 * shield_price (2), mmr (7), day_unit, bags, claim_window.
 */
export const decodeLedgerPreset = (fields: readonly string[]) => {
  if (fields.length !== 20) throw new Error("invalid_ledger_preset");
  return {
    entryFee: ledgerU256(fields[0]!, fields[1]!),
    protocolCut: ledgerInteger(fields[2]!),
    chestLords: ledgerInteger(fields[3]!),
    paidFraction: ledgerInteger(fields[4]!),
    decay: ledgerInteger(fields[5]!),
    swordPrice: ledgerU256(fields[6]!, fields[7]!),
    shieldPrice: ledgerU256(fields[8]!, fields[9]!),
    dayUnit: ledgerInteger(fields[17]!),
    bags: ledgerInteger(fields[18]!),
    claimWindow: ledgerInteger(fields[19]!),
  };
};

const unsigned = (value: string) => {
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value)) throw new Error("invalid_ledger_felt");
  return BigInt(value);
};
