import { nativeRuleConstants } from "../../../contracts/l3/world-native/schema/client.gen";

export interface PlaytestSlot {
  entry: import("@realms-world/identity").GameEntry;
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

/** Preserve the caller's roster order; earlier groups receive the extra player. */
export function splitPlaytestRoster<T>(roster: readonly T[]): T[][] {
  const gameCount = Math.ceil(roster.length / nativeRuleConstants.MAX_BLITZ_ROSTER_PLAYERS);
  if (gameCount === 0) return [];
  const size = Math.floor(roster.length / gameCount);
  const largerGames = roster.length % gameCount;
  let offset = 0;
  return Array.from({ length: gameCount }, (_, index) => {
    const next = offset + size + Number(index < largerGames);
    const group = roster.slice(offset, next);
    offset = next;
    return group;
  });
}
