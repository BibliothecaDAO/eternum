import { useState } from "react";
import { useLocation } from "react-router-dom";

import { isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { identityClient, useIdentitySessionStore, useSignInAndReturn } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { forgetDeviceKey } from "@bibliothecadao/eternum";

const buttonClass =
  "rounded-lg border border-gold/40 px-3 py-2 font-cinzel text-[12px] uppercase tracking-[0.1em] text-gold hover:bg-gold/10 disabled:opacity-50";

/** A device removed from the account signs in again, as a new device with a fresh key. */
export const AccountStatePrompt = () => {
  const state = useAccountStore((store) => store.provisioningError);
  const applySession = useIdentitySessionStore((store) => store.applySession);
  const signInAndReturn = useSignInAndReturn();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isAccountStatePrompt(state)) return null;

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work. Try again.");
    } finally {
      setPending(false);
    }
  };

  const signInAgain = () =>
    run(async () => {
      forgetDeviceKey(localStorage);
      await identityClient.signOut();
      applySession(null);
      signInAndReturn(`${location.pathname}${location.search}`);
    });

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gold/40 p-3 text-[13px] text-gold/80">
      <span>This device was removed from your account. Sign in again to add it as a new device.</span>
      <button type="button" disabled={pending} onClick={() => void signInAgain()} className={buttonClass}>
        {pending ? "Signing out…" : "Sign in again"}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
};
