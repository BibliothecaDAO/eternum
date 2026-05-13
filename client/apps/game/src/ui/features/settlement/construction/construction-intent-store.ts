import { BuildingType, ClientComponents, ResourcesIds } from "@bibliothecadao/types";
import { divideByPrecision, getBalance, multiplyByPrecision } from "@bibliothecadao/eternum";

type Spot = { col: number; row: number };
type SpotInput = Spot | string;

type ConstructionIntentStatus = "submitting" | "submitted" | "confirmed_waiting_index" | "indexed_settling";

type ConstructionIntentCost = {
  resource: ResourcesIds;
  amount: number;
};

type ConstructionIntent = {
  intentId: string;
  realmEntityId: number;
  buildingType: BuildingType;
  spotKey: string;
  spot: Spot;
  useSimpleCost: boolean;
  costs: ConstructionIntentCost[];
  status: ConstructionIntentStatus;
  createdAt: number;
  updatedAt: number;
  transactionHash?: string;
  indexedAt?: number;
};

type ConstructionIntentInput = {
  realmEntityId: number;
  buildingType: BuildingType;
  spot: Spot;
  useSimpleCost: boolean;
  costs: ConstructionIntentCost[];
  enforceBuildingTypeUniqueness?: boolean;
  now?: number;
};

type ConstructionIntentFailureInput = {
  intentId?: string;
  transactionHash?: string;
  reason: string;
  now?: number;
};

type BuildReservationState = {
  occupied: Set<string>;
  vacated: Set<string>;
};

type ReconcileOptions = {
  now?: number;
  settleMs?: number;
  staleMs?: number;
};

type IndexedBuilding = {
  category?: BuildingType;
};

type InternalConstructionIntentState = {
  intents: Map<string, ConstructionIntent>;
  occupiedHolds: Set<string>;
  occupiedUpdatedAt: Map<string, number>;
  vacated: Set<string>;
  vacatedUpdatedAt: Map<string, number>;
};

const CONSTRUCTION_INTENT_SETTLE_MS = 3_000;
const CONSTRUCTION_INTENT_STALE_MS = 90_000;
const OCCUPIED_SPACE_REASON = "space is occupied";

const stateByRealm = new Map<number, InternalConstructionIntentState>();
const expiryTimeoutsByIntent = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let intentSequence = 0;
let snapshotVersion = 0;

export const toSpotKey = ({ col, row }: Spot): string => `${col},${row}`;

const fromSpotKey = (key: string): Spot => {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
};

const toKey = (spot: SpotInput): string => (typeof spot === "string" ? spot : toSpotKey(spot));

const isSettled = (updatedAt: number, now: number, settleMs: number) => now - updatedAt >= settleMs;
const isStale = (updatedAt: number, now: number, staleMs: number) => now - updatedAt >= staleMs;

const isOccupiedSpaceFailure = (reason: string) => reason.toLowerCase().includes(OCCUPIED_SPACE_REASON);

const notifyConstructionIntentListeners = () => {
  snapshotVersion += 1;
  listeners.forEach((listener) => listener());
};

export const subscribeConstructionIntentChanges = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getConstructionIntentSnapshot = () => snapshotVersion;

const getOrCreateState = (realmEntityId: number): InternalConstructionIntentState => {
  const existing = stateByRealm.get(realmEntityId);
  if (existing) return existing;

  const state: InternalConstructionIntentState = {
    intents: new Map<string, ConstructionIntent>(),
    occupiedHolds: new Set<string>(),
    occupiedUpdatedAt: new Map<string, number>(),
    vacated: new Set<string>(),
    vacatedUpdatedAt: new Map<string, number>(),
  };
  stateByRealm.set(realmEntityId, state);
  return state;
};

const findIntentByTransactionHash = (transactionHash: string) => {
  for (const state of stateByRealm.values()) {
    for (const intent of state.intents.values()) {
      if (intent.transactionHash === transactionHash) {
        return { state, intent };
      }
    }
  }
  return undefined;
};

const findIntentById = (intentId: string) => {
  for (const state of stateByRealm.values()) {
    const intent = state.intents.get(intentId);
    if (intent) {
      return { state, intent };
    }
  }
  return undefined;
};

const buildIntentId = (realmEntityId: number, buildingType: BuildingType, spotKey: string) => {
  intentSequence += 1;
  return `${realmEntityId}:${buildingType}:${spotKey}:${intentSequence}`;
};

