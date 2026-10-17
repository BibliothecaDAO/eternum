import { currencyIntlFormat } from "@/ui/utils/utils";
import type { configManager } from "@bibliothecadao/eternum";

/** The points each activity grants, as the game's rules give them. */
export type VictoryPointGrants = ReturnType<typeof configManager.getVictoryPointGrants>;

/**
 * What a held hyperstructure earns, as the contract pays it: its rate every second, alone ("1 VP/s"), doubled in a Duel
 * ("2 VP/s"), or for each realm settled on the six sites around it, which differs by hyperstructure ("x VP/s").
 */
export const describeHyperstructureHold = ({
  hyperstructurePerSecond: rate,
  hyperstructureScale: scale,
}: VictoryPointGrants): { grant: string; rule: string } => {
  // Each hyperstructure pays its own rate, by the realms around it: no one number is true of all of them.
  if (scale === "per-realm")
    return {
      grant: "x VP/s",
      rule: `Hold a Hyperstructure: ${currencyIntlFormat(rate)} VP every second for each realm settled on the six sites around it`,
    };
  const perSecond = scale === "double" ? rate * 2 : rate;
  return {
    grant: `${currencyIntlFormat(perSecond)} VP/s`,
    rule: `Hold a Hyperstructure: ${currencyIntlFormat(perSecond)} VP every second`,
  };
};
