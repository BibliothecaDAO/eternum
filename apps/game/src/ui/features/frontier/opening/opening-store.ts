import { identityClient } from "@/hooks/context/identity-session";
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

const keptReplay = (owner: string | null): ReadonlySet<string> => {
  try {
    const raw = JSON.parse(localStorage.getItem(replayCacheKey(owner)) ?? "[]");
    return Array.isArray(raw) ? new Set(raw.filter((item): item is string => typeof item === "string")) : new Set();
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
      sets: { reached: new Set(stored.reached), seen: new Set(stored.seen) },
      unsent: { reached: new Set(stored.unsent.reached), seen: new Set(stored.unsent.seen) },
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

export const completeLines = (moments: readonly string[]): Promise<void> => record({ reached: [], seen: moments });

export const setTutorialView = (showing: OpeningMoment | null, confirmed: OpeningMoment | null): void => {
  const state = useOpeningStore.getState();
  if (state.showing === showing && state.confirmed === confirmed) return;
  useOpeningStore.setState({ showing, confirmed });
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
  const nextReplayed = additions.seen.length > 0 ? without(state.replayed, additions.seen) : state.replayed;
  const replayChanged = nextReplayed.size !== state.replayed.size;
  const fresh = {
    reached: additions.reached.filter((moment) => !state.reached.has(moment)),
    seen: additions.seen.filter((moment) => !state.seen.has(moment)),
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
  const snapshot = { reached: [...store.getState().unsent.reached], seen: [...store.getState().unsent.seen] };
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
