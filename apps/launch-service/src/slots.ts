export { splitPlaytestRoster } from "@realms-world/value-ledger";

export interface PlaytestSlot {
  slotId: number;
  name: string;
  closesAt: string;
  frozenAt: string | null;
  closed: boolean;
}

export interface SlotStore {
  /** Creates the slot once; a repeat with the same closing time is the same slot, another closing time a conflict. */
  create(name: string, closesAt: string): Promise<void>;
  get(name: string): Promise<PlaytestSlot>;
  list(): Promise<PlaytestSlot[]>;
  freeze(name: string): Promise<PlaytestSlot>;
  freezeNextDue(): Promise<void>;
}

export class SlotConflict extends Error {}
export class SlotNotFound extends Error {}
