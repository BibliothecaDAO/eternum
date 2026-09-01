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
 * The pre-confirmed rows subscribers currently hold beyond the confirmed fold. Subscribers keep a row's value until a
 * later diff changes it (they no longer revert on overlay_reset), so the wire carries only the rows whose value
 * differs from what they hold, while the ledger tracks the whole overlay to know which rows a rebuild must revert.
 */
export class OverlayLedger {
  private held = new Map<string, LedgerEntry>();
  /** Rows held before the last reset; the rebuild compares against them until settleReverts clears them. */
  private heldBeforeReset = new Map<string, LedgerEntry>();

  /** Keeps the changes that alter what subscribers hold and records the whole transaction into the overlay. */
  public delta(changes: FoldChange[]): FoldChange[] {
    const delta: FoldChange[] = [];
    for (const change of changes) {
      const entry = ledgerEntry(change);
      const identity = rowIdentity(entry.model, entry.key);
      const current = this.held.get(identity) ?? this.heldBeforeReset.get(identity);
      if (!current || !isSameHeldRow(current.row, entry.row)) delta.push(change);
      this.held.set(identity, entry);
    }
    return delta;
  }

  /** A confirmed diff for a row supersedes the overlay value subscribers held for it. */
  public forgetConfirmed(changes: FoldChange[]): void {
    for (const change of changes) {
      const entry = ledgerEntry(change);
      this.held.delete(rowIdentity(entry.model, entry.key));
    }
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
  public settleReverts(confirmedRow: (model: string, key: string) => FoldSet | undefined): FoldChange[] {
    const reverts: FoldChange[] = [];
    for (const [identity, { gameId, key, model }] of this.heldBeforeReset) {
      if (this.held.has(identity)) continue;
      const confirmed = confirmedRow(model, key);
      reverts.push(confirmed ? { gameId, set: confirmed } : { del: { key, model }, gameId });
    }
    this.heldBeforeReset = new Map();
    return reverts;
  }
}
