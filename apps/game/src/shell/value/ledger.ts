import type { Call, ProviderInterface } from "starknet";

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

/** LORDS and STRK on Starknet mainnet: LORDS pays the entry, STRK the network fee. */
export const LORDS_TOKEN = "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const STRK_TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

/** LORDS in whole units, as a player counts them (18 decimals on chain). */
export const lordsOf = (wei: bigint): number => Number(wei / 10n ** 18n);

const keyCalldata = (key: GameKey) => [key.shard, String(key.gameId)];
const u256 = (value: bigint) => [String(value & ((1n << 128n) - 1n)), String(value >> 128n)];
const flag = (value: boolean) => (value ? "1" : "0");

/** register(key, sword, shield), after LORDS.approve for what the flags and seat cost in cash. */
export const registerCalls = (ledger: string, key: GameKey, sword: boolean, shield: boolean, cash: bigint): Call[] => [
  ...(cash > 0n ? [{ contractAddress: LORDS_TOKEN, entrypoint: "approve", calldata: [ledger, ...u256(cash)] }] : []),
  { contractAddress: ledger, entrypoint: "register", calldata: [...keyCalldata(key), flag(sword), flag(shield)] },
];

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
    u256: () => {
      const low = next();
      return low + (next() << 128n);
    },
    skip: (count: number) => {
      for (let index = 0; index < count; index++) next();
    },
  };
};

/** Game: season_id, exists, preset_id, start, end, pool, entries, result_commitment, registered_count, cancelled, finalized. */
export const decodeGame = (felts: readonly string[]): LedgerGame => {
  const read = fields(felts);
  const seasonId = read.number();
  read.skip(1);
  const presetId = read.number();
  const start = read.number();
  const end = read.number();
  read.skip(5);
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

/** Preset: entry_fee, chest_lords_bps, chest_metadata, paid_fraction_bps, decay_bps, sword_price, shield_price, mmr. */
export const decodePrices = (felts: readonly string[]): LedgerPrices => {
  const read = fields(felts);
  const seat = read.u256();
  read.skip(4);
  return { seat, sword: read.u256(), shield: read.u256() };
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
    prices: async (presetId: number) => decodePrices(await view("get_preset", [String(presetId)])),
    registration: async (key: GameKey, owner: string) =>
      decodeRegistration(await view("get_registration", [...keyCalldata(key), owner])),
    credits: async (owner: string) => decodeCredits(await view("get_credits", [owner])),
    lords: (owner: string) => balanceOf(LORDS_TOKEN, owner),
    strk: (owner: string) => balanceOf(STRK_TOKEN, owner),
  };
};
