import { formatRate, formatPoints } from "@bibliothecadao/types";
import type { configManager } from "@bibliothecadao/eternum";

/** The points each activity grants, as the game's rules give them. */
export type VictoryPointGrants = ReturnType<typeof configManager.getVictoryPointGrants>;

/**
 * What a held hyperstructure earns, as the contract pays it: its rate every second, alone ("+1/s"), doubled in a Duel
 * ("+2/s"), or for each realm settled on the six sites around it, which differs by hyperstructure ("x/s"). Its holders
 * split it by share. The realms around it are counted each time its shares are allocated (`reallocate` in
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
      grant: "x/s",
      tip: `Hold a Hyperstructure: ${formatPoints(rate)} every second for each realm settled on the six sites around it, split by share among its holders; a realm settled later counts from its next capture or share allocation`,
    };
  const perSecond = scale === "double" ? rate * 2 : rate;
  return {
    grant: formatRate(perSecond),
    tip: `Hold a Hyperstructure: ${formatPoints(perSecond)} every second, split by share among its holders`,
  };
};
