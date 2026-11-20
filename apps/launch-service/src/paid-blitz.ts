import type { LedgerSlotKey, LedgerSlot } from "@realms-world/value-ledger";

export interface BlitzValuePort {
  slot(key: LedgerSlotKey): Promise<LedgerSlot>;
  openSlot(key: LedgerSlotKey, window: { start: number; end: number }): Promise<void>;
  refundSlot(key: LedgerSlotKey): Promise<number | null>;
}
