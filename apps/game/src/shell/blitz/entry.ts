import { useQuery } from "@tanstack/react-query";

import type { Credits, Registration } from "@realms-world/value-ledger/codecs";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import { slotKeyOf } from "../blitz-rows";
import {
  type EntrySplit,
  type EnvironmentLedger,
  environmentLedger,
  type LedgerPrices,
  registerCalls,
  type SlotKey,
} from "../value/ledger";

/*
 * A paid Blitz slot (design 5): its seat, sword and shield are bought on the environment's ledger from the payout
 * wallet, a credit won from a chest paying for a flag. Registration is uncapped; the slot splits into games at close.
 */

/** What the entry panel draws from: the slot's prices and state, and the payer's credits, registration and LORDS. */
export interface EntryTerms {
  prices: LedgerPrices;
  split: EntrySplit;
  cancelled: boolean;
  /** The slot's close (Unix seconds): the ledger takes no registration from then on. */
  close: number;
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

type EntryState = "choose" | "short" | "registered" | "seated" | "refund" | "refunded" | "closed";

/**
 * The panel's state. A registration is "registered" until the slot's close draws its games, then "seated" once the
 * ledger names its game; on a cancelled slot, or a registration the close left unseated (refundable), a refund until
 * the paid LORDS and spent credits are back. Anyone else: closed once the slot has closed, else choosing or short of
 * LORDS (a linked wallet pays at once, the wallet sheet checking its STRK for the fee).
 */
export const entryState = (terms: EntryTerms, choice: EntryChoice, now: number): EntryState => {
  const { registration } = terms;
  if (registration.registered && (terms.cancelled || registration.refundable))
    return registration.paid > 0n || registration.swordCredit || registration.shieldCredit ? "refund" : "refunded";
  if (registration.registered) return registration.gameId === 0 ? "registered" : "seated";
  if (now >= terms.close) return "closed";
  if (terms.lords < entryCost(terms, choice).cash) return "short";
  return "choose";
};

export const slotRegisteredKey = (key: SlotKey) => ["ledger", "registered", key.shard, key.slotId] as const;

/** A slot's registrations as the ledger counts them (uncapped: no total); undefined until it answers. */
export const useSlotRegistered = (slot: PlaytestSlot): number | undefined => {
  const ledger = environmentLedger();
  const key = slotKeyOf(slot);
  return useQuery({
    queryKey: slotRegisteredKey(key),
    queryFn: async () => (await (ledger as EnvironmentLedger).slot(key)).registeredCount,
    enabled: ledger !== null,
    refetchInterval: 15_000,
  }).data;
};

/** The wallet's calls for the chosen entry: approve what it pays in LORDS, then register in the slot. */
export const entryCalls = (ledger: string, key: SlotKey, terms: EntryTerms, choice: EntryChoice) =>
  registerCalls(ledger, terms.lordsToken, key, choice.sword, choice.shield, entryCost(terms, choice).cash);

export const entryTermsKey = (key: SlotKey, wallet: string) =>
  ["ledger", "entry", key.shard, key.slotId, wallet] as const;

/** The entry's terms for the payout wallet, read from the environment's ledger and LORDS at the latest block. */
export const useEntryTerms = (ledger: EnvironmentLedger, key: SlotKey, wallet: string | null) =>
  useQuery({
    queryKey: entryTermsKey(key, wallet ?? ""),
    queryFn: () => readEntryTerms(ledger, key, wallet as string),
    enabled: wallet !== null,
    refetchInterval: 15_000,
  });

const readEntryTerms = async (read: EnvironmentLedger, key: SlotKey, wallet: string): Promise<EntryTerms> => {
  const [slot, lordsToken] = await Promise.all([read.slot(key), read.lordsToken()]);
  const [preset, credits, registration, lords] = await Promise.all([
    read.preset(slot.presetId),
    read.credits(wallet),
    read.registration(key, wallet),
    read.balanceOf(lordsToken, wallet),
  ]);
  const prices = { seat: preset.seat, sword: preset.sword, shield: preset.shield };
  const split = { protocolCutBps: preset.protocolCutBps, chestLordsBps: preset.chestLordsBps };
  return { prices, split, cancelled: slot.cancelled, close: slot.close, credits, registration, lordsToken, lords };
};