const clearOccupiedHold = (state: InternalConstructionIntentState, key: string) => {
  state.occupiedHolds.delete(key);
  state.occupiedUpdatedAt.delete(key);
};

const addOccupiedHold = (state: InternalConstructionIntentState, key: string, now: number) => {
  state.occupiedHolds.add(key);
  state.occupiedUpdatedAt.set(key, now);
  clearVacated(state, key);
};

const clearVacated = (state: InternalConstructionIntentState, key: string) => {
  state.vacated.delete(key);
  state.vacatedUpdatedAt.delete(key);
};

const clearIntent = (state: InternalConstructionIntentState, intentId: string) => {
  clearIntentExpiry(intentId);
  state.intents.delete(intentId);
};

const isSettledIndexedIntent = (
  intent: ConstructionIntent,
  now: number,
  settleMs: number = CONSTRUCTION_INTENT_SETTLE_MS,
) => {
  if (intent.status === "indexed_settling") {
    return isSettled(intent.indexedAt ?? intent.updatedAt, now, settleMs);
  }

  return false;
};

const hasExpiredIntent = (
  intent: ConstructionIntent,
  now: number,
  settleMs: number = CONSTRUCTION_INTENT_SETTLE_MS,
  staleMs: number = CONSTRUCTION_INTENT_STALE_MS,
) => isSettledIndexedIntent(intent, now, settleMs) || isStale(intent.updatedAt, now, staleMs);

const getIntentExpiryAt = (
  intent: ConstructionIntent,
  settleMs: number = CONSTRUCTION_INTENT_SETTLE_MS,
  staleMs: number = CONSTRUCTION_INTENT_STALE_MS,
) => {
  if (intent.status === "indexed_settling") {
    return Math.min((intent.indexedAt ?? intent.updatedAt) + settleMs, intent.updatedAt + staleMs);
  }

  return intent.updatedAt + staleMs;
};

const clearIntentExpiry = (intentId: string) => {
  const timeout = expiryTimeoutsByIntent.get(intentId);
  if (!timeout) return;

  clearTimeout(timeout);
  expiryTimeoutsByIntent.delete(intentId);
};

const removeExpiredIntentAtTimeout = (intentId: string) => {
  expiryTimeoutsByIntent.delete(intentId);

  const match = findIntentById(intentId);
  if (!match) return;

  if (!hasExpiredIntent(match.intent, Date.now())) return;

  clearIntent(match.state, intentId);
  notifyConstructionIntentListeners();
};

const scheduleIntentExpiry = (intent: ConstructionIntent, scheduledAt: number) => {
  clearIntentExpiry(intent.intentId);

  const delay = Math.max(0, getIntentExpiryAt(intent) - scheduledAt);
  const timeout = setTimeout(() => removeExpiredIntentAtTimeout(intent.intentId), delay);
  expiryTimeoutsByIntent.set(intent.intentId, timeout);
};

const storeIntent = (state: InternalConstructionIntentState, intent: ConstructionIntent, now: number = Date.now()) => {
  state.intents.set(intent.intentId, intent);
  scheduleIntentExpiry(intent, now);
};

const pruneExpiredIntents = (
  state: InternalConstructionIntentState,
  now: number,
  settleMs: number = CONSTRUCTION_INTENT_SETTLE_MS,
  staleMs: number = CONSTRUCTION_INTENT_STALE_MS,
) => {
  Array.from(state.intents.values()).forEach((intent) => {
    if (hasExpiredIntent(intent, now, settleMs, staleMs)) {
      clearIntent(state, intent.intentId);
    }
  });
};

const getActiveIntents = (state: InternalConstructionIntentState) => Array.from(state.intents.values());

const hasActiveIntentForBuilding = (state: InternalConstructionIntentState, buildingType: BuildingType) =>
  getActiveIntents(state).some((intent) => intent.buildingType === buildingType);

const markIntentStatus = (
  intent: ConstructionIntent,
  status: ConstructionIntentStatus,
  now: number,
): ConstructionIntent => ({
  ...intent,
  status,
  updatedAt: now,
  indexedAt: status === "indexed_settling" ? now : intent.indexedAt,
});

const maybeClearStaleIntent = (
  state: InternalConstructionIntentState,
  intent: ConstructionIntent,
  now: number,
  staleMs: number,
) => {
  if (!isStale(intent.updatedAt, now, staleMs)) return false;
  clearIntent(state, intent.intentId);
  return true;
};

