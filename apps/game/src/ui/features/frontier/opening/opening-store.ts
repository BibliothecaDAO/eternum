import { identityClient } from "@/hooks/context/identity-session";
import { create } from "zustand";

/**
 * The signed-in account's opening progress, as its identity service keeps it: the moments the interface has opened to
 * and the lines it has been told. Reads answer once per account; every change is added locally first and then sent, and
 * what the service holds is merged in, so a sent change that failed is sent again with the next one.
 */
interface OpeningStore {
  owner: string | null;
  /** "ready" once the account's own progress has been read: until then the HUD shows what the state alone reaches. */
  status: "signed-out" | "loading" | "ready" | "error";
  reached: ReadonlySet<string>;
  seen: ReadonlySet<string>;
  unsent: { reached: ReadonlySet<string>; seen: ReadonlySet<string> };
}

const none = (): ReadonlySet<string> => new Set();

export const useOpeningStore = create<OpeningStore>(() => ({
  owner: null,
  status: "signed-out",
  reached: none(),
  seen: none(),
  unsent: { reached: none(), seen: none() },
}));

/** Starts on the account signed in: its progress read once, none while signed out. */
export const loadOpening = async (owner: string | null): Promise<void> => {
  const store = useOpeningStore;
  if (store.getState().owner === owner) return;
  store.setState({
    owner,
    status: owner ? "loading" : "signed-out",
    reached: none(),
    seen: none(),
    unsent: emptyUnsent(),
  });
  if (owner) await send(owner, {});
};

const emptyUnsent = () => ({ reached: none(), seen: none() });

const union = (left: ReadonlySet<string>, right: Iterable<string>): ReadonlySet<string> => new Set([...left, ...right]);

/** Records moments the interface has reached, once each. */
export const reachMoments = (moments: readonly string[]): Promise<void> => record({ reached: moments });

/** Records that the account has been told a moment's line. */
export const seeLine = (moment: string): Promise<void> => record({ seen: [moment] });

const record = async (additions: { reached?: readonly string[]; seen?: readonly string[] }): Promise<void> => {
  const { owner, reached, seen, unsent } = useOpeningStore.getState();
  const fresh = {
    reached: (additions.reached ?? []).filter((moment) => !reached.has(moment)),
    seen: (additions.seen ?? []).filter((moment) => !seen.has(moment)),
  };
  if (fresh.reached.length === 0 && fresh.seen.length === 0) return;
  useOpeningStore.setState({
    reached: union(reached, fresh.reached),
    seen: union(seen, fresh.seen),
    unsent: { reached: union(unsent.reached, fresh.reached), seen: union(unsent.seen, fresh.seen) },
  });
  if (owner) await send(owner, fresh);
};

/** Sends what is unsent with `fresh`, and takes in the account's sets from the answer. */
const send = async (owner: string, fresh: { reached?: readonly string[]; seen?: readonly string[] }): Promise<void> => {
  const store = useOpeningStore;
  const { unsent } = store.getState();
  const additions = {
    reached: [...union(unsent.reached, fresh.reached ?? [])],
    seen: [...union(unsent.seen, fresh.seen ?? [])],
  };
  try {
    const held = await identityClient.addOpeningProgress(additions);
    if (store.getState().owner !== owner) return;
    const state = store.getState();
    store.setState({
      status: "ready",
      reached: union(state.reached, held.reached),
      seen: union(state.seen, held.seen),
      unsent: emptyUnsent(),
    });
  } catch {
    if (store.getState().owner === owner && store.getState().status !== "ready") store.setState({ status: "error" });
  }
};
