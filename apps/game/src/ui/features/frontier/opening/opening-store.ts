import { identityClient } from "@/hooks/context/identity-session";
import { OPENING_MOMENT_KEY_PATTERN } from "@realms-world/identity";
import { create } from "zustand";
import { OPENING_MOMENTS, type OpeningMoment } from "./opening";
import { TUTORIAL_SKIPPED } from "./opening-state";

type Sets = { reached: ReadonlySet<string>; seen: ReadonlySet<string> };

interface OpeningStore extends Sets {
  owner: string | null;
  loaded: boolean;
  status: "signed-out" | "loading" | "ready" | "error";
  unsent: Sets;
  replayed: ReadonlySet<string>;
  showing: OpeningMoment | null;
  confirmed: OpeningMoment | null;
  onDevice: boolean;
}

const none = (): Sets => ({ reached: new Set(), seen: new Set() });

export const useOpeningStore = create<OpeningStore>(() => ({
  owner: null,
  loaded: false,
  status: "signed-out",
  ...none(),
  unsent: none(),
  replayed: new Set(),
  showing: null,
  confirmed: null,
  onDevice: false,
}));

export const openingCacheKey = (owner: string) => `eternum:opening:${owner}`;

const storageOwnerOf = (owner: string | null) => owner || "guest";

const replayCacheKey = (owner: string | null) => `eternum:tutorial-replay:${storageOwnerOf(owner)}`;

const TUTORIAL_KEYS = new Set<string>([...OPENING_MOMENTS, TUTORIAL_SKIPPED]);
const LEGACY_TUTORIAL_SKIPPED = "tutorial:skipped";

const normalizeKey = (key: string): string | null => {
  const mapped = key === LEGACY_TUTORIAL_SKIPPED ? TUTORIAL_SKIPPED : key;
  return OPENING_MOMENT_KEY_PATTERN.test(mapped) ? mapped : null;
};

const sanitizeKeys = (items: Iterable<string>): ReadonlySet<string> => {
  const cleaned = new Set<string>();
  for (const item of items) {
    if (typeof item !== "string") continue;
    const key = normalizeKey(item);
    if (key !== null) cleaned.add(key);
  }
  return cleaned;
};

const keptReplay = (owner: string | null): ReadonlySet<string> => {
  try {
    const raw = JSON.parse(localStorage.getItem(replayCacheKey(owner)) ?? "[]");
    return Array.isArray(raw) ? sanitizeKeys(raw) : new Set();
  } catch {
    return new Set();
  }
};

const keepReplay = (owner: string | null, replayed: ReadonlySet<string>): void => {
  try {
    if (replayed.size === 0) localStorage.removeItem(replayCacheKey(owner));
    else localStorage.setItem(replayCacheKey(owner), JSON.stringify([...replayed]));
  } catch {}
};

const kept = (owner: string | null): { sets: Sets; unsent: Sets; onDevice: boolean } => {
  try {
    const stored = JSON.parse(localStorage.getItem(openingCacheKey(storageOwnerOf(owner))) ?? "null") as {
      reached: string[];
      seen: string[];
      unsent: { reached: string[]; seen: string[] };
      complete?: boolean;
    } | null;
    if (!stored) return { sets: none(), unsent: none(), onDevice: false };
    return {
      onDevice: stored.complete === true,
      sets: { reached: sanitizeKeys(stored.reached ?? []), seen: sanitizeKeys(stored.seen ?? []) },
      unsent: { reached: sanitizeKeys(stored.unsent?.reached ?? []), seen: sanitizeKeys(stored.unsent?.seen ?? []) },
    };
  } catch {
    return { sets: none(), unsent: none(), onDevice: false };
  }
};

const keep = (): void => {
  const { owner, reached, seen, unsent, status, onDevice } = useOpeningStore.getState();
  try {
    localStorage.setItem(
      openingCacheKey(storageOwnerOf(owner)),
      JSON.stringify({
        reached: [...reached],
        seen: [...seen],
        unsent: { reached: [...unsent.reached], seen: [...unsent.seen] },
        complete: status === "ready" || onDevice,
      }),
    );
  } catch {}
};

const union = (left: ReadonlySet<string>, right: Iterable<string>): ReadonlySet<string> => new Set([...left, ...right]);
const without = (left: ReadonlySet<string>, right: Iterable<string>): ReadonlySet<string> => {
  const removed = new Set(right);
  return new Set([...left].filter((moment) => !removed.has(moment)));
};

export const loadOpening = (rawOwner: string | null): Promise<void> => {
  const owner = rawOwner || null;
  const current = useOpeningStore.getState();
  if (current.owner === owner && current.loaded) return Promise.resolve();
  const device = kept(owner);
  if (!owner) {
    useOpeningStore.setState({
      owner,
      loaded: true,
      status: "signed-out",
      ...device.sets,
      unsent: none(),
      replayed: keptReplay(null),
      showing: null,
      confirmed: null,
      onDevice: false,
    });
    return Promise.resolve();
  }
  useOpeningStore.setState({
    owner,
    loaded: true,
    status: "loading",
    ...device.sets,
    unsent: device.unsent,
    replayed: keptReplay(owner),
    showing: null,
    confirmed: null,
    onDevice: device.onDevice,
  });
  return flush();
};

export const reachMoments = (moments: readonly string[]): Promise<void> => record({ reached: moments, seen: [] });

