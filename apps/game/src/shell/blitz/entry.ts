import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { isSameStarknetAddress } from "@realms-world/identity";
import type { Credits, Registration } from "@realms-world/value-ledger/codecs";

import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";
import { readBrowserWallets } from "@/ui/modules/identity/browser-wallets";

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
 * The panel's state. A registration is "registered" until the slot's close draws its games, then "seated" once a game
 * of the slot froze the wallet on its roster (`onRoster`, which the shard decides and Herald serves). The ledger binds
 * a registration to its game only when that game's result is applied, so its game id says "settled", which is seated
 * too, and nothing sooner. On a cancelled slot, or a registration the close left unseated (refundable), a refund until
 * the paid LORDS and spent credits are back. Anyone else: closed once the slot has closed, else choosing or short of
 * LORDS (a linked wallet pays at once, the wallet sheet checking its STRK for the fee).
 */
export const entryState = (terms: EntryTerms, choice: EntryChoice, now: number, onRoster: boolean): EntryState => {
  const { registration } = terms;
  if (refundOwed(registration, terms.cancelled)) return "refund";
  if (registration.registered && registration.gameId === 0 && (terms.cancelled || registration.refundable))
    return "refunded";
  if (registration.registered) return onRoster || registration.gameId !== 0 ? "seated" : "registered";
  // A cancelled slot takes no entry, though its close may still be ahead: the ledger would refuse the call.
  if (terms.cancelled || now >= terms.close) return "closed";
  if (terms.lords < entryCost(terms, choice).cash) return "short";
  return "choose";
};

/**
 * Whether a registration is owed back: no game consumed it, its slot was cancelled or the close left it unseated, and
 * it still holds the LORDS it paid or a credit it spent. The ledger's own refund rule.
 */
const refundOwed = (registration: Registration, cancelled: boolean): boolean =>
  registration.registered &&
  registration.gameId === 0 &&
  (cancelled || registration.refundable) &&
  (registration.paid > 0n || registration.swordCredit || registration.shieldCredit);

const REFUNDS_OWED = ["ledger", "refund-owed"] as const;
export const registeredSlotsKey = (wallet: string) => [...REFUNDS_OWED, "registered", wallet] as const;
export const refundOwedKey = (key: SlotKey, wallet: string) =>
  [...REFUNDS_OWED, key.shard, key.slotId, wallet] as const;

/**
 * The closed slots that owe the player a refund, each by name with the wallet it is owed to: the Blitz list keeps
 * their rows so the refund stays in reach after the close. The wallet that paid takes the refund, so the payout wallet
 * is asked first and then the wallets of this browser, where one replaced since may still be owed. The reads are
 * bounded by a wallet's own play, never by how many slots the launch service lists: one query for the slots the wallet
 * registered in (its Registered events), then a registration read for each of those that is listed and closed, and the
 * slot's own (for its cancelled flag) only where it was not seated.
 */
export const useRefundSlots = (slots: readonly PlaytestSlot[], payout: string | null): ReadonlyMap<string, string> => {
  const ledger = environmentLedger();
  const reads = ledger !== null && slots.some((slot) => slot.closed);
  const wallets = useRefundWallets(payout, reads);
  const registered = useQueries({
    queries: wallets.map((wallet) => ({
      queryKey: registeredSlotsKey(wallet),
      queryFn: () => (ledger as EnvironmentLedger).registeredSlots(wallet),
      enabled: reads,
      staleTime: 60_000,
    })),
  });
  const entries = wallets.flatMap((wallet, index) =>
    slots
      .filter((slot) => slot.closed && registered[index]?.data?.some((key) => isSameSlot(key, slotKeyOf(slot))))
      .map((slot) => ({ slot, wallet })),
  );
  const owed = useQueries({
    queries: entries.map(({ slot, wallet }) => ({
      queryKey: refundOwedKey(slotKeyOf(slot), wallet),
      queryFn: () => readRefundOwed(ledger as EnvironmentLedger, slotKeyOf(slot), wallet),
      staleTime: 60_000,
    })),
  });
  const refunds = new Map<string, string>();
  entries.forEach(({ slot, wallet }, index) => {
    if (owed[index]?.data === true && !refunds.has(slot.name)) refunds.set(slot.name, wallet);
  });
  return refunds;
};

/** The wallets a refund may be owed to: the payout wallet first, then the accounts this browser's wallets share. */
const useRefundWallets = (payout: string | null, enabled: boolean): string[] => {
  const browser = useQuery({ queryKey: ["browser-wallets"], queryFn: readBrowserWallets, enabled, staleTime: 60_000 });
  const others = (browser.data ?? []).filter((wallet) => payout === null || !isSameStarknetAddress(wallet, payout));
  return [...(payout === null ? [] : [payout]), ...others];
};

/** A refund taken, or an entry paid, changes what the list's refund rows read. */
export const useRefundsChanged = () => {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: REFUNDS_OWED });
};

const isSameSlot = (a: SlotKey, b: SlotKey): boolean => a.slotId === b.slotId && feltEquals(a.shard, b.shard);

const readRefundOwed = async (ledger: EnvironmentLedger, key: SlotKey, wallet: string): Promise<boolean> => {
  const registration = await ledger.registration(key, wallet);
  if (!refundOwed(registration, true)) return false;
  return registration.refundable || (await ledger.slot(key)).cancelled;
};

/**
 * What a slot's chat room took its write decision on: the payout wallet, its registration in the slot and whether the
 * slot is cancelled (unread counts as none). The lobby opens the room again when it changes; the decision itself stays
 * the server's.
 */
export const chatMembershipOf = (
  wallet: string | null,
  terms: Pick<EntryTerms, "registration" | "cancelled"> | undefined,
): string =>
  [
    wallet,
    terms?.registration.registered ?? false,
    terms?.registration.paid ?? 0n,
    terms?.registration.refundable ?? false,
    terms?.cancelled ?? false,
  ].join(":");

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
