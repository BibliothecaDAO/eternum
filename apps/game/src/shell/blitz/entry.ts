import { useQuery } from "@tanstack/react-query";

import { type Credits, type EntrySplit, type LedgerPrices, type Registration, registerCalls } from "../value/ledger";
import type { LedgerLinkStatus, PaidGameLedger } from "@realms-world/identity";

import { ledgerOf } from "../value/game-entry";

/*
 * A paid Blitz (design 5h): its seat, sword and shield are bought on the ledger from the payout wallet, a credit won
 * from a chest paying for a flag. The launch service names the ledger game a slot fills (game-entry.ts).
 */

/** What the entry panel draws from: the game's prices and state, and the payer's credits, seat and balances. */
export interface EntryTerms {
  prices: LedgerPrices;
  split: EntrySplit;
  cancelled: boolean;
  /** The game's start (Unix seconds): the ledger takes no registration from then on. */
  start: number;
  credits: Credits;
  registration: Registration;
  /** The ledger's LORDS token, which the entry approves. */
  lordsToken: string;
  lords: bigint;
  strk: bigint;
}

export interface EntryChoice {
  sword: boolean;
  shield: boolean;
}

/**
 * Where the LORDS an entry pays go when its game settles (ledger-interface.txt, custody rules): the treasury's cut of
 * the pot, then the chests' share of what is left to the season's chest reserve, the rest to the season pool.
 */
export const entryShares = (cash: bigint, split: EntrySplit) => {
  const treasury = (cash * BigInt(split.protocolCutBps)) / 10_000n;
  const chests = ((cash - treasury) * BigInt(split.chestLordsBps)) / 10_000n;
  return { treasury, chests, pool: cash - treasury - chests };
};

/** The ledger spends a held credit before charging a flag's price (register, ledger-interface.txt). */
export const entryCost = (terms: Pick<EntryTerms, "prices" | "credits">, choice: EntryChoice) => {
  const swordCredit = choice.sword && terms.credits.swords > 0;
  const shieldCredit = choice.shield && terms.credits.shields > 0;
  const cash =
    terms.prices.seat +
    (choice.sword && !swordCredit ? terms.prices.sword : 0n) +
    (choice.shield && !shieldCredit ? terms.prices.shield : 0n);
  return { cash, swordCredit, shieldCredit };
};

type EntryState =
  | "choose"
  | "short"
  | "no-strk"
  | "seated"
  | "refund"
  | "refunded"
  | "closed"
  | "linking"
  | "linked-elsewhere"
  | "linked-other-ledger";

/**
 * Where the services' ledger link stands for this entry: confirmed for it, still linking, confirmed for another
 * account, or confirmed on another ledger or chain.
 */
type EntryLink = "confirmed" | "linking" | "elsewhere" | "other-ledger";

const sameFelt = (one: string, other: string) => BigInt(one) === BigInt(other);

/**
 * The ledger registers the account the relay links to the paying wallet, and the services say when that link is
 * confirmed on the ledger (session user.ledgerLink). A link not yet confirmed, or confirmed for a wallet other than
 * the payout wallet (a replacement still syncing), is linking. A link confirmed on another ledger or chain, or for
 * another account than the player's, never resolves by waiting: a fault. Readiness is never inferred.
 */
export const entryLinkOf = (
  link: LedgerLinkStatus,
  ledger: PaidGameLedger,
  wallet: string,
  account: string,
): EntryLink => {
  if (link.status !== "confirmed") return "linking";
  if (!sameFelt(link.ledger.address, ledger.address) || !sameFelt(link.ledger.chainId, ledger.chainId))
    return "other-ledger";
  if (link.wallet === null || !sameFelt(link.wallet, wallet)) return "linking";
  return sameFelt(link.account, account) ? "confirmed" : "elsewhere";
};

/**
 * The panel's state: seated once registered; on a cancelled game, a refund until the paid LORDS and spent credits are
 * back; closed to anyone else once the game has started; before paying, linking until the services confirm the link
 * and a fault while it names another account; a link not known yet (no payout wallet to link) is linking too, and only
 * paying ever waits on it. Then choosing, short of LORDS, or holding LORDS with no STRK for the network fee.
 */
export const entryState = (terms: EntryTerms, choice: EntryChoice, now: number, link: EntryLink | null): EntryState => {
  const { registration } = terms;
  if (registration.registered && terms.cancelled)
    return registration.paid > 0n || registration.swordCredit || registration.shieldCredit ? "refund" : "refunded";
  if (registration.registered) return "seated";
  if (now >= terms.start) return "closed";
  if (link === null || link === "linking") return "linking";
  if (link === "elsewhere") return "linked-elsewhere";
  if (link === "other-ledger") return "linked-other-ledger";
  if (terms.lords < entryCost(terms, choice).cash) return "short";
  if (terms.strk === 0n) return "no-strk";
  return "choose";
};

/** A paid game's seats as the ledger counts its registrations; undefined until it answers, or without a ledger. */
export const useLedgerSeats = (ledger: PaidGameLedger | null): number | undefined =>
  useQuery({
    queryKey: ledger ? ["ledger", "seats", ledger.address, ledger.shard, ledger.gameId] : ["ledger", "seats", "none"],
    queryFn: async () => (await ledgerOf(ledger as PaidGameLedger).game(ledger as PaidGameLedger)).registeredCount,
    enabled: ledger !== null,
    refetchInterval: 15_000,
  }).data;

/** The wallet's calls for the chosen entry: approve what it pays in LORDS, then register. */
export const entryCalls = (ledger: PaidGameLedger, terms: EntryTerms, choice: EntryChoice) =>
  registerCalls(ledger.address, terms.lordsToken, ledger, choice.sword, choice.shield, entryCost(terms, choice).cash);

export const entryTermsKey = (ledger: PaidGameLedger, wallet: string) =>
  ["ledger", "entry", ledger.address, ledger.shard, ledger.gameId, wallet] as const;

/** The entry's terms for the payout wallet, read from the ledger and the two tokens at the latest block. */
export const useEntryTerms = (ledger: PaidGameLedger | null, wallet: string | null) =>
  useQuery({
    queryKey: ledger ? entryTermsKey(ledger, wallet ?? "") : (["ledger", "entry", "none"] as const),
    queryFn: () => readEntryTerms(ledger as PaidGameLedger, wallet as string),
    enabled: ledger !== null && wallet !== null,
    refetchInterval: 15_000,
  });

const readEntryTerms = async (ledger: PaidGameLedger, wallet: string): Promise<EntryTerms> => {
  const read = ledgerOf(ledger);
  const [game, lordsToken] = await Promise.all([read.game(ledger), read.lordsToken()]);
  const [preset, credits, registration, lords, strk] = await Promise.all([
    read.preset(game.presetId),
    read.credits(wallet),
    read.registration(ledger, wallet),
    read.balanceOf(lordsToken, wallet),
    read.feeBalance(wallet),
  ]);
  const prices = { seat: preset.seat, sword: preset.sword, shield: preset.shield };
  const split = { protocolCutBps: preset.protocolCutBps, chestLordsBps: preset.chestLordsBps };
  return {
    prices,
    split,
    cancelled: game.cancelled,
    start: game.start,
    credits,
    registration,
    lordsToken,
    lords,
    strk,
  };
};
