import { useState } from "react";
import { createPortal } from "react-dom";

import { IDENTITY_POPOVER_ID, signOutIdentitySession, useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { GameplayAccountSync } from "@/hooks/context/gameplay-account-sync";
import { PlayerName } from "@/ui/design-system/kit/player-name";

import { useIdentityPanelSlot } from "./identity-chip";
import { AccountStatePrompt } from "./account-state";

/**
 * The shell's account runtime: the gameplay account sync and the signed-in player's panel. It is one lazy chunk,
 * mounted by the identity chip once a session exists; it loads no wallet.
 */
export default function AccountRuntime() {
  return (
    <GameplayAccountSync>
      <IdentityPanelPortal />
    </GameplayAccountSync>
  );
}

function IdentityPanelPortal() {
  const slot = useIdentityPanelSlot((state) => state.element);
  const { status, session } = useIdentitySession();
  if (!slot) return null;
  if (status !== "signed-in" || !session) return null;
  return createPortal(<SignedInPanel />, slot);
}

function SignedInPanel() {
  const account = useAccountStore((state) => state.account?.address);
  const closePopover = usePopoverStore((state) => state.close);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      await signOutIdentitySession();
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
      {account ? (
        <span className="text-sm font-semibold text-gold">
          <PlayerName account={account} />
        </span>
      ) : null}
      <AccountStatePrompt />
      <button
        type="button"
        disabled={signingOut}
        onClick={() => void signOut()}
        className="rounded-lg border border-gold/40 px-3 py-2 font-ui text-[12px] uppercase tracking-[0.1em] text-gold hover:bg-gold/10 disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