const reconcileOccupiedHolds = (
  state: InternalConstructionIntentState,
  isSpotOccupied: (spot: Spot) => boolean,
  now: number,
  staleMs: number,
) => {
  Array.from(state.occupiedHolds).forEach((key) => {
    const updatedAt = state.occupiedUpdatedAt.get(key) ?? now;
    const occupied = isSpotOccupied(fromSpotKey(key));
    if (occupied || isStale(updatedAt, now, staleMs)) {
      clearOccupiedHold(state, key);
    }
  });
};

const reconcileVacatedHolds = (
  state: InternalConstructionIntentState,
  isSpotOccupied: (spot: Spot) => boolean,
  now: number,
  settleMs: number,
  staleMs: number,
) => {
  Array.from(state.vacated).forEach((key) => {
    const updatedAt = state.vacatedUpdatedAt.get(key) ?? now;
    if (!isSettled(updatedAt, now, settleMs)) return;

    const occupied = isSpotOccupied(fromSpotKey(key));
    if (!occupied || isStale(updatedAt, now, staleMs)) {
      clearVacated(state, key);
    }
  });
};

const indexedBuildingMatchesIntent = (
  intent: ConstructionIntent,
  getIndexedBuilding: (spot: Spot) => IndexedBuilding | undefined,
) => getIndexedBuilding(intent.spot)?.category === intent.buildingType;

const reconcileIntent = (
  state: InternalConstructionIntentState,
  intent: ConstructionIntent,
  getIndexedBuilding: (spot: Spot) => IndexedBuilding | undefined,
  now: number,
  settleMs: number,
  staleMs: number,
) => {
  if (intent.status === "indexed_settling") {
    if (isSettled(intent.indexedAt ?? intent.updatedAt, now, settleMs)) {
      clearIntent(state, intent.intentId);
      return true;
    }
    return maybeClearStaleIntent(state, intent, now, staleMs);
  }

  if (indexedBuildingMatchesIntent(intent, getIndexedBuilding)) {
    storeIntent(state, markIntentStatus(intent, "indexed_settling", now), now);
    return true;
  }

  return maybeClearStaleIntent(state, intent, now, staleMs);
};

export const clearAllConstructionIntentState = () => {
  stateByRealm.clear();
  Array.from(expiryTimeoutsByIntent.keys()).forEach(clearIntentExpiry);
  intentSequence = 0;
  notifyConstructionIntentListeners();
};

export const beginConstructionIntent = ({
  realmEntityId,
  buildingType,
  spot,
  useSimpleCost,
  costs,
  enforceBuildingTypeUniqueness = true,
  now = Date.now(),
}: ConstructionIntentInput): ConstructionIntent | null => {
  const state = getOrCreateState(realmEntityId);
  pruneExpiredIntents(state, now);
  if (enforceBuildingTypeUniqueness && hasActiveIntentForBuilding(state, buildingType)) {
    return null;
  }

  const spotKey = toSpotKey(spot);
  if (state.occupiedHolds.has(spotKey) || getActiveIntents(state).some((intent) => intent.spotKey === spotKey)) {
    return null;
  }

  const intent: ConstructionIntent = {
    intentId: buildIntentId(realmEntityId, buildingType, spotKey),
    realmEntityId,
    buildingType,
    spotKey,
    spot,
    useSimpleCost,
    costs,
    status: "submitting",
    createdAt: now,
    updatedAt: now,
  };

  storeIntent(state, intent, now);
  clearOccupiedHold(state, spotKey);
  clearVacated(state, spotKey);
  notifyConstructionIntentListeners();
  return intent;
};

export const attachConstructionTx = (
  intentId: string,
  transactionHash: string | undefined,
  now: number = Date.now(),
) => {
  const match = findIntentById(intentId);
  if (!match) return false;

  storeIntent(
    match.state,
    {
      ...match.intent,
      transactionHash,
      status: "submitted",
      updatedAt: now,
    },
    now,
  );
  notifyConstructionIntentListeners();
  return true;
};

export const markConstructionIntentConfirmed = (transactionHash: string, now: number = Date.now()) => {
  const match = findIntentByTransactionHash(transactionHash);
  if (!match) return false;
  if (match.intent.status === "indexed_settling") return true;

  storeIntent(match.state, markIntentStatus(match.intent, "confirmed_waiting_index", now), now);
  notifyConstructionIntentListeners();
  return true;
};

