import { useState } from "react";

import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";

/** The identity service's refusal while an account has no way back in: no passkey and no linked wallet. */
const ACCOUNT_NOT_SECURED = "account_not_secured";

/**
 * An account created without its passkey signs in but cannot add a device, so it cannot play yet. Adding the passkey
 * refreshes the session, which retries the gameplay account on this device.
 */
export const SecureAccountPrompt = () => {
  const provisioningError = useAccountStore((state) => state.provisioningError);
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (provisioningError !== ACCOUNT_NOT_SECURED) return null;

  const secure = async () => {
    setPending(true);
    setError(null);
    try {
      await identityClient.registerPasskey();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The passkey was not added.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gold/40 p-3 text-[13px] text-gold/80">
      <span>Add a passkey to this account before you play, so you can always sign back in.</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => void secure()}
        className="rounded-lg border border-gold/40 px-3 py-2 font-cinzel text-[12px] uppercase tracking-[0.1em] text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {pending ? "Adding passkey…" : "Secure with a passkey"}
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
};
