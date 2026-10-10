import {
  resolveBlitzRoster,
  type LedgerSlotKey,
  type RegistrationQuery,
  type RegistrationPage,
  type RegistrationIdentity,
} from "@realms-world/value-ledger";
import { RegistrationOpen } from "./blitz-roster";
import { splitPlaytestRoster } from "./slots";

export interface BlitzValuePort {
  registrations(query: RegistrationQuery): Promise<RegistrationPage>;
  openSlot(key: LedgerSlotKey, window: { start: number; end: number }): Promise<void>;
  markRefundable(key: LedgerSlotKey, wallets: readonly string[]): Promise<void>;
  refundSlot(key: LedgerSlotKey): Promise<number | null>;
}
export class SlotCancelled extends Error {}

/** Retries derive the same groups from immutable registration order and historical links, without a roster copy. */
export const closedSlotGroups = async (key: LedgerSlotKey, value: BlitzValuePort, identity: RegistrationIdentity) => {
  let page = await value.registrations(key);
  if (page.secondsUntilClose > 0) throw new RegistrationOpen({ secondsUntilClose: page.secondsUntilClose });
  if (page.slot.cancelled) throw new SlotCancelled("Blitz slot cancelled");
  const registrations = [...page.registrations];
  const { blockNumber, blockHash, slot } = page;
  while (page.next !== null) {
    const from = page.next;
    page = await value.registrations({ ...key, from, blockNumber, blockHash });
    if (
      page.blockNumber !== blockNumber ||
      BigInt(page.blockHash) !== BigInt(blockHash) ||
      (page.next !== null && page.next <= from)
    )
      throw new Error("registration_page_changed");
    registrations.push(...page.registrations);
  }
  if (registrations.length !== slot.registeredCount) throw new Error("registration_history_incomplete");
  const { players, refunds } = await resolveBlitzRoster(registrations, identity);
  return { groups: splitPlaytestRoster(players), refunds, slot };
};
