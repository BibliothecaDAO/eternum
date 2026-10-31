import { constants } from "starknet";

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
  registeredAt: number;
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

/** ChestContent: kind, cosmetic, lords; kind 0 cosmetic, 1 sword credit, 2 shield credit, 3 LORDS settled by the ledger. */
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
 * Registration: registered, sword, shield, sword_credit, shield_credit, paid (2), refundable, game_id, registered_at. It keeps
 * registered=true after a refund, which clears paid and the spent credits.
 */
export const decodeRegistration = (fields: readonly string[]): Registration => {
  if (fields.length !== 10) throw new Error("invalid_ledger_registration");
  return {
    registered: ledgerBool(fields[0]!),
    sword: ledgerBool(fields[1]!),
    shield: ledgerBool(fields[2]!),
    swordCredit: ledgerBool(fields[3]!),
    shieldCredit: ledgerBool(fields[4]!),
    paid: BigInt(ledgerU256(fields[5]!, fields[6]!)),
    refundable: ledgerBool(fields[7]!),
    gameId: ledgerInteger(fields[8]!),
    registeredAt: ledgerInteger(fields[9]!),
  };
};

/** WithdrawalPayment includes the report timestamp; only an all-zero row has no report. */
export const decodeWithdrawalPayment = (fields: readonly string[]) => {
  if (fields.length !== 8) throw new Error("invalid_payment_record");
  const reportedAt = ledgerInteger(fields[7]!);
  const prizeRank = ledgerInteger(fields[5]!);
  const prizeCount = ledgerInteger(fields[6]!);
  if ((prizeRank === 0) !== (prizeCount === 0) || prizeRank > prizeCount || prizeCount > 100)
    throw new Error("invalid_payment_report");
  const paid = ledgerBool(fields[0]!);
  const seasonId = ledgerInteger(fields[1]!);
  const wallet = unsigned(fields[2]!);
  const amount = ledgerU256(fields[3]!, fields[4]!);
  if (amount === "0" && !paid && seasonId === 0 && wallet === 0n && prizeRank === 0 && reportedAt === 0) return null;
  if (amount === "0" || (paid && wallet === 0n)) throw new Error("invalid_payment_report");
  return { paid, seasonId, wallet: fields[2]!, amount, prizeRank, prizeCount, reportedAt };
};

/**
 * Chest: exists, season_id, band, requested, finished, requester, request_block. A mystery chest carries only its season
 * and rank band (0 best .. 4); its holder's open request burns it and fixes a future block, and the draw is finished
 * from that block's hash once Starknet serves it (`CHEST_DRAW_BLOCKS`), by anyone, delivering to the requester.
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

/**
 * Blocks from a chest's request until its draw can be finished: the draw reads the hash of the block after the request,
 * and Starknet serves a block's hash only from ten blocks later (the protocol's STORED_BLOCK_HASH_BUFFER), the bound the
 * ledger's open_finish asserts.
 */
export const CHEST_DRAW_BLOCKS = 11;

/** Blocks left before a requested chest's draw can be finished at `head`; 0 once open_finish may be sent. */
export const chestDrawBlocksLeft = (requestBlock: number, head: number): number =>
  Math.max(0, requestBlock + CHEST_DRAW_BLOCKS - head);

/**
 * ChestBandPreset: metadata, odds (common, uncommon, rare, epic, legendary, lords, sword, shield), lords_shares. A rank
 * band's token reward: `lordsShares` entry fees of the chest's season preset, drawn `lordsOdds` times in ten thousand
 * and paid whole or not at all. A band that draws no tokens has neither.
 */
