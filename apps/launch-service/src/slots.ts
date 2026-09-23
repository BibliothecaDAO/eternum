/** A player in a slot: their Realms account, and the gameplay account it has on the shard the slot launches on. */
export interface SlotPlayer {
  realmsId: string;
  account: string;
}

export interface SlotRegistration extends SlotPlayer {
  position: number;
  gameNumber: number | null;
}

export interface PlaytestSlot {
  name: string;
  closesAt: string;
  frozenAt: string | null;
  closed: boolean;
  registrations: SlotRegistration[];
}

export interface SlotStore {
  /** Creates the slot once; the timetable names a slot by its closing time, so a repeat is the same slot. */
  create(name: string, closesAt: string): Promise<void>;
  list(): Promise<PlaytestSlot[]>;
  register(name: string, player: SlotPlayer): Promise<PlaytestSlot>;
  freeze(name: string): Promise<PlaytestSlot>;
  freezeNextDue(): Promise<void>;
}

export class SlotConflict extends Error {}
export class SlotNotFound extends Error {}

/** Preserve the caller's roster order; earlier groups receive the extra player. */
export function splitPlaytestRoster<T>(roster: readonly T[]): T[][] {
  const gameCount = Math.ceil(roster.length / 24);
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
