import { useAccountStore } from "@/hooks/store/use-account-store";
import { fetchApi } from "@/runtime/app-api";
import { createIdentityClient, profileOfIdentityUser, type Session } from "@realms-world/identity";
import { useEffect } from "react";
import { create } from "zustand";

/**
 * The identity session is the one "logged in" fact. Every surface that used to ask whether the gameplay account
 * had a non-zero address (the shell, the sign-in prompts, the HUD banner) reads this store instead; the
 * gameplay account is derived from the session by `GameplayAccountSync` and may lag it while it deploys.
 */
/** The identity Worker answers under this app's own /api, so no request crosses origins. */
export const identityClient = createIdentityClient({ apiUrl: "/api", fetch: fetchApi });

/** The identity chip's popover id: a signed-in player's account panel opens from it. */
export const IDENTITY_POPOVER_ID = "identity";

export type IdentitySessionStatus = "loading" | "anonymous" | "signed-in";

interface IdentitySessionStore {
  status: IdentitySessionStatus;
  session: Session | null;
  error: unknown;
  applySession: (session: Session | null) => void;
  refresh: () => Promise<void>;
}

const resolveStatus = (session: Session | null): IdentitySessionStatus => (session ? "signed-in" : "anonymous");

/** Notifications belong to the Realms account, named by its Realms id: every notification surface reads the owner here. */
export const notificationOwnerOf = (session: Session | null): string | null => session?.user.realmsId ?? null;

/** The signed-in user's chosen username, null before they choose one (the name then still reads as the address). */
export const identityUsername = (session: Session | null): string | null =>
  session ? profileOfIdentityUser(session.user).name : null;

const INITIAL_RETRY_MS = 5_000;
const MAX_RETRY_MS = 30_000;
const retryDelayMs = (attempt: number) => Math.min(INITIAL_RETRY_MS * 2 ** attempt, MAX_RETRY_MS);

let sessionRevision = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let initialLoad: Promise<void> | null = null;
let refreshInFlight: { revision: number; promise: Promise<void> } | null = null;

const clearRetryTimer = () => {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
};

const runRefresh = (
  get: () => IdentitySessionStore,
  set: (partial: Partial<IdentitySessionStore>) => void,
  resetRetries: boolean,
): Promise<void> => {
  if (refreshInFlight) {
    return refreshInFlight.revision === sessionRevision
      ? refreshInFlight.promise
      : refreshInFlight.promise.then(() => runRefresh(get, set, resetRetries));
  }
  const revision = ++sessionRevision;
  clearRetryTimer();
  if (resetRetries) {
    retryAttempt = 0;
    if (get().error !== null) set({ error: null });
  }
  const promise = readSessionRevision(revision, get, set).finally(() => {
    refreshInFlight = null;
  });
  refreshInFlight = { revision, promise };
  return promise;
};

export const useIdentitySessionStore = create<IdentitySessionStore>()((set, get) => ({
  status: "loading",
  session: null,
  error: null,
  applySession: (session) => {
    sessionRevision += 1;
    clearRetryTimer();
    retryAttempt = 0;
    if (!session) useAccountStore.getState().setGameplayAccount(null, null);
    set({ session, status: resolveStatus(session), error: null });
  },
  refresh: () => runRefresh(get, set, true),
}));

async function readSessionRevision(
  revision: number,
  get: () => IdentitySessionStore,
  set: (partial: Partial<IdentitySessionStore>) => void,
): Promise<void> {
  try {
    const session = await identityClient.getSession();
    if (revision === sessionRevision) get().applySession(session);
  } catch (error) {
    if (revision !== sessionRevision) return;
    console.error("identity_session_load_failed", error);
    if (get().status === "loading") set({ error });
    if (!retryTimer) {
      const delay = retryDelayMs(retryAttempt);
      retryAttempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void runRefresh(get, set, false);
      }, delay);
    }
  }
}

/** Ends the identity session; no wallet stays connected to detach, since a wallet only links from the account page. */
export async function signOutIdentitySession(): Promise<void> {
  await identityClient.signOut();
  useIdentitySessionStore.getState().applySession(null);
}

/**
 * Deletes the Realms account with its emailed code; the session ends with it. The device key stays: it is this
 * browser's, shared by every account signed in on it.
 */
export async function deleteIdentityAccount(code: string): Promise<void> {
  await identityClient.deleteAccount(code);
  useIdentitySessionStore.getState().applySession(null);
}

const loadIdentitySessionOnce = (): Promise<void> => (initialLoad ??= useIdentitySessionStore.getState().refresh());

const retryIdentitySession = () => void useIdentitySessionStore.getState().refresh();

/** Subscribes to the identity session and starts its first load. */
export const useIdentitySession = () => {
  const status = useIdentitySessionStore((state) => state.status);
  const session = useIdentitySessionStore((state) => state.session);
  const error = useIdentitySessionStore((state) => state.error);

  useEffect(() => {
    void loadIdentitySessionOnce();
  }, []);

  return { status, session, error, retry: retryIdentitySession };
};