export const decodeChestBand = (fields: readonly string[]) => {
  if (fields.length !== 10) throw new Error("invalid_chest_band");
  return { lordsOdds: ledgerInteger(fields[6]!), lordsShares: ledgerInteger(fields[9]!) };
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
export const readConfirmedLedgerHead = async (
  provider: { getBlock(number: number | "latest"): Promise<unknown> },
  number: number | "latest" = "latest",
) => {
  const block = await provider.getBlock(number);
  if (
    !block ||
    typeof block !== "object" ||
    !("block_number" in block) ||
    typeof block.block_number !== "number" ||
    !("block_hash" in block) ||
    !("status" in block) ||
    typeof block.status !== "string" ||
    !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(block.status ?? "") ||
    !Number.isSafeInteger(block.block_number) ||
    block.block_number < 0 ||
    (number !== "latest" && block.block_number !== number) ||
    !("timestamp" in block) ||
    typeof block.timestamp !== "number" ||
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
  if (fields.length !== 14 || !ledgerBool(fields[0]!)) throw new Error("invalid_frontier_season");
  const prizePool = ledgerU256(fields[10]!, fields[11]!);
  const prizePaid = ledgerU256(fields[12]!, fields[13]!);
  return {
    prizePool,
    prizePaid,
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
 * shield_price (2), mmr (6), day_unit, claim_window, frontier_top_n, frontier_chest_bps.
 */
export const LEDGER_PRESET_FIELD_COUNT = 20;

export const decodeLedgerPreset = (fields: readonly string[]) => {
  if (fields.length !== LEDGER_PRESET_FIELD_COUNT) throw new Error("invalid_ledger_preset");
  return {
    entryFee: ledgerU256(fields[0]!, fields[1]!),
    protocolCut: ledgerInteger(fields[2]!),
    chestLords: ledgerInteger(fields[3]!),
    paidFraction: ledgerInteger(fields[4]!),
    decay: ledgerInteger(fields[5]!),
    swordPrice: ledgerU256(fields[6]!, fields[7]!),
    shieldPrice: ledgerU256(fields[8]!, fields[9]!),
    /** Whether the preset's games are rated: mmr.enabled, the first of the six rating fields. */
    rated: ledgerBool(fields[10]!),
    dayUnit: ledgerInteger(fields[16]!),
    claimWindow: ledgerInteger(fields[17]!),
    frontierTopN: ledgerInteger(fields[18]!),
    frontierChestBps: ledgerInteger(fields[19]!),
  };
};

/** A wallet's rating if its game ended in the ranking asked: whole points before and after, and the signed change. */
export interface MmrPreview {
  wallet: string;
  mmrBefore: number;
  mmrAfter: number;
  delta: number;
}

/** MmrPreview array (preview_mmr): its length, then wallet, mmr_before, mmr_after, delta (i32) per wallet, in input order. */
export const decodeMmrPreviews = (fields: readonly string[]): MmrPreview[] => {
  const count = ledgerInteger(fields[0] ?? "");
  if (fields.length !== 1 + 4 * count) throw new Error("invalid_mmr_preview");
  return Array.from({ length: count }, (_, index) => {
    const [wallet, before, after, delta] = fields.slice(1 + 4 * index, 5 + 4 * index) as [
      string,
      string,
      string,
      string,
    ];
    return {
      wallet: `0x${unsigned(wallet).toString(16)}`,
      mmrBefore: ledgerInteger(before),
      mmrAfter: ledgerInteger(after),
      delta: ledgerI32(delta),
    };
  });
};

/** A signed i32 felt: a negative value arrives field-modulus encoded, as the prime minus its magnitude. */
const ledgerI32 = (value: string): number => {
  const felt = unsigned(value);
  if (felt >= constants.PRIME) throw new Error("invalid_ledger_i32");
  const signed = felt > constants.PRIME / 2n ? felt - constants.PRIME : felt;
  if (signed < -(2n ** 31n) || signed >= 2n ** 31n) throw new Error("invalid_ledger_i32");
  return Number(signed);
};

const unsigned = (value: string) => {
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value)) throw new Error("invalid_ledger_felt");
  return BigInt(value);
};
