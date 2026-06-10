type BuildSlotTransitionStatus = "build_pending" | "destroy_pending" | "occupied_unconfirmed";

export type BuildSlotTransition = {
  status: BuildSlotTransitionStatus;
  updatedAt: number;
};

export type BuildSlotTransitionMap = Map<string, BuildSlotTransition>;

type ResolveOccupiedStateOptions = {
  now?: number;
  staleMs?: number;
};

export const BUILD_SLOT_TRANSITION_STALE_MS = 90_000;

const setTransition = (
  transitions: BuildSlotTransitionMap,
  key: string,
  status: BuildSlotTransitionStatus,
  now: number,
) => {
  transitions.set(key, { status, updatedAt: now });
};

const clearTransition = (transitions: BuildSlotTransitionMap, key: string) => {
  transitions.delete(key);
};

const isStale = (updatedAt: number, now: number, staleMs: number) => now - updatedAt >= staleMs;

export const markBuildPending = (transitions: BuildSlotTransitionMap, key: string, now: number = Date.now()) => {
  setTransition(transitions, key, "build_pending", now);
};

export const markDestroyPending = (transitions: BuildSlotTransitionMap, key: string, now: number = Date.now()) => {
  setTransition(transitions, key, "destroy_pending", now);
};

export const markOccupiedUnconfirmed = (transitions: BuildSlotTransitionMap, key: string, now: number = Date.now()) => {
  setTransition(transitions, key, "occupied_unconfirmed", now);
};

export const clearBuildSlotTransition = (transitions: BuildSlotTransitionMap, key: string) => {
  clearTransition(transitions, key);
};

export const resolveOccupiedState = (
  transitions: BuildSlotTransitionMap,
  key: string,
  confirmedOccupied: boolean,
  options: ResolveOccupiedStateOptions = {},
) => {
  const transition = transitions.get(key);
  if (!transition) return confirmedOccupied;

  const now = options.now ?? Date.now();
  const staleMs = options.staleMs ?? BUILD_SLOT_TRANSITION_STALE_MS;

  switch (transition.status) {
    case "build_pending":
      if (confirmedOccupied) {
        clearTransition(transitions, key);
        return true;
      }
      if (isStale(transition.updatedAt, now, staleMs)) {
        clearTransition(transitions, key);
        return confirmedOccupied;
      }
      return true;

    case "destroy_pending":
      if (!confirmedOccupied) {
        clearTransition(transitions, key);
        return false;
      }
      if (isStale(transition.updatedAt, now, staleMs)) {
        clearTransition(transitions, key);
        return confirmedOccupied;
      }
      return true;

    case "occupied_unconfirmed":
      if (confirmedOccupied) {
        clearTransition(transitions, key);
        return true;
      }
      if (isStale(transition.updatedAt, now, staleMs)) {
        clearTransition(transitions, key);
        return confirmedOccupied;
      }
      return true;
  }

  return confirmedOccupied;
};
