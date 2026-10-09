import { type Call, hash, num, type ProviderInterface } from "starknet";

/**
 * The client's side of GameLedger on Starknet (infra-pr/ledger-interface.txt): the reads the value screens show and
 * the calls a player's own wallet signs. Results are felt arrays in the interface's field order; u256 is low then high,
 * bool is 0 or 1.
 */

/** A game on the ledger: its shard's chain id and its game id there. */
export interface GameKey {
  shard: string;
  gameId: number;
}

interface LedgerGame {
  seasonId: number;
  presetId: number;
  start: number;
  end: number;
  registeredCount: number;
  cancelled: boolean;
  finalized: boolean;
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
interface EntrySplit {
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

/** LORDS and STRK on Starknet mainnet: LORDS pays the entry, STRK the network fee. */
export const LORDS_TOKEN = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const STRK_TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/** LORDS in whole units, as a player counts them (18 decimals on chain). */
export const lordsOf = (wei: bigint): number => Number(wei / 10n ** 18n);

const CHEST_OPENED = hash.getSelectorFromName("ChestOpened");

const keyCalldata = (key: GameKey) => [key.shard, String(key.gameId)];
const u256 = (value: bigint) => [String(value & ((1n << 128n) - 1n)), String(value >> 128n)];
const flag = (value: boolean) => (value ? "1" : "0");

/** register(key, sword, shield), after LORDS.approve for what the flags and seat cost in cash. */
export const registerCalls = (ledger: string, key: GameKey, sword: boolean, shield: boolean, cash: bigint): Call[] => [
  ...(cash > 0n ? [{ contractAddress: LORDS_TOKEN, entrypoint: "approve", calldata: [ledger, ...u256(cash)] }] : []),
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

/** Game: season_id, exists, preset_id, start, end, pool, result_commitment, registered_count, cancelled, finalized. */
export const decodeGame = (felts: readonly string[]): LedgerGame => {
  const read = fields(felts);
  const seasonId = read.number();
  read.skip(1);
  const presetId = read.number();
  const start = read.number();
  const end = read.number();
  read.skip(3);
  return {
    seasonId,
    presetId,
    start,
    end,
    registeredCount: read.number(),
    cancelled: read.bool(),
    finalized: read.bool(),
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

/** The ledger's views and the two tokens' balances, read at the latest block through our RPC. */
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
    lords: (owner: string) => balanceOf(LORDS_TOKEN, owner),
    strk: (owner: string) => balanceOf(STRK_TOKEN, owner),
  };
};
