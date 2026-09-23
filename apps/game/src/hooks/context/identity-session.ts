import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { createIdentityClient, profileOfIdentityUser, type Session } from "@realms-world/identity";
import { useEffect } from "react";
import { create } from "zustand";

/**
 * The identity session is the one "logged in" fact. Every surface that used to ask whether the gameplay account
 * had a non-zero address (the shell, the sign-in prompts, the HUD banner) reads this store instead; the
 * gameplay account is derived from the session by `GameplayAccountSync` and may lag it while it deploys.
 */
/** The identity Worker answers under this app's own /api, so its origin is the page's and no request crosses origins. */
export const identityOrigin = (): string => window.location.origin;

export const identityClient = createIdentityClient({ apiUrl: "/api" });

/** The identity chip's popover id: sign-in requests open it wherever the chip is mounted. */
export const IDENTITY_POPOVER_ID = "identity";

export type IdentitySessionStatus = "loading" | "anonymous" | "signed-in";

/**
 * A surface that needs a signed-in identity asks for one. A request without a redirect means "sign in here": the
 * chip opens the sign-in view and stays on the page; with one, the chip replays the redirect after sign-in.
 */
interface SignInRequest {
  redirectTo?: string;
  redirectState?: Record<string, unknown>;
}

interface IdentitySessionStore {
  status: IdentitySessionStatus;
  session: Session | null;
  signInRequest: SignInRequest | null;
  applySession: (session: Session | null) => void;
  refresh: () => Promise<void>;
  requestSignIn: (request?: SignInRequest) => void;
  clearSignInRequest: () => void;
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
  signInRequest: null,
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
  requestSignIn: (request = {}) => {
    set({ signInRequest: request });
    usePopoverStore.getState().open(IDENTITY_POPOVER_ID);
  },
  clearSignInRequest: () => set({ signInRequest: null }),
}));

/** End the identity session before detaching its wallet in every sign-out surface. */
export async function signOutIdentitySession(disconnect: () => Promise<unknown>): Promise<void> {
  await identityClient.signOut();
  useIdentitySessionStore.getState().applySession(null);
  try {
    await disconnect();
  } catch (error) {
    console.error("identity_wallet_disconnect_failed", error);
  }
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
