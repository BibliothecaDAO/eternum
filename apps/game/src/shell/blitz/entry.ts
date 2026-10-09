import { useQuery } from "@tanstack/react-query";

import { type Credits, type EntrySplit, type LedgerPrices, type Registration, registerCalls } from "../value/ledger";
import { ledgerOf, type LedgerRef } from "../value/game-entry";

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
  /** The Realms account the ledger links to the payout wallet ("0x0" while none): the account it registers. */
  linkedAccount: string;
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
  | "linked-elsewhere";

/**
 * The panel's state: seated once registered; on a cancelled game, a refund until the paid LORDS and spent credits are
 * back; closed to anyone else once the game has started. The ledger registers the account it links to the payout
 * wallet, so before paying: linking until that link names the player's own Realms account, and a fault while it names
 * another. Then choosing, short of LORDS, or holding LORDS with no STRK for the network fee.
 */
export const entryState = (terms: EntryTerms, choice: EntryChoice, now: number, account: string): EntryState => {
  const { registration } = terms;
  if (registration.registered && terms.cancelled)
    return registration.paid > 0n || registration.swordCredit || registration.shieldCredit ? "refund" : "refunded";
  if (registration.registered) return "seated";
  if (now >= terms.start) return "closed";
  if (BigInt(terms.linkedAccount) === 0n) return "linking";
  if (BigInt(terms.linkedAccount) !== BigInt(account)) return "linked-elsewhere";
  if (terms.lords < entryCost(terms, choice).cash) return "short";
  if (terms.strk === 0n) return "no-strk";
  return "choose";
};

/** The wallet's calls for the chosen entry: approve what it pays in LORDS, then register. */
export const entryCalls = (ledger: LedgerRef, terms: EntryTerms, choice: EntryChoice) =>
  registerCalls(
    ledger.address,
    terms.lordsToken,
    ledger.key,
    choice.sword,
    choice.shield,
    entryCost(terms, choice).cash,
  );

export const entryTermsKey = (ledger: LedgerRef, wallet: string) =>
  ["ledger", "entry", ledger.address, ledger.key.shard, ledger.key.gameId, wallet] as const;

/** The entry's terms for the payout wallet, read from the ledger and the two tokens at the latest block. */
export const useEntryTerms = (ledger: LedgerRef | null, wallet: string | null) =>
  useQuery({
    queryKey: entryTermsKey(
      ledger ?? { address: "", chainId: "", feeToken: "", key: { shard: "", gameId: 0 } },
      wallet ?? "",
    ),
    queryFn: () => readEntryTerms(ledger as LedgerRef, wallet as string),
    enabled: ledger !== null && wallet !== null,
    // While the relay links the wallet to the account, read again soon: the entry opens as soon as the link lands.
    refetchInterval: (query) => (query.state.data && BigInt(query.state.data.linkedAccount) === 0n ? 5_000 : 15_000),
  });

const readEntryTerms = async (ledger: LedgerRef, wallet: string): Promise<EntryTerms> => {
  const read = ledgerOf(ledger);
  const [game, lordsToken, linkedAccount] = await Promise.all([
    read.game(ledger.key),
    read.lordsToken(),
    read.accountOfWallet(wallet),
  ]);
  const [preset, credits, registration, lords, strk] = await Promise.all([
    read.preset(game.presetId),
    read.credits(wallet),
    read.registration(ledger.key, wallet),
    read.balanceOf(lordsToken, wallet),
    read.balanceOf(ledger.feeToken, wallet),
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
    linkedAccount,
    lords,
    strk,
  };
};
