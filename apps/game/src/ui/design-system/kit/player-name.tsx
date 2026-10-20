import { usePlayerName, usePlayerProfile } from "@/hooks/use-player-profile";
import { readKnownPlayerName } from "@/services/identity/player-profiles";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { Portrait } from "./portrait";
import { NAME_UNAVAILABLE, NAME_WAITING, YOU } from "./words";

/**
 * A player, everywhere one shows, as the one name rule reads them (readPlayerName): the claimed name; else "Lord" and
 * the account's last four in the muted tone; "You" for the player on a list (the host knows its own row). The portrait
 * shows where there is room, round on a line ring, the player's own on peach. Until their name is known, a muted bar
 * and an empty ring stand in (qa-app-1 P3-4); when identity's ask failed, a muted dash: never the stand-in name and face
 * of an account whose own name may exist.
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
  const looked = usePlayerName(known ? null : account);
  const face = usePlayerProfile(known ? null : account);
  const reading = known ? readKnownPlayerName(account, known.name) : looked!;
  const shown = you || reading.state === "named";
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      {portrait && (
        <Portrait
          account={account}
          portrait={known ? known.portrait : face.portrait}
          size={28}
          weight={1.5}
          ring={you ? "lit" : "line"}
          pending={!shown}
          className="shrink-0"
        />
      )}
      {you ? (
        <span className="truncate">{YOU}</span>
      ) : reading.state === "waiting" ? (
        <span
          aria-busy
          aria-label={NAME_WAITING}
          className="inline-block h-[0.8em] w-[6ch] rounded-full bg-kit-plate2"
        />
      ) : reading.state === "unavailable" ? (
        <span aria-label={NAME_UNAVAILABLE} className="text-kit-muted">
          {reading.text}
        </span>
      ) : (
        <span className={cn("truncate", !reading.claimed && "text-kit-muted")}>{reading.text}</span>
      )}
    </span>
  );
};
