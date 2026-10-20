import { PlayerName } from "@/ui/design-system/kit/player-name";

import type { HeadlinePart } from "./headline-types";

/** A headline's line as drawn: its words, and each player by the one name rule, waiting until identity answers. */
export const HeadlineLine = ({ parts }: { parts: readonly HeadlinePart[] }) => (
  <>
    {parts.map((part, index) =>
      typeof part === "string" ? part : <PlayerName key={`${index}:${part.player}`} account={part.player} />,
    )}
  </>
);
