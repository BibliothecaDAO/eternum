import { formatRate, formatPoints } from "@bibliothecadao/types";
import type { configManager } from "@bibliothecadao/eternum";

/** The points each activity grants, as the game's rules give them. */
export type VictoryPointGrants = ReturnType<typeof configManager.getVictoryPointGrants>;

/**
 * What a held hyperstructure earns, paid every second and written a minute's as every rate is: alone ("+60/min"),
 * doubled in a Duel ("+120/min"), or for each realm settled on the six sites around it, which differs by hyperstructure
 * ("x/min"). Its holders split it by share. The realms around it are counted each time its shares are allocated (`reallocate` in
 * logic/hyperstructures.cairo), and the multiplier rule ships only with shares that follow the owner (arenaModeRules),
 * where a capture allocates them to the new owner: a realm settled later counts from the next capture or allocation.
 */
export const describeHyperstructureHold = ({
  hyperstructurePerSecond: rate,
  hyperstructureScale: scale,
}: VictoryPointGrants): { grant: string; tip: string } => {
  // Each hyperstructure pays its own rate, by the realms around it: no one number is true of all of them.
  if (scale === "per-realm")
    return {
      grant: "x/min",
      tip: `Hold a Hyperstructure: ${formatPoints(rate * 60)} a minute for each realm settled on the six sites around it, split by share among its holders; a realm settled later counts from its next capture or share allocation`,
    };
  const perSecond = scale === "double" ? rate * 2 : rate;
  return {
    grant: formatRate(perSecond),
    tip: `Hold a Hyperstructure: ${formatPoints(perSecond * 60)} a minute, split by share among its holders`,
  };
};
