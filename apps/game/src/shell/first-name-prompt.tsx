import { useState } from "react";

import { identityUsername, useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";

import { GhostButton } from "./kit";
import { NameClaim } from "./name-claim";

/**
 * A new player names themselves right after their first sign-in, wherever they signed in: in the shell, or at a
 * game's entry before founding writes their name on-chain. It starts from the name suggested at sign-up (their Discord
 * name or their email's local part) and asks again on the next visit until they choose one.
 */
export const FirstNamePrompt = () => {
  const { session } = useIdentitySession();
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const [later, setLater] = useState(false);
  if (!session || identityUsername(session) !== null || later) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3 sm:bottom-6">
      <div
        role="dialog"
        aria-label="Choose your name"
        className="w-full max-w-md rounded-xl border border-gold/40 bg-brown p-4 shadow-xl"
      >
        <p className="mb-1 font-cinzel text-[15px] font-bold tracking-wide text-gold">Choose your name</p>
        <p className="mb-3 text-[13px] text-gold/70">
          Other lords see it in every game, and it is written when you found a realm.
        </p>
        <NameClaim currentName={null} suggestion={session.user.suggestedName ?? null} onDone={() => void refresh()} />
        <div className="mt-2">
          <GhostButton onClick={() => setLater(true)}>Later</GhostButton>
        </div>
      </div>
    </div>
  );
};
