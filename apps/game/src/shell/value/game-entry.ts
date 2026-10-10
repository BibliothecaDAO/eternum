import { type GameEntry as ServicesGameEntry, type PaidGameLedger, readGameEntry } from "@realms-world/identity";

import { isL2Chain, L2_CHAIN, L2_LEDGER, l2Provider } from "@/runtime/l2-rpc";

import { ledgerReader } from "./ledger";

/**
 * How a slot or a directory game is entered, from the services' required `entry`: free, or paid on the ledger it
 * names. A missing or malformed entry is broken, a fault shown as such and never the free join.
 */
type GameEntry = ServicesGameEntry | { kind: "broken" };

const BROKEN: GameEntry = { kind: "broken" };

/** Reasons already logged, per slot or game: an entry is read on every render, its fault is logged once. */
const reported = new Set<string>();

/** A broken entry, with its reason logged once against the slot or game it belongs to. */
const broken = (id: string, reason: string): GameEntry => {
  const key = `${id}\n${reason}`;
  if (!reported.has(key)) {
    reported.add(key);
    console.error("game_entry_unreadable", { id, reason });
  }
  return BROKEN;
};

/**
 * A slot's or game's entry; `id` names it in the log when the entry is broken. A paid entry is honoured only on this
 * build's own ledger: the address a wallet approves its LORDS and chests to never comes from a service payload.
 */
export const gameEntryOf = (payload: { entry?: unknown }, id: string): GameEntry => {
  let entry: ServicesGameEntry;
  try {
    entry = readGameEntry(payload.entry);
  } catch (error) {
    return broken(id, error instanceof Error ? error.message : String(error));
  }
  const foreign = entry.kind === "paid" ? foreignLedger(entry.ledger) : null;
  return foreign ? broken(id, foreign) : entry;
};

/** Why a paid entry's ledger is not this build's, or null when it is. */
const foreignLedger = ({ address, chainId }: PaidGameLedger): string | null => {
  if (!isL2Chain(chainId)) return `ledger is on chain ${chainId}; this build reads ${L2_CHAIN.name}`;
  if (L2_LEDGER === null) return `this build's L2 (${L2_CHAIN.name}) has no ledger deployed`;
  return BigInt(address) === BigInt(L2_LEDGER) ? null : `ledger ${address} is not this build's ${L2_LEDGER}`;
};

/** A directory game's entry, whose ledger must name that game on its own shard. */
export const directoryGameEntryOf = (game: { chainId: string; game_id: number; entry?: unknown }): GameEntry => {
  const id = `${game.chainId}:${game.game_id}`;
  const entry = gameEntryOf(game, id);
  if (entry.kind !== "paid") return entry;
  const { ledger } = entry;
  return BigInt(ledger.shard) === BigInt(game.chainId) && ledger.gameId === game.game_id
    ? entry
    : broken(id, `ledger names game ${ledger.shard}:${ledger.gameId}`);
};

/**
 * The ledger's reads on this build's L2, for an entry gameEntryOf has already held to the build's ledger. The wallet's
 * network fee balance is read on the build's own fee token: the entry names no token.
 */
export const ledgerOf = (ledger: PaidGameLedger) => {
  const read = ledgerReader(l2Provider(), ledger.address);
  return { ...read, feeBalance: (owner: string) => read.balanceOf(L2_CHAIN.gasToken, owner) };
};
