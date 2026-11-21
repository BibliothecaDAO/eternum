import { type Call, hash, num, type ProviderInterface } from "starknet";

import { decodeFrontierSeason, decodeWithdrawalPayment } from "@realms-world/value-ledger/codecs";

import { L2_LEDGER, l2Provider } from "@/runtime/l2-rpc";

/**
 * The client's side of GameLedger on Starknet: the reads the value screens show and the calls a player's own wallet
 * signs, on the environment's one ledger, decoded by the ledger's one codec module.
 */

const LORDS_UNIT = 10n ** 18n;

/** LORDS in whole units, as a player counts them (18 decimals on chain): what is held, rounded down. */
export const lordsOf = (wei: bigint): number => Number(wei / LORDS_UNIT);

/** LORDS typed by a player ("12", "0.5") in wei; null when it is not an amount. */
export const lordsWeiOf = (typed: string): bigint | null => {
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(typed.trim());
  if (!match) return null;
  return BigInt(match[1]!) * LORDS_UNIT + BigInt((match[2] ?? "").padEnd(18, "0"));
};

/** Wei as a player types LORDS, every decimal kept and none trailing: lordsWeiOf's inverse. */
export const lordsTextOf = (wei: bigint): string => {
  const fraction = (wei % LORDS_UNIT).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${wei / LORDS_UNIT}.${fraction}` : String(wei / LORDS_UNIT);
};

/**
 * Wei as LORDS to two decimals, for a network fee and what pays it: a fee rounded up, so the most shown is never under
 * what it may take; a balance rounded down, so what is shown held is never more than is.
 */
export const lordsCentsTextOf = (wei: bigint, rounding: "up" | "down"): string => {
  const cent = LORDS_UNIT / 100n;
  const cents = rounding === "up" ? (wei + cent - 1n) / cent : wei / cent;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
};

/** Wei cut down to whole cents of LORDS: an amount offered to send, written as lordsCentsTextOf shows it. */
export const lordsDownToCents = (wei: bigint): bigint => wei - (wei % (LORDS_UNIT / 100n));

const WITHDRAWAL_PAID = hash.getSelectorFromName("WithdrawalPaid");

const u256 = (value: bigint) => [String(value & ((1n << 128n) - 1n)), String(value >> 128n)];

/** transfer(recipient, amount) on the ledger's LORDS token: a default wallet's Send. */
export const transferLordsCall = (lords: string, recipient: string, amount: bigint): Call => ({
  contractAddress: lords,
  entrypoint: "transfer",
  calldata: [recipient, ...u256(amount)],
});

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
    balanceOf,
    /**
     * A Frontier season's claims on the ledger: the moment its unpaid withdrawals lapse (the game's end and its claim
     * window), and whether it has closed, its unpaid withdrawals then void and returned to the treasury.
     */
    frontierClaims: async (shard: string, seasonId: number) => {
      const [deadline, season] = await Promise.all([
        view("frontier_claim_deadline", [shard, String(seasonId)]),
        view("get_frontier", [shard, String(seasonId)]),
      ]);
      return { deadline: Number(BigInt(deadline[0]!)), closed: decodeFrontierSeason(season).closed };
    },
    /** Whether the ledger has paid a withdrawal's claim; one it has no report of yet is unpaid. */
    paid: async (shard: string, claimId: string) =>
      decodeWithdrawalPayment(await view("get_payment", [shard, claimId]))?.paid ?? false,
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
  };
};

/**
 * The environment's one ledger and its reads (the address from its address book, never from a service's reply); null
 * until the ledger is deployed on the environment's L2, when every paid surface shows that it cannot be read.
 */
export const environmentLedger = () =>
  L2_LEDGER === null ? null : { address: L2_LEDGER, ...ledgerReader(l2Provider(), L2_LEDGER) };
