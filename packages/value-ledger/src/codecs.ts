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
    return BigInt(felts[at++]);
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

/** Preset: entry_fee, protocol_cut_bps, chest_lords_bps, paid_fraction_bps, decay_bps, sword_price, shield_price, mmr. */
export const decodePreset = (felts: readonly string[]): LedgerPrices & PayoutCurve & EntrySplit => {
  const read = fields(felts);
  const seat = read.u256();
  const protocolCutBps = read.number();
  const chestLordsBps = read.number();
  const paidFractionBps = read.number();
  const decayBps = read.number();
  return { seat, sword: read.u256(), shield: read.u256(), paidFractionBps, decayBps, protocolCutBps, chestLordsBps };
};

/**
 * BlitzSeason: chest_reserve, participant_count, top_count, posted, challenged, review_until, settlement_started, paid, exists,
 * preset_id, start, end, pool.
 */
export const decodeSeason = (felts: readonly string[]): BlitzSeason => {
  const read = fields(felts);
  read.skip(2);
  const participants = read.number();
  const winners = read.number();
  const posted = read.bool();
  const challenged = read.bool();
  const reviewUntil = read.number();
  read.skip(4);
  return {
    participants,
    winners,
    posted,
    challenged,
    reviewUntil,
    presetId: read.number(),
    start: read.number(),
    end: read.number(),
    pool: read.u256(),
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
