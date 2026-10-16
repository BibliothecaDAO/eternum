import {
  resolveBlitzRoster,
  type LedgerSlotKey,
  type LedgerSlot,
  type RegistrationQuery,
  type RegistrationPage,
  type RegistrationIdentity,
} from "@realms-world/value-ledger";
import { RegistrationOpen } from "./blitz-roster";
import { splitPlaytestRoster } from "./slots";

export interface BlitzValuePort {
  slot(key: LedgerSlotKey): Promise<LedgerSlot>;
  registrations(query: RegistrationQuery): Promise<RegistrationPage>;
  openSlot(key: LedgerSlotKey, window: { start: number; end: number }): Promise<void>;
  markRefundable(key: LedgerSlotKey, wallets: readonly string[]): Promise<void>;
  refundSlot(key: LedgerSlotKey): Promise<number | null>;
}
export class SlotCancelled extends Error {}

/**
 * The ledger closes on its last block's clock, which can trail the Worker's by a block or two. Inside this many seconds
 * the close is waited out in place: deferring it a cron tick would spend the whole minute before the start.
 */
const LEDGER_CLOSE_WAIT_SECONDS = 10;

const readClosedPage = async (key: LedgerSlotKey, value: BlitzValuePort) => {
  const deadline = Date.now() + LEDGER_CLOSE_WAIT_SECONDS * 1000;
  for (;;) {
    const page = await value.registrations(key);
    if (page.secondsUntilClose === 0) return page;
    if (Date.now() + page.secondsUntilClose * 1000 > deadline)
      throw new RegistrationOpen({ secondsUntilClose: page.secondsUntilClose });
    await new Promise((resolve) => setTimeout(resolve, page.secondsUntilClose * 1000));
  }
};

type ClosedSlot = Awaited<ReturnType<typeof closedSlotGroups>>;
export type SlotResolver = (key: LedgerSlotKey) => Promise<ClosedSlot>;

/**
 * Resolves each closed slot at most once for as long as the resolver lives. The registrar makes one per alarm, so the
 * alarm that freezes a slot launches it from that same read of the ledger; a failed read is forgotten and read again.
 */
export const slotResolver = (value: BlitzValuePort, identity: RegistrationIdentity): SlotResolver => {
  const resolved = new Map<string, Promise<ClosedSlot>>();
  return (key) => {
    const id = `${BigInt(key.chainId)}:${key.slotId}`;
    if (!resolved.has(id))
      resolved.set(
        id,
        closedSlotGroups(key, value, identity).catch((error: unknown) => {
          resolved.delete(id);
          throw error;
        }),
      );
    return resolved.get(id)!;
  };
};

/** Retries derive the same groups from immutable registration order and historical links, without a roster copy. */
export const closedSlotGroups = async (key: LedgerSlotKey, value: BlitzValuePort, identity: RegistrationIdentity) => {
  let page = await readClosedPage(key, value);
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