export const failConstructionIntent = ({
  intentId,
  transactionHash,
  reason,
  now = Date.now(),
}: ConstructionIntentFailureInput) => {
  const match = intentId
    ? findIntentById(intentId)
    : transactionHash
      ? findIntentByTransactionHash(transactionHash)
      : undefined;
  if (!match) return false;

  clearIntent(match.state, match.intent.intentId);
  if (isOccupiedSpaceFailure(reason)) {
    addOccupiedHold(match.state, match.intent.spotKey, now);
  }
  notifyConstructionIntentListeners();
  return true;
};

export const reconcileConstructionIntents = (
  realmEntityId: number,
  isSpotOccupied: (spot: Spot) => boolean,
  getIndexedBuilding: (spot: Spot) => IndexedBuilding | undefined,
  options: ReconcileOptions = {},
) => {
  const state = getOrCreateState(realmEntityId);
  const now = options.now ?? Date.now();
  const settleMs = options.settleMs ?? CONSTRUCTION_INTENT_SETTLE_MS;
  const staleMs = options.staleMs ?? CONSTRUCTION_INTENT_STALE_MS;
  let changed = false;

  getActiveIntents(state).forEach((intent) => {
    changed = reconcileIntent(state, intent, getIndexedBuilding, now, settleMs, staleMs) || changed;
  });

  const occupiedBefore = state.occupiedHolds.size;
  reconcileOccupiedHolds(state, isSpotOccupied, now, staleMs);
  changed = changed || occupiedBefore !== state.occupiedHolds.size;

  const vacatedBefore = state.vacated.size;
  reconcileVacatedHolds(state, isSpotOccupied, now, settleMs, staleMs);
  changed = changed || vacatedBefore !== state.vacated.size;

  if (changed) {
    notifyConstructionIntentListeners();
  }
};

export const getActiveConstructionIntents = (realmEntityId: number) =>
  getActiveIntents(getOrCreateState(realmEntityId));

export const getPendingConstructionCost = (realmEntityId: number, resourceId: ResourcesIds) =>
  getActiveConstructionIntents(realmEntityId).reduce(
    (total, intent) =>
      total +
      intent.costs.reduce((costTotal, cost) => (cost.resource === resourceId ? costTotal + cost.amount : costTotal), 0),
    0,
  );

export const hasActiveConstructionIntent = (realmEntityId: number, buildingType: BuildingType) =>
  hasActiveIntentForBuilding(getOrCreateState(realmEntityId), buildingType);

export const getEffectiveConstructionBalance = (
  realmEntityId: number,
  resourceId: ResourcesIds,
  currentDefaultTick: number,
  components: ClientComponents,
) => {
  const canonicalBalance = getBalance(realmEntityId, resourceId, currentDefaultTick, components);
  return Math.max(
    0,
    divideByPrecision(canonicalBalance.balance, false) - getPendingConstructionCost(realmEntityId, resourceId),
  );
};

export const getEffectiveConstructionBalanceRaw = (
  realmEntityId: number,
  resourceId: ResourcesIds,
  currentDefaultTick: number,
  components: ClientComponents,
) => {
  const canonicalBalance = getBalance(realmEntityId, resourceId, currentDefaultTick, components);
  return Math.max(
    0,
    canonicalBalance.balance - multiplyByPrecision(getPendingConstructionCost(realmEntityId, resourceId)),
  );
};

export const getBuildReservationState = (realmEntityId: number): BuildReservationState => {
  const state = getOrCreateState(realmEntityId);
  const occupied = new Set<string>(state.occupiedHolds);
  getActiveIntents(state).forEach((intent) => occupied.add(intent.spotKey));
  return {
    occupied,
    vacated: new Set(state.vacated),
  };
};

export const reserveOccupiedBuildSpot = (realmEntityId: number, spot: SpotInput, now: number = Date.now()) => {
  const state = getOrCreateState(realmEntityId);
  addOccupiedHold(state, toKey(spot), now);
  notifyConstructionIntentListeners();
};

export const reserveVacatedBuildSpot = (realmEntityId: number, spot: SpotInput, now: number = Date.now()) => {
  const state = getOrCreateState(realmEntityId);
  const key = toKey(spot);

  state.vacated.add(key);
  state.vacatedUpdatedAt.set(key, now);
  clearOccupiedHold(state, key);
  notifyConstructionIntentListeners();
};

export const releaseVacatedBuildSpot = (realmEntityId: number, spot: SpotInput) => {
  const state = getOrCreateState(realmEntityId);
  clearVacated(state, toKey(spot));
  notifyConstructionIntentListeners();
};
