import { BLITZ_SLOT_PREPARATION_SECONDS } from "@realms-world/value-ledger";
import { loadNativePresetConfiguration } from "../../../config/deployer/clean/registrar/native-preset";
import { nativePresetIdFor } from "../../../config/source/native";

export { splitPlaytestRoster } from "@realms-world/value-ledger";

/** The paid slot covers preparation and the preset's complete game duration, starting at registration close. */
export const blitzSlotWindow = (closesAt: string): { start: number; end: number } => {
  const start = Date.parse(closesAt) / 1000;
  const duration = loadNativePresetConfiguration("madara.blitz", nativePresetIdFor("blitz")).season.durationSeconds;
  return { start, end: start + BLITZ_SLOT_PREPARATION_SECONDS + duration };
};

export interface PlaytestSlot {
  chainId: string;
  slotId: number;
  name: string;
  closesAt: string;
  frozenAt: string | null;
  closed: boolean;
}

export interface SlotFreezeFailure {
  chainId: string;
  slotId: number;
  name: string;
  code: string;
  checkedAt: number;
  secondsUntilClose?: number;
}

export interface SlotStore {
  /** Creates the slot once; a repeat with the same closing time is the same slot, another closing time a conflict. */
  create(name: string, closesAt: string): Promise<void>;
  get(name: string): Promise<PlaytestSlot>;
  list(): Promise<PlaytestSlot[]>;
  refund(name: string): Promise<number | null>;
  freeze(name: string): Promise<PlaytestSlot>;
  freezeDueSlots(): Promise<void>;
  freezeFailures(): Promise<SlotFreezeFailure[]>;
}

export class SlotConflict extends Error {}
export class SlotNotFound extends Error {}