export const seeLine = (moment: string): Promise<void> => {
  const state = useOpeningStore.getState();
  if (state.showing === moment || state.confirmed === moment) {
    useOpeningStore.setState({
      showing: state.showing === moment ? null : state.showing,
      confirmed: state.confirmed === moment ? null : state.confirmed,
    });
  }
  return record({ reached: [], seen: [moment] });
};

export const commitTutorialStep = (step: {
  completed: readonly string[];
  showing: OpeningMoment | null;
  confirmed: OpeningMoment | null;
}): Promise<void> => {
  const state = useOpeningStore.getState();
  const cleanSeen = [...sanitizeKeys(step.completed)];
  const nextReplayed = cleanSeen.length > 0 ? without(state.replayed, cleanSeen) : state.replayed;
  const replayChanged = nextReplayed.size !== state.replayed.size;
  const freshSeen = cleanSeen.filter((moment) => !state.seen.has(moment));
  const viewChanged = state.showing !== step.showing || state.confirmed !== step.confirmed;
  if (freshSeen.length === 0 && !replayChanged && !viewChanged) return Promise.resolve();
  if (replayChanged) keepReplay(state.owner, nextReplayed);
  useOpeningStore.setState({
    seen: freshSeen.length > 0 ? union(state.seen, freshSeen) : state.seen,
    unsent:
      state.owner && freshSeen.length > 0
        ? { reached: state.unsent.reached, seen: union(state.unsent.seen, freshSeen) }
        : state.unsent,
    replayed: nextReplayed,
    showing: step.showing,
    confirmed: step.confirmed,
  });
  if (freshSeen.length > 0 || replayChanged) keep();
  return state.owner && freshSeen.length > 0 ? flush() : Promise.resolve();
};

export const clearConfirmedTutorial = (): void => {
  if (useOpeningStore.getState().confirmed !== null) useOpeningStore.setState({ confirmed: null });
};

export const skipTutorial = (): Promise<void> => {
  useOpeningStore.setState({ showing: null, confirmed: null });
  return record({ reached: [], seen: [TUTORIAL_SKIPPED] });
};

export const replayTutorial = (): void => {
  const state = useOpeningStore.getState();
  const replayed = new Set<string>(TUTORIAL_KEYS);
  keepReplay(state.owner, replayed);
  useOpeningStore.setState({ replayed, showing: null, confirmed: null });
};

const record = (additions: { reached: readonly string[]; seen: readonly string[] }): Promise<void> => {
  const state = useOpeningStore.getState();
  const cleanReached = [...sanitizeKeys(additions.reached)];
  const cleanSeen = [...sanitizeKeys(additions.seen)];
  const nextReplayed = cleanSeen.length > 0 ? without(state.replayed, cleanSeen) : state.replayed;
  const replayChanged = nextReplayed.size !== state.replayed.size;
  const fresh = {
    reached: cleanReached.filter((moment) => !state.reached.has(moment)),
    seen: cleanSeen.filter((moment) => !state.seen.has(moment)),
  };
  if (fresh.reached.length === 0 && fresh.seen.length === 0 && !replayChanged) return Promise.resolve();
  if (replayChanged) keepReplay(state.owner, nextReplayed);
  useOpeningStore.setState({
    reached: union(state.reached, fresh.reached),
    seen: union(state.seen, fresh.seen),
    unsent: state.owner
      ? { reached: union(state.unsent.reached, fresh.reached), seen: union(state.unsent.seen, fresh.seen) }
      : none(),
    replayed: nextReplayed,
  });
  keep();
  return state.owner && (fresh.reached.length > 0 || fresh.seen.length > 0) ? flush() : Promise.resolve();
};

let sending: Promise<void> | null = null;
let again = false;

export const flush = (): Promise<void> => {
  if (sending) {
    again = true;
    return sending;
  }
  if (!useOpeningStore.getState().owner) return Promise.resolve();
  sending = (async () => {
    try {
      do {
        again = false;
        const owner = useOpeningStore.getState().owner;
        if (!owner) return;
        const sent = await sendOnce(owner);
        if (sent === "failed") return;
        if (sent === "stale") again = true;
      } while (again || hasUnsent());
    } finally {
      sending = null;
    }
  })();
  return sending;
};

const hasUnsent = (): boolean => {
  const { unsent } = useOpeningStore.getState();
  return unsent.reached.size > 0 || unsent.seen.size > 0;
};

const sendOnce = async (owner: string): Promise<"sent" | "failed" | "stale"> => {
  const store = useOpeningStore;
  const currentUnsent = store.getState().unsent;
  const snapshot = {
    reached: [...sanitizeKeys(currentUnsent.reached)],
    seen: [...sanitizeKeys(currentUnsent.seen)],
  };
  try {
    const held = await identityClient.addOpeningProgress(snapshot);
    const state = store.getState();
    if (state.owner !== owner) return "stale";
    store.setState({
      status: "ready",
      reached: union(state.reached, held.reached),
      seen: union(state.seen, held.seen),
      unsent: {
        reached: without(state.unsent.reached, snapshot.reached),
        seen: without(state.unsent.seen, snapshot.seen),
      },
    });
    keep();
    return "sent";
  } catch {
    if (store.getState().owner === owner && store.getState().status !== "ready") store.setState({ status: "error" });
    return store.getState().owner === owner ? "failed" : "stale";
  }
};
