import type { RpcProvider } from "starknet";

/**
 * GameLedger's structs as the views return them (infra-pr/ledger-interface.txt): felt arrays in the interface's field
 * order; u256 is low then high, bool is 0 or 1. The one decoder of each struct, for the client and the services.
 */

export interface LedgerGame {
  seasonId: number;
  /** False for a key the ledger has no game at: every other field is then zero. */
  exists: boolean;
  presetId: number;
  start: number;
  end: number;
  /** The results' commitment, set once results are recorded. */
  commitment: string;
  registeredCount: number;
  cancelled: boolean;
  finalized: boolean;
  /** The seat cap the ledger snapshotted from the preset: it registers nobody once the count reaches it. */
  registrationLimit: number;
}

export interface Credits {
  swords: number;
  shields: number;
}

export interface Registration {
  registered: boolean;
  sword: boolean;
  shield: boolean;
  swordCredit: boolean;
  shieldCredit: boolean;
  paid: bigint;
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

/**
 * A mystery chest: its season and rank band (0 best .. 4) are all it carries. Its holder's open request burns it and
 * fixes a future block; the draw is finished from that block's hash about ten blocks later, by anyone.
 */
export interface Chest {
  seasonId: number;
  band: number;
  requested: boolean;
  finished: boolean;
  /** Who asked to open it: the delivery goes to them. */
  requester: string;
  requestBlock: number;
}

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

/**
 * Game: season_id, exists, preset_id, start, end, pool, result_commitment, registered_count, cancelled, finalized,
 * registration_limit.
 */
export const decodeGame = (felts: readonly string[]): LedgerGame => {
  const read = fields(felts);
  const seasonId = read.number();
  const exists = read.bool();
  const presetId = read.number();
  const start = read.number();
  const end = read.number();
  read.skip(2);
  const commitment = read.address();
  return {
    seasonId,
    exists,
    presetId,
    start,
    end,
    commitment,
    registeredCount: read.number(),
    cancelled: read.bool(),
    finalized: read.bool(),
    registrationLimit: read.number(),
  };
};

/** Registration: registered, sword, shield, flags_consumed, sword_credit, shield_credit, paid, realm_id, pass_kind. */
export const decodeRegistration = (felts: readonly string[]): Registration => {
  const read = fields(felts);
  const registered = read.bool();
  const sword = read.bool();
  const shield = read.bool();
  read.skip(1);
  return { registered, sword, shield, swordCredit: read.bool(), shieldCredit: read.bool(), paid: read.u256() };
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

/** Chest: exists, season_id, band, requested, finished, requester, request_block. */
export const decodeChest = (felts: readonly string[]): Chest => {
  const read = fields(felts);
  read.skip(1);
  const seasonId = read.number();
  const band = read.number();
  const requested = read.bool();
  const finished = read.bool();
  const requester = read.address();
  return { seasonId, band, requested, finished, requester, requestBlock: read.number() };
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
  const n = Number(BigInt(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("invalid_ledger_integer");
  return n;
};
export const ledgerBool = (value: string): boolean => {
  if (![0n, 1n].includes(BigInt(value))) throw new Error("invalid_ledger_bool");
  return BigInt(value) === 1n;
};
export const ledgerU256 = (low: string, high: string): string => {
  const a = BigInt(low),
    b = BigInt(high);
  if (a < 0n || b < 0n || a >= 2n ** 128n || b >= 2n ** 128n) throw new Error("invalid_u256_limb");
  return String(a + (b << 128n));
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
 * shield_price (2), mmr (7), day_unit, bags, claim_window, registration_limit.
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
