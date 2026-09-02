import type { FoldChange, FoldSet } from "./types";

/** What subscribers hold for an overlay row: the last published set, or null once a deletion was published. */
type HeldRow = FoldSet | null;

interface LedgerEntry {
  gameId: string | undefined;
  key: string;
  model: string;
  row: HeldRow;
}

const rowIdentity = (model: string, key: string): string => `${model}:${key}`;

const ledgerEntry = (change: FoldChange): LedgerEntry => {
  if (change.set) return { gameId: change.gameId, key: change.set.key, model: change.set.model, row: change.set };
  if (change.del) return { gameId: change.gameId, key: change.del.key, model: change.del.model, row: null };
  throw new Error("Fold change carries neither a set nor a delete");
};

/** Deep equality over the JSON-safe records the fold emits (strings, numbers, booleans, nested records, arrays). */
const isSameRecord = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftEntries = Object.entries(left);
  if (leftEntries.length !== Object.keys(right).length) return false;
  return leftEntries.every(
    ([field, value]) => Object.hasOwn(right, field) && isSameRecord(value, (right as Record<string, unknown>)[field]),
  );
};

const isSameHeldRow = (left: HeldRow, right: HeldRow): boolean =>
  left === null || right === null ? left === right : isSameRecord(left.value, right.value);

/**
 * One change per (model, key), the last value, in first-appearance order. The fold emits a full-row change per
 * member event, so a transaction that writes ten members of one row would otherwise ship the row ten times.
 */
export const collapseChanges = (changes: readonly FoldChange[]): FoldChange[] => {
  const byIdentity = new Map<string, FoldChange>();
  for (const change of changes) {
    const entry = ledgerEntry(change);
    byIdentity.set(rowIdentity(entry.model, entry.key), change);
  }
  return [...byIdentity.values()];
};

type ConfirmedRowLookup = (model: string, key: string) => FoldSet | undefined;

/**
 * The pre-confirmed rows subscribers currently hold beyond the confirmed fold. Subscribers keep a row's value until a
 * later diff changes it (they no longer revert on overlay_reset), so the wire carries only the rows whose value
 * differs from what they hold, while the ledger tracks the whole overlay to know which rows a rebuild must revert.
 * A row absent from the ledger is held at its confirmed value: a confirmed diff that repeats a held overlay value
 * therefore stays off the wire too, and the row simply leaves the ledger.
 */
export class OverlayLedger {
  private held = new Map<string, LedgerEntry>();
  /** Rows held before the last reset; the rebuild compares against them until settleReverts clears them. */
  private heldBeforeReset = new Map<string, LedgerEntry>();

  /** Keeps the changes that alter what subscribers hold and records the transaction's overlay rows. */
  public delta(changes: FoldChange[], confirmedRow: ConfirmedRowLookup): FoldChange[] {
    const delta: FoldChange[] = [];
    for (const change of changes) {
      const entry = ledgerEntry(change);
      const identity = rowIdentity(entry.model, entry.key);
      const held = this.held.get(identity) ?? this.heldBeforeReset.get(identity);
      // A pending write that repeats the confirmed row changes nothing for anyone and stays out of the ledger.
      if (!held && isSameHeldRow(confirmedRow(entry.model, entry.key) ?? null, entry.row)) continue;
      if (!held || !isSameHeldRow(held.row, entry.row)) delta.push(change);
      this.held.set(identity, entry);
    }
    return delta;
  }

  /** A confirmed row leaves the overlay; it goes on the wire only when subscribers hold a different value for it. */
  public settleConfirmed(changes: FoldChange[]): FoldChange[] {
    const published: FoldChange[] = [];
    for (const change of changes) {
      const entry = ledgerEntry(change);
      const identity = rowIdentity(entry.model, entry.key);
      const held = this.held.get(identity);
      if (!held || !isSameHeldRow(held.row, entry.row)) published.push(change);
      this.held.delete(identity);
    }
    return published;
  }

  /** Starts a fresh overlay; the rows held until now become the baseline the rebuild is compared against. */
  public reset(): void {
    this.heldBeforeReset = this.held;
    this.held = new Map();
  }

  /**
   * The rows subscribers still hold from the previous overlay that the rebuilt overlay did not touch, as the changes
   * that restore confirmed state. Reverts are not recorded: they leave the row equal to the confirmed fold.
   */
  public settleReverts(confirmedRow: ConfirmedRowLookup): FoldChange[] {
    const reverts: FoldChange[] = [];
    for (const [identity, { gameId, key, model, row }] of this.heldBeforeReset) {
      if (this.held.has(identity)) continue;
      const confirmed = confirmedRow(model, key);
      if (isSameHeldRow(confirmed ?? null, row)) continue;
      reverts.push(confirmed ? { gameId, set: confirmed } : { del: { key, model }, gameId });
    }
    this.heldBeforeReset = new Map();
    return reverts;
  }
}
