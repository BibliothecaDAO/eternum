import { NavLink } from "react-router-dom";

import { identityUsername, useIdentitySession } from "@/hooks/context/identity-session";
import { usePlayerProfile } from "@/hooks/use-player-profile";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { PlayerName } from "@/ui/design-system/kit/player-name";

import { useRealmsPlayer } from "./herald";
import { useRequestSignIn } from "./sign-in/sign-in-route";
import { SIGN_IN_WORDS, WORDS } from "./words";

/**
 * The desktop rail's foot: the player's portrait and name, opening Profile; Sign in before a session; Claim name for a
 * session without a name (the flow opens on its name step).
 */
export const IdentityChip = () => {
  const { status, session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  const { data: account } = useRealmsPlayer();
  if (status === "loading") return null;
  if (!session) return <RailButton word={WORDS.signIn} onClick={() => requestSignIn()} />;
  if (identityUsername(session) === null)
    return <RailButton word={SIGN_IN_WORDS.claimName} onClick={() => requestSignIn()} />;
  return account ? <PlayerChip account={account} /> : null;
};

const RailButton = ({ word, onClick }: { word: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-[76%] flex-col items-center gap-1.5 rounded-2xl border-2 border-kit-line2 px-1 py-2.5 font-ui text-[13px] text-kit-cream hover:border-kit-gold"
  >
    <KitIcon code="Pf" size={26} />
    {word}
  </button>
);

const PlayerChip = ({ account }: { account: string }) => {
  const profile = usePlayerProfile(account);
  return (
    <NavLink
      to="/profile"
      className="flex w-full flex-col items-center gap-1.5 px-1 font-ui text-[13px] text-kit-cream"
    >
      <img
        src={playerPortraitUrl(account, profile.portrait)}
        alt=""
        className="size-12 rounded-full border-[3px] border-kit-peach object-cover"
      />
      <span className="w-full truncate text-center">
        <PlayerName account={account} />
      </span>
    </NavLink>
  );
};
