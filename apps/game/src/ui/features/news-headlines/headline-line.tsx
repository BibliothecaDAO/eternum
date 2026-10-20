import { usePlayerProfile } from "@/hooks/use-player-profile";
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

/** A player in a headline: "…" while identity has not answered, never the account's stand-in name meanwhile. */
const HeadlinePlayer = ({ account }: { account: bigint }) => {
  const profile = usePlayerProfile(account);
  return profile.known ? <>{displayPlayerName(account, profile.name)}</> : <span aria-busy>…</span>;
};
