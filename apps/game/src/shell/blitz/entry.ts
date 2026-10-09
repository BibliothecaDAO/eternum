import { useQuery } from "@tanstack/react-query";

import { mainnetProvider } from "@/runtime/mainnet-rpc";
import type { PlaytestSlot } from "@/ui/features/factory-v2/api/factory-worker";

import {
  type Credits,
  type GameKey,
  type LedgerPrices,
  ledgerReader,
  type Registration,
  registerCalls,
} from "../value/ledger";

/**
 * A paid Blitz (design 5h): its seat, sword and shield are bought on the ledger from the payout wallet, a credit won
 * from a chest paying for a flag. The launch service names the ledger game a slot fills; a slot it does not name is
 * the free playtest join.
 */
export interface SlotLedger {
  address: string;
  key: GameKey;
}

export const slotLedgerOf = (slot: PlaytestSlot): SlotLedger | null => {
  const ledger = (slot as { ledger?: unknown }).ledger;
  if (typeof ledger !== "object" || ledger === null) return null;
  const { address, shard, gameId } = ledger as Record<string, unknown>;
  return typeof address === "string" && typeof shard === "string" && typeof gameId === "number"
    ? { address, key: { shard, gameId } }
    : null;
};

/** What the entry panel draws from: the game's prices and state, and the payer's credits, seat and balances. */
export interface EntryTerms {
  prices: LedgerPrices;
  cancelled: boolean;
  credits: Credits;
  registration: Registration;
  lords: bigint;
  strk: bigint;
}

export interface EntryChoice {
  sword: boolean;
  shield: boolean;
}

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

type EntryState = "choose" | "short" | "no-strk" | "seated" | "refund" | "refunded";

/**
 * The panel's state: seated once registered; on a cancelled game, a refund until the paid LORDS and spent credits are
 * back; otherwise choosing, short of LORDS, or holding LORDS with no STRK for the network fee.
 */
export const entryState = (terms: EntryTerms, choice: EntryChoice): EntryState => {
  const { registration } = terms;
  if (registration.registered && terms.cancelled)
    return registration.paid > 0n || registration.swordCredit || registration.shieldCredit ? "refund" : "refunded";
  if (registration.registered) return "seated";
  if (terms.lords < entryCost(terms, choice).cash) return "short";
  if (terms.strk === 0n) return "no-strk";
  return "choose";
};

/** The wallet's calls for the chosen entry: approve what it pays in LORDS, then register. */
export const entryCalls = (ledger: SlotLedger, terms: EntryTerms, choice: EntryChoice) =>
  registerCalls(ledger.address, ledger.key, choice.sword, choice.shield, entryCost(terms, choice).cash);

export const entryTermsKey = (ledger: SlotLedger, wallet: string) =>
  ["ledger", "entry", ledger.address, ledger.key.shard, ledger.key.gameId, wallet] as const;

/** The entry's terms for the payout wallet, read from the ledger and the two tokens at the latest block. */
export const useEntryTerms = (ledger: SlotLedger | null, wallet: string | null) =>
  useQuery({
    queryKey: entryTermsKey(ledger ?? { address: "", key: { shard: "", gameId: 0 } }, wallet ?? ""),
    queryFn: () => readEntryTerms(ledger as SlotLedger, wallet as string),
    enabled: ledger !== null && wallet !== null,
    refetchInterval: 15_000,
  });

const readEntryTerms = async (ledger: SlotLedger, wallet: string): Promise<EntryTerms> => {
  const read = ledgerReader(mainnetProvider(), ledger.address);
  const game = await read.game(ledger.key);
  const [prices, credits, registration, lords, strk] = await Promise.all([
    read.preset(game.presetId),
    read.credits(wallet),
    read.registration(ledger.key, wallet),
    read.lords(wallet),
    read.strk(wallet),
  ]);
  return { prices, cancelled: game.cancelled, credits, registration, lords, strk };
};
