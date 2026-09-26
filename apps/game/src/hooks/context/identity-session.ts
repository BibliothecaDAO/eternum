import { createIdentityClient, profileOfIdentityUser, type Session } from "@realms-world/identity";
import { useEffect } from "react";
import { create } from "zustand";

/**
 * The identity session is the one "logged in" fact. Every surface that used to ask whether the gameplay account
 * had a non-zero address (the shell, the sign-in prompts, the HUD banner) reads this store instead; the
 * gameplay account is derived from the session by `GameplayAccountSync` and may lag it while it deploys.
 */
/** The identity Worker answers under this app's own /api, so no request crosses origins. */
export const identityClient = createIdentityClient({ apiUrl: "/api" });

/** The identity chip's popover id: a signed-in player's account panel opens from it. */
export const IDENTITY_POPOVER_ID = "identity";

export type IdentitySessionStatus = "loading" | "anonymous" | "signed-in";

interface IdentitySessionStore {
  status: IdentitySessionStatus;
  session: Session | null;
  applySession: (session: Session | null) => void;
  refresh: () => Promise<void>;
}

const resolveStatus = (session: Session | null): IdentitySessionStatus => (session ? "signed-in" : "anonymous");

/** Notifications belong to the Realms account, named by its Realms id: every notification surface reads the owner here. */
export const notificationOwnerOf = (session: Session | null): string | null => session?.user.realmsId ?? null;

/** The signed-in user's chosen username, null before they choose one (the name then still reads as the address). */
export const identityUsername = (session: Session | null): string | null =>
  session ? profileOfIdentityUser(session.user).name : null;

export const useIdentitySessionStore = create<IdentitySessionStore>()((set) => ({
  status: "loading",
  session: null,
  applySession: (session) => set({ session, status: resolveStatus(session) }),
  refresh: async () => {
    try {
      const session = await identityClient.getSession();
      set({ session, status: resolveStatus(session) });
    } catch (error) {
      console.error("identity_session_load_failed", error);
      set({ session: null, status: "anonymous" });
    }
  },
}));

/** Ends the identity session; no wallet stays connected to detach, since a wallet only links from the account page. */
export async function signOutIdentitySession(): Promise<void> {
  await identityClient.signOut();
  useIdentitySessionStore.getState().applySession(null);
}

let initialLoad: Promise<void> | null = null;

const loadIdentitySessionOnce = (): Promise<void> => (initialLoad ??= useIdentitySessionStore.getState().refresh());

/** Subscribes to the identity session and starts its first load. */
export const useIdentitySession = () => {
  const status = useIdentitySessionStore((state) => state.status);
  const session = useIdentitySessionStore((state) => state.session);

  useEffect(() => {
    void loadIdentitySessionOnce();
  }, []);

  return { status, session };
};
