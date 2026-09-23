import { useState } from "react";
import { createPortal } from "react-dom";
import { useDisconnect } from "@starknet-react/core";

import { IDENTITY_POPOVER_ID, signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { StarknetProvider } from "@/hooks/context/starknet-provider";
import { IdentityLogin } from "@/ui/modules/identity/identity-login";
import type { Session } from "@realms-world/identity";

import { displayName, useIdentityPanelSlot } from "./identity-chip";
import { AccountStatePrompt } from "./account-state";
import { shortAddress } from "./format";

/**
 * The shell's account runtime: the Starknet wallet connectors, the gameplay account sync, and the identity panel.
 * It is one lazy chunk, mounted by the identity chip when a session exists or is being requested.
 */
export default function AccountRuntime() {
  return (
    <StarknetProvider>
      <IdentityPanelPortal />
    </StarknetProvider>
  );
}

function IdentityPanelPortal() {
  const slot = useIdentityPanelSlot((state) => state.element);
  const { status, session } = useIdentitySession();
  if (!slot) return null;
  return createPortal(status === "signed-in" && session ? <SignedInPanel session={session} /> : <SignInPanel />, slot);
}

function SignedInPanel({ session }: { session: Session }) {
  const closePopover = usePopoverStore((state) => state.close);
  const { disconnectAsync } = useDisconnect();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOutIdentitySession(disconnectAsync);
      closePopover(IDENTITY_POPOVER_ID);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Sign out failed";
      console.error("identity_sign_out_failed", { error: message });
      setError(message);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-gold">{displayName(session)}</span>
        {session.user.address ? (
          <span className="font-mono text-xs text-gold/60">{shortAddress(session.user.address)}</span>
        ) : null}
      </div>
      <AccountStatePrompt />
      {session.user.address ? null : (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gold/60">Link a wallet to claim prizes and withdraw.</span>
          <IdentityLogin mode="link" className="items-start" />
        </div>
      )}
      <button
        type="button"
        disabled={signingOut}
        onClick={() => void signOut()}
        className="rounded-lg border border-gold/40 px-3 py-2 font-cinzel text-[12px] uppercase tracking-[0.1em] text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

const SignInPanel = () => (
  <div className="flex flex-col gap-3">
    <p className="text-sm text-gold/85">
      A Realms account needs no wallet: a passkey on this device signs you in. Your gameplay account is prepared
      automatically when you play.
    </p>
    <IdentityLogin className="items-start" />
  </div>
);
