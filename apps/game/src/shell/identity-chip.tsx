import { NavLink } from "react-router-dom";

import { identityUsername, useIdentitySession } from "@/hooks/context/identity-session";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { Button } from "@/ui/design-system/kit/button";
import { PlayerName } from "@/ui/design-system/kit/player-name";

import { useRealmsPlayer } from "./herald";
import { useRequestSignIn } from "./sign-in/sign-in-route";
import { SIGN_IN_WORDS, WORDS } from "./words";

/**
 * The desktop top bar's player chip: the portrait and name, opening Profile; Sign in before a session; Claim name for
 * a session without a name (the flow opens on its name step).
 */
export const IdentityChip = () => {
  const { status, session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  const { data: account } = useRealmsPlayer();
  if (status === "loading") return null;
  if (!session) return <Button role="outline" word={WORDS.signIn} icon="Pf" onClick={() => requestSignIn()} />;
  if (identityUsername(session) === null)
    return <Button role="outline" word={SIGN_IN_WORDS.claimName} icon="Pf" onClick={() => requestSignIn()} />;
  return account ? <PlayerChip account={account} /> : null;
};

const PlayerChip = ({ account }: { account: string }) => {
  const profile = usePlayerProfile(account);
  return (
    <NavLink
      to="/profile"
      className="flex h-12 items-center gap-2.5 rounded-3xl border border-kit-line2 pl-1.5 pr-3.5 font-ui text-[15px] font-bold text-kit-cream"
    >
      <img
        src={playerPortraitUrl(account, profile.portrait)}
        alt=""
        className="size-9 rounded-full border-2 border-kit-peach object-cover"
      />
      <PlayerName account={account} />
    </NavLink>
  );
};
