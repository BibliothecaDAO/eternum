import { l2ChainId, l2Provider } from "@/runtime/l2-rpc";

import { type GameKey, ledgerReader } from "./ledger";

/** A paid game's place on the ledger, as the services name it with the slot or the directory game. */
export interface LedgerRef {
  /** The ledger contract the payout wallet pays and is paid by. */
  address: string;
  /** The L2 the ledger lives on; one build reads one L2, and refuses a ledger on another. */
  chainId: string;
  /** The token the network fee is paid in, on the ledger's network. */
  feeToken: string;
  key: GameKey;
}

/**
 * How a slot or a directory game is entered, from the services' `entry` field: free, or paid on the ledger it names.
 * A paid game whose ledger reference is missing or malformed is broken, a fault shown as such and never the free join.
 * A payload with no `entry` at all is read as free for now (see the marked line below).
 */
type GameEntry = { kind: "free" } | { kind: "paid"; ledger: LedgerRef } | { kind: "broken" };

const FREE: GameEntry = { kind: "free" };
const BROKEN: GameEntry = { kind: "broken" };

export const gameEntryOf = (payload: object): GameEntry => {
  const entry = (payload as { entry?: unknown }).entry;
  // INTERIM, until the services branch is merged in: the services make `entry` required on every slot and directory
  // game, and from that merge a missing one is broken, like a paid entry without its ledger.
  if (entry === undefined) return FREE;
  if (!isRecord(entry)) return BROKEN;
  if (entry.kind === "free") return FREE;
  if (entry.kind !== "paid") return BROKEN;
  const ledger = ledgerRefOf(entry.ledger);
  return ledger ? { kind: "paid", ledger } : BROKEN;
};

/** A directory game's entry, whose ledger key must name that game on its own shard. */
export const directoryGameEntryOf = (game: { chainId: string; game_id: number }): GameEntry => {
  const entry = gameEntryOf(game);
  if (entry.kind !== "paid") return entry;
  const { key } = entry.ledger;
  return BigInt(key.shard) === BigInt(game.chainId) && key.gameId === game.game_id ? entry : BROKEN;
};

/** The ledger's reads on this build's L2; a ledger the entry places on another chain is refused, loudly. */
export const ledgerOf = async (ledger: LedgerRef) => {
  const chain = await l2ChainId();
  if (BigInt(ledger.chainId) !== BigInt(chain))
    throw new Error(`Ledger ${ledger.address} is on chain ${ledger.chainId}; this build reads chain ${chain}`);
  return ledgerReader(l2Provider(), ledger.address);
};

const ledgerRefOf = (value: unknown): LedgerRef | null => {
  if (!isRecord(value)) return null;
  const { address, chainId, feeToken, shard, gameId } = value;
  return typeof address === "string" &&
    typeof chainId === "string" &&
    typeof feeToken === "string" &&
    typeof shard === "string" &&
    Number.isSafeInteger(gameId)
    ? { address, chainId, feeToken, key: { shard, gameId: gameId as number } }
    : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
