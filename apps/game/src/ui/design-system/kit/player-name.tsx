import { usePlayerProfile } from "@/hooks/use-player-profile";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { displayPlayerName } from "@bibliothecadao/eternum";

import { Portrait } from "./portrait";
import { YOU } from "./words";

/**
 * A player, everywhere one shows, by the one name rule: the claimed name; else "Lord" and the account's last four in
 * the muted tone; "You" for the player on a list (the host knows its own row). The portrait shows where there is room,
 * round on a line ring, the player's own on peach. Until their profile is known, a muted bar and an empty ring stand in:
 * never the stand-in name and face of an account whose own name is on its way (qa-app-1 P3-4).
 */
export const PlayerName = ({
  account,
  you = false,
  portrait = false,
  profile: known,
}: {
  account: string | bigint;
  you?: boolean;
  portrait?: boolean;
  /** The player's profile when the host already holds it (a rating row names its owner); nothing is looked up then. */
  profile?: { name: string | null; portrait: string | null };
}) => {
  const looked = usePlayerProfile(known ? null : account);
  const profile = known ? { ...known, known: true } : looked;
  const waiting = !you && !profile.known;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      {portrait && (
        <Portrait
          account={account}
          portrait={profile.portrait}
          size={28}
          weight={1.5}
          ring={you ? "lit" : "line"}
          pending={waiting}
          className="shrink-0"
        />
      )}
      {waiting ? (
        <span aria-busy className="inline-block h-[0.8em] w-[6ch] rounded-full bg-kit-plate2" />
      ) : (
        <span className={cn("truncate", !you && profile.name === null && "text-kit-muted")}>
          {you ? YOU : displayPlayerName(account, profile.name)}
        </span>
      )}
    </span>
  );
};
