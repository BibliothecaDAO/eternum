import { usePopoverStore } from "@/hooks/store/use-popover-store";
import type { LandingEntryRouteState } from "@/ui/features/landing/lib/landing-entry-state";
import { resolveEndpoint } from "@realms-world/chain";
import { createIdentityClient, type Session } from "@realms-world/identity";
import { useEffect } from "react";
import { create } from "zustand";
import { env } from "../../../env";

/**
 * The identity session is the one "logged in" fact. Every surface that used to ask whether the gameplay account
 * had a non-zero address (the landing gate, the sign-in prompts, the HUD banner) reads this store instead; the
 * gameplay account is derived from the session by `GameplayAccountSync` and may lag it while it deploys.
 */
export const identityOrigin = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_ORIGIN, {
  name: "VITE_PUBLIC_IDENTITY_ORIGIN",
  browserFacing: true,
});

export const identityClient = createIdentityClient({ baseUrl: `${identityOrigin}/api/auth` });

/** The identity chip's popover id: sign-in requests open it wherever the chip is mounted. */
export const IDENTITY_POPOVER_ID = "identity";

export type IdentitySessionStatus = "loading" | "anonymous" | "signed-in";

/** A surface that needs a signed-in identity asks for one; the landing chip replays the redirect after sign-in. */
interface SignInRequest {
  redirectTo: string;
  redirectState?: LandingEntryRouteState;
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
  requestSignIn: (request) => {
    set({ signInRequest: request ?? null });
    usePopoverStore.getState().open(IDENTITY_POPOVER_ID);
  },
  clearSignInRequest: () => set({ signInRequest: null }),
}));

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
