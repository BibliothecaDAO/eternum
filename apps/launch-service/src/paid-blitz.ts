import type { LedgerSlotKey } from "@realms-world/value-ledger";

export interface BlitzValuePort {
  refundSlot(key: LedgerSlotKey): Promise<number | null>;
}
