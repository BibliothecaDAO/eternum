import { lazy, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { create } from "zustand";

import {
  IDENTITY_POPOVER_ID,
  identityUsername,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import type { Session } from "@realms-world/identity";

import { shortAddress } from "./format";

/**
 * Where the account runtime renders its sign-in and sign-out panel. The runtime (Starknet wallets, the gameplay
 * account) loads only once a player signs in or asks to, so an anonymous visit never downloads it.
 */
export const useIdentityPanelSlot = create<{
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
}>((set) => ({ element: null, setElement: (element) => set({ element }) }));

const AccountRuntime = lazy(() => import("./account-runtime"));

export const displayName = (session: Session): string => identityUsername(session) ?? shortAddress(session.user.id);

const chipLabel = (status: "loading" | "anonymous" | "signed-in", session: Session | null): string => {
  if (status === "loading") return "…";
  if (status === "signed-in" && session) return displayName(session);
  return "Sign in";
};

export const IdentityChip = () => {
  const { status, session } = useIdentitySession();
  const signInRequest = useIdentitySessionStore((state) => state.signInRequest);
  const requestSignIn = useIdentitySessionStore((state) => state.requestSignIn);
  const clearSignInRequest = useIdentitySessionStore((state) => state.clearSignInRequest);
  const isOpen = usePopoverStore((state) => state.openId === IDENTITY_POPOVER_ID);
  const setElement = useIdentityPanelSlot((state) => state.setElement);
  const navigate = useNavigate();
  const needsRuntime = status === "signed-in" || signInRequest !== null;

  // Once the session lands, the request is done; a surface that asked for a redirect gets it replayed.
  useEffect(() => {
    if (status !== "signed-in" || !signInRequest) return;
    clearSignInRequest();
    usePopoverStore.getState().close(IDENTITY_POPOVER_ID);
    if (signInRequest.redirectTo) {
      navigate(signInRequest.redirectTo, { replace: true, state: signInRequest.redirectState });
    }
  }, [clearSignInRequest, navigate, signInRequest, status]);

  const toggle = () => {
    const popover = usePopoverStore.getState();
    if (isOpen) popover.close(IDENTITY_POPOVER_ID);
    else if (status === "signed-in") popover.open(IDENTITY_POPOVER_ID);
    else requestSignIn();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggle}
        className="flex h-10 min-w-[128px] items-center justify-center gap-2 rounded-lg border border-gold/40 bg-black/50 px-4 font-cinzel text-[12px] font-semibold uppercase tracking-[0.12em] text-gold hover:bg-gold/10"
      >
        {session && status === "signed-in" ? (
          <img src={portraitUrl(session.user.image ?? null)} alt="" className="h-6 w-6 rounded object-cover" />
        ) : null}
        {chipLabel(status, session)}
      </button>
      {isOpen ? (
        <div
          role="dialog"
          aria-label="Identity"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-gold/30 bg-brown p-4 shadow-xl"
        >
          <div ref={setElement} className="min-h-[3rem] text-gold">
            {needsRuntime ? null : <p className="text-sm text-gold/70">Loading…</p>}
          </div>
        </div>
      ) : null}
      {needsRuntime ? (
        <Suspense fallback={null}>
          <AccountRuntime />
        </Suspense>
      ) : null}
    </div>
  );
};

export const PORTRAITS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

export const portraitUrl = (portrait: string | null): string => `/images/avatars/${portrait ?? "01"}.png`;
