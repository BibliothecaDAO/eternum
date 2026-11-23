import { identityClient } from "@/hooks/context/identity-session";
import { create } from "zustand";

/**
 * The signed-in account's opening progress, as its identity service keeps it: the moments the interface has opened to and
 * the lines it has been told. Every change is added here first and kept as unsent until the service has acknowledged
 * exactly that change; one request is in flight at a time, so a late answer can never clear what a later change added, and
 * a failed send stays unsent and is sent again. A device keeps the account's sets and its unsent changes, so a return
 * opens as the last session left it while the service is read.
 */
type Sets = { reached: ReadonlySet<string>; seen: ReadonlySet<string> };

interface OpeningStore extends Sets {
  owner: string | null;
  /** "ready" once the service has answered for this owner; "error" after a failed read or send, until one succeeds. */
  status: "signed-out" | "loading" | "ready" | "error";
  unsent: Sets;
  /** This device kept the account's progress from an earlier session, so what it shows is the account's own. */
  onDevice: boolean;
}

const none = (): Sets => ({ reached: new Set(), seen: new Set() });

export const useOpeningStore = create<OpeningStore>(() => ({
  owner: null,
  status: "signed-out",
  ...none(),
  unsent: none(),
  onDevice: false,
}));

export const openingCacheKey = (owner: string) => `eternum:opening:${owner}`;

/** What this device kept for the account: its sets and its unsent changes; empty where there is none or it cannot be read. */
const kept = (owner: string): { sets: Sets; unsent: Sets; onDevice: boolean } => {
  try {
    const stored = JSON.parse(localStorage.getItem(openingCacheKey(owner)) ?? "null") as {
      reached: string[];
      seen: string[];
      unsent: { reached: string[]; seen: string[] };
      complete?: boolean;
    } | null;
    if (!stored) return { sets: none(), unsent: none(), onDevice: false };
    return {
      // Only a cache the service once answered for is the account's own: one made of this device's additions alone is not.
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
  if (!owner) return;
  try {
    localStorage.setItem(
      openingCacheKey(owner),
      JSON.stringify({
        reached: [...reached],
        seen: [...seen],
        unsent: { reached: [...unsent.reached], seen: [...unsent.seen] },
        complete: status === "ready" || onDevice,
      }),
    );
  } catch {
    // A device that cannot keep it still plays: the account's service holds it.
  }
};

const union = (left: ReadonlySet<string>, right: Iterable<string>): ReadonlySet<string> => new Set([...left, ...right]);
const without = (left: ReadonlySet<string>, right: Iterable<string>): ReadonlySet<string> => {
  const removed = new Set(right);
  return new Set([...left].filter((moment) => !removed.has(moment)));
};

/** Starts on the account signed in: what this device kept shown at once, the service read, and anything unsent sent. */
export const loadOpening = (owner: string | null): Promise<void> => {
  if (useOpeningStore.getState().owner === owner) return Promise.resolve();
  if (!owner) {
    useOpeningStore.setState({ owner, status: "signed-out", ...none(), unsent: none(), onDevice: false });
    return Promise.resolve();
  }
  const device = kept(owner);
  useOpeningStore.setState({
    owner,
    status: "loading",
    ...device.sets,
    unsent: device.unsent,
    onDevice: device.onDevice,
  });
  return flush();
};

/** Records moments the interface has reached, once each. */
export const reachMoments = (moments: readonly string[]): Promise<void> => record({ reached: moments, seen: [] });

/** Records that the account has been told a moment's line. */
export const seeLine = (moment: string): Promise<void> => record({ reached: [], seen: [moment] });

const record = (additions: { reached: readonly string[]; seen: readonly string[] }): Promise<void> => {
  const state = useOpeningStore.getState();
  const fresh = {
    reached: additions.reached.filter((moment) => !state.reached.has(moment)),
    seen: additions.seen.filter((moment) => !state.seen.has(moment)),
  };
  if (fresh.reached.length === 0 && fresh.seen.length === 0) return Promise.resolve();
  useOpeningStore.setState({
    reached: union(state.reached, fresh.reached),
    seen: union(state.seen, fresh.seen),
    unsent: { reached: union(state.unsent.reached, fresh.reached), seen: union(state.unsent.seen, fresh.seen) },
  });
  keep();
  return state.owner ? flush() : Promise.resolve();
};

let sending: Promise<void> | null = null;
let again = false;

/** Sends what is unsent, one request at a time, until nothing is: the first call also reads the account's sets. */
export const flush = (): Promise<void> => {
  if (sending) {
    again = true;
    return sending;
  }
  // Nothing to send to: no request is begun, so none is left standing for the account that signs in next.
  if (!useOpeningStore.getState().owner) return Promise.resolve();
  sending = (async () => {
    try {
      do {
        again = false;
        const owner = useOpeningStore.getState().owner;
        if (!owner) return;
        const sent = await sendOnce(owner);
        if (sent === "failed") return;
        // The account changed while it was in flight: the new account's turn is next.
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

/** One request carrying a snapshot of the unsent changes; only that snapshot is acknowledged by its answer. */
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
