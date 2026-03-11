type Spot = { col: number; row: number };
type SpotInput = Spot | string;

type BuildReservationState = {
  occupied: Set<string>;
  vacated: Set<string>;
};

type InternalBuildReservationState = BuildReservationState & {
  occupiedUpdatedAt: Map<string, number>;
  vacatedUpdatedAt: Map<string, number>;
};

type ReconcileOptions = {
  now?: number;
  settleMs?: number;
  staleMs?: number;
};

const RESERVATION_RECONCILE_SETTLE_MS = 3_000;
const RESERVATION_STALE_MS = 90_000;

const stateByRealm = new Map<number, InternalBuildReservationState>();

export const toSpotKey = ({ col, row }: Spot): string => `${col},${row}`;

const fromSpotKey = (key: string): Spot => {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
};

const toKey = (spot: SpotInput): string => (typeof spot === "string" ? spot : toSpotKey(spot));

const getOrCreateState = (realmEntityId: number): InternalBuildReservationState => {
  const existing = stateByRealm.get(realmEntityId);
  if (existing) return existing;

  const state: InternalBuildReservationState = {
    occupied: new Set<string>(),
    vacated: new Set<string>(),
    occupiedUpdatedAt: new Map<string, number>(),
    vacatedUpdatedAt: new Map<string, number>(),
  };
  stateByRealm.set(realmEntityId, state);
  return state;
};

const clearOccupied = (state: InternalBuildReservationState, key: string) => {
  state.occupied.delete(key);
  state.occupiedUpdatedAt.delete(key);
};

const clearVacated = (state: InternalBuildReservationState, key: string) => {
  state.vacated.delete(key);
  state.vacatedUpdatedAt.delete(key);
};

const isSettled = (updatedAt: number, now: number, settleMs: number) => now - updatedAt >= settleMs;
const isStale = (updatedAt: number, now: number, staleMs: number) => now - updatedAt >= staleMs;

export const getBuildReservationState = (realmEntityId: number): BuildReservationState => {
  return getOrCreateState(realmEntityId);
};

export const reserveOccupiedBuildSpot = (realmEntityId: number, spot: SpotInput, now: number = Date.now()) => {
  const state = getOrCreateState(realmEntityId);
  const key = toKey(spot);

  state.occupied.add(key);
  state.occupiedUpdatedAt.set(key, now);
  clearVacated(state, key);
};

export const releaseOccupiedBuildSpot = (realmEntityId: number, spot: SpotInput) => {
  const state = getOrCreateState(realmEntityId);
  clearOccupied(state, toKey(spot));
};

export const reserveVacatedBuildSpot = (realmEntityId: number, spot: SpotInput, now: number = Date.now()) => {
  const state = getOrCreateState(realmEntityId);
  const key = toKey(spot);

  state.vacated.add(key);
  state.vacatedUpdatedAt.set(key, now);
  clearOccupied(state, key);
};

export const clearAllBuildReservationState = () => {
  stateByRealm.clear();
};

export const reconcileBuildReservationState = (
  realmEntityId: number,
  isSpotOccupied: (spot: Spot) => boolean,
  options: ReconcileOptions = {},
) => {
  const state = getOrCreateState(realmEntityId);
  const now = options.now ?? Date.now();
  const settleMs = options.settleMs ?? RESERVATION_RECONCILE_SETTLE_MS;
  const staleMs = options.staleMs ?? RESERVATION_STALE_MS;

  Array.from(state.occupied).forEach((key) => {
    const updatedAt = state.occupiedUpdatedAt.get(key) ?? now;
    if (!state.occupiedUpdatedAt.has(key)) {
      state.occupiedUpdatedAt.set(key, now);
      return;
    }
    if (!isSettled(updatedAt, now, settleMs)) return;

    const occupied = isSpotOccupied(fromSpotKey(key));
    if (occupied || isStale(updatedAt, now, staleMs)) {
      clearOccupied(state, key);
    }
  });

  Array.from(state.vacated).forEach((key) => {
    const updatedAt = state.vacatedUpdatedAt.get(key) ?? now;
    if (!state.vacatedUpdatedAt.has(key)) {
      state.vacatedUpdatedAt.set(key, now);
      return;
    }
    if (!isSettled(updatedAt, now, settleMs)) return;

    const occupied = isSpotOccupied(fromSpotKey(key));
    if (!occupied || isStale(updatedAt, now, staleMs)) {
      clearVacated(state, key);
    }
  });
};
