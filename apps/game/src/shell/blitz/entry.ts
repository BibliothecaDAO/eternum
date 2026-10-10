import { useQuery } from "@tanstack/react-query";

import { type BlitzRow, rowEntryOf } from "../blitz-rows";
import type { Credits, Registration } from "@realms-world/value-ledger/codecs";
import { type EntrySplit, type LedgerPrices, registerCalls } from "../value/ledger";
import type { PaidGameLedger } from "@realms-world/identity";

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
  /** Seats registered of the ledger's cap: it takes no registration once they are equal. */
  seats: LedgerSeats;
  credits: Credits;
  registration: Registration;
  /** The ledger's LORDS token, which the entry approves. */
  lordsToken: string;
  lords: bigint;
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

type EntryState = "choose" | "short" | "seated" | "refund" | "refunded" | "closed" | "full";

/**
 * The panel's state: seated once registered; on a cancelled game, a refund until the paid LORDS and spent credits are
 * back; closed to anyone else once the game has started. Then choosing, or short of LORDS: a linked wallet pays at
 * once, the wallet sheet checking its STRK for the fee.
 */
export const entryState = (terms: EntryTerms, choice: EntryChoice, now: number): EntryState => {
  const { registration } = terms;
  if (registration.registered && terms.cancelled)
    return registration.paid > 0n || registration.swordCredit || registration.shieldCredit ? "refund" : "refunded";
  if (registration.registered) return "seated";
  if (now >= terms.start) return "closed";
  if (terms.seats.taken >= terms.seats.total) return "full";
  if (terms.lords < entryCost(terms, choice).cash) return "short";
  return "choose";
};

/** A paid game's seats on the ledger: registered, and its cap. */
interface LedgerSeats {
  taken: number;
  total: number;
}

const ledgerSeatsOf = (game: { registeredCount: number; registrationLimit: number }): LedgerSeats => ({
  taken: game.registeredCount,
  total: game.registrationLimit,
});

/**
 * A Blitz row's seats, taken of total: a paid slot's as the ledger counts them against its own cap (undefined until
 * it answers), any other row's as the launch service or Herald gives them. The one source for every seat count.
 */
export const useRowSeats = (row: BlitzRow | undefined): { filled?: number; total?: number } => {
  const entry = row ? rowEntryOf(row) : null;
  const ledger = row?.kind === "slot" && entry?.kind === "paid" ? entry.ledger : null;
  const seats = useQuery({
    queryKey: ledger ? ["ledger", "seats", ledger.address, ledger.shard, ledger.gameId] : ["ledger", "seats", "none"],
    queryFn: async () => ledgerSeatsOf(await ledgerOf(ledger as PaidGameLedger).game(ledger as PaidGameLedger)),
    enabled: ledger !== null,
    refetchInterval: 15_000,
  }).data;
  if (!row) return {};
  return ledger
    ? { filled: seats?.taken, total: seats?.total }
    : { filled: row.seats.filled ?? undefined, total: row.seats.total ?? undefined };
};

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
  const [preset, credits, registration, lords] = await Promise.all([
    read.preset(game.presetId),
    read.credits(wallet),
    read.registration(ledger, wallet),
    read.balanceOf(lordsToken, wallet),
  ]);
  const prices = { seat: preset.seat, sword: preset.sword, shield: preset.shield };
  const split = { protocolCutBps: preset.protocolCutBps, chestLordsBps: preset.chestLordsBps };
  return {
    prices,
    split,
    cancelled: game.cancelled,
    start: game.start,
    seats: ledgerSeatsOf(game),
    credits,
    registration,
    lordsToken,
    lords,
  };
};
