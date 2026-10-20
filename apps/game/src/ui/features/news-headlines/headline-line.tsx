import { usePlayerProfile } from "@/hooks/use-player-profile";
import { NAME_UNAVAILABLE } from "@/ui/design-system/kit/words";
import { displayPlayerName } from "@bibliothecadao/eternum";

import type { HeadlinePart } from "./headline-types";

/** A headline's line as drawn: its words, and each player by the one name rule once identity has answered. */
export const HeadlineLine = ({ parts }: { parts: readonly HeadlinePart[] }) => (
  <>
    {parts.map((part, index) =>
      typeof part === "string" ? part : <HeadlinePlayer key={`${index}:${part.player}`} account={part.player} />,
    )}
  </>
);

/**
 * A player in a headline: their name once identity answers (an unclaimed one by the stand-in rule), "…" while it has
 * not, and a dash when its ask failed: never the account's stand-in in place of a name that may exist.
 */
const HeadlinePlayer = ({ account }: { account: bigint }) => {
  const profile = usePlayerProfile(account);
  if (profile.known) return <>{displayPlayerName(account, profile.name)}</>;
  return profile.unavailable ? <span aria-label={NAME_UNAVAILABLE}>—</span> : <span aria-busy>…</span>;
};
