import { lazy, Suspense } from "react";
import { create } from "zustand";

import {
  IDENTITY_POPOVER_ID,
  identityUsername,
  type IdentitySessionStatus,
  useIdentitySession,
} from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import type { Session } from "@realms-world/identity";

import { useRequestSignIn } from "./sign-in/sign-in-route";

/**
 * Where the account runtime renders the signed-in player's panel. The runtime (Starknet wallets, the gameplay account)
 * loads only once a player signs in, so an anonymous visit never downloads it.
 */
export const useIdentityPanelSlot = create<{
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
}>((set) => ({ element: null, setElement: (element) => set({ element }) }));

const AccountRuntime = lazy(() => import("./account-runtime"));

/** A session without a chosen name is asked for one; the flow opens on its name step. */
const chipLabel = (status: IdentitySessionStatus, session: Session | null): string => {
  if (status === "loading") return "…";
  return session ? "Choose a name" : "Sign in";
};

export const IdentityChip = () => {
  const { status, session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  const isOpen = usePopoverStore((state) => state.openId === IDENTITY_POPOVER_ID);
  const setElement = useIdentityPanelSlot((state) => state.setElement);
  const signedIn = status === "signed-in" ? session : null;
  const name = signedIn ? identityUsername(signedIn) : null;

  const togglePanel = () => {
    const popover = usePopoverStore.getState();
    if (isOpen) popover.close(IDENTITY_POPOVER_ID);
    else popover.open(IDENTITY_POPOVER_ID);
  };

  return (
    <div className="relative">
      {signedIn && name !== null ? (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={name}
          onClick={togglePanel}
          className="block size-11 overflow-hidden rounded-full border-2 border-[#dfaa54] shadow-[0_0_12px_rgba(246,172,29,0.35)]"
        >
          <img src={portraitUrl(signedIn.user.image ?? null)} alt="" className="size-full object-cover" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => requestSignIn()}
          disabled={status === "loading"}
          className="frontier-chip h-11 px-5 font-[Lexend] text-[17px] font-extrabold text-[#eadfc8] disabled:opacity-50"
        >
          {chipLabel(status, signedIn)}
        </button>
      )}
      {signedIn && isOpen ? (
        <div
          role="dialog"
          aria-label="Identity"
          className="frontier-card absolute right-0 top-full z-50 mt-2 w-72 p-4 shadow-xl"
        >
          <div ref={setElement} className="min-h-[3rem] text-gold" />
        </div>
      ) : null}
      {signedIn ? (
        <Suspense fallback={null}>
          <AccountRuntime />
        </Suspense>
      ) : null}
    </div>
  );
};

export const portraitUrl = (portrait: string | null): string => `/images/avatars/${portrait ?? "01"}.png`;
