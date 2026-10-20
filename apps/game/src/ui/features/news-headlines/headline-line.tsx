import { usePlayerName } from "@/hooks/use-player-profile";
import { NAME_UNAVAILABLE, NAME_WAITING } from "@/ui/design-system/kit/words";

import type { HeadlinePart } from "./headline-types";

/** A headline's line as drawn: its words, and each player by the one name rule once identity has answered. */
export const HeadlineLine = ({ parts }: { parts: readonly HeadlinePart[] }) => (
  <>
    {parts.map((part, index) =>
      typeof part === "string" ? part : <HeadlinePlayer key={`${index}:${part.player}`} account={part.player} />,
    )}
  </>
);

/** A player in a headline, as the one name rule reads them: the name, "…" while it is on its way, "—" when unavailable. */
const HeadlinePlayer = ({ account }: { account: bigint }) => {
  const reading = usePlayerName(account)!;
  if (reading.state === "named") return <>{reading.text}</>;
  const waiting = reading.state === "waiting";
  return (
    <span aria-busy={waiting || undefined} aria-label={waiting ? NAME_WAITING : NAME_UNAVAILABLE}>
      {reading.text}
    </span>
  );
};
