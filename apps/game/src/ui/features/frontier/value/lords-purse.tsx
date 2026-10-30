import { formatExact, formatGain, LORDS, formatShort } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { ESSENCE, LABOR, REALM_LABOR } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import type { DailyClaimWaiting } from "./realm-labor";

/**
 * Under the phone's strip, beside Next up at its right: the realm's LORDS count (it opens Withdraw where one exists)
 * and, while the player's Realms have labor waiting today, the Realms chip beside it (the phone's Menu always has
 * Realms). A desktop's realm panel carries both, its Realms chip always.
 */
export const PurseRow = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-auto flex shrink-0 gap-1.5">{children}</div>
);

/** The realm's LORDS, and what a chest just added to them. */
export const LordsPurse = ({
  lords,
  gain,
  onOpen,
}: {
  lords: number | undefined;
  gain?: number;
  onOpen?: () => void;
}) => (
  <HudPill label={`${LORDS} ${formatExact(lords)}`} role={onOpen ? undefined : "img"} onPress={onOpen}>
    {[
      <span key="lords" className="flex items-center gap-1.5 tabular-nums">
        <SemanticIcon name="lords" size={26} />
        {formatShort(lords)}
      </span>,
      ...(gain === undefined
        ? []
        : [
            <span key="gain" className="tabular-nums text-hud-good">
              {formatShort(gain, { signed: true })}
            </span>,
          ]),
    ]}
  </HudPill>
);

/**
 * The settled home's daily claim: the Labor and a campaign home's Essence waiting today. While amounts show, their icons
 * say what the chip is; the realm's icon stands alone when nothing waits. In the desktop card's header row, equal Labor
 * and Essence (a Devcon home's) share one amount after both icons, so the chip fits beside the rank; on a phone's purse
 * row (`narrow`) each amount keeps its own icon.
 */
export const RealmsChip = ({
  waiting,
  narrow = false,
  onOpen,
}: {
  waiting: DailyClaimWaiting | null;
  narrow?: boolean;
  onOpen: () => void;
}) => (
  <HudPill label={[REALM_LABOR, ...claimWords(waiting)].join(" ")} onPress={onOpen}>
    {[
      <span key="claim" className="flex items-center gap-1 tabular-nums">
        {!waiting && <SemanticIcon name="realm" size={24} />}
        {claimAmounts(waiting, narrow).map(({ icons, amount }) => (
          <ClaimAmount key={icons.join()} icons={icons} amount={amount} />
        ))}
      </span>,
    ]}
  </HudPill>
);

type ClaimIcon = "labor" | "essence";

/** The chip's amounts, each after the icons of what it counts: equal Labor and Essence share one, but on a phone. */
const claimAmounts = (waiting: DailyClaimWaiting | null, narrow: boolean): { icons: ClaimIcon[]; amount: number }[] => {
  if (!waiting) return [];
  if (!narrow && waiting.essence > 0 && waiting.essence === waiting.labor)
    return [{ icons: ["labor", "essence"], amount: waiting.labor }];
  return [
    ...(waiting.labor > 0 ? [{ icons: ["labor" as const], amount: waiting.labor }] : []),
    ...(waiting.essence > 0 ? [{ icons: ["essence" as const], amount: waiting.essence }] : []),
  ];
};

const ClaimAmount = ({ icons, amount }: { icons: ClaimIcon[]; amount: number }) => (
  <>
    {icons.map((icon) => (
      <SemanticIcon key={icon} name={icon} size={22} />
    ))}
    {formatShort(amount, { signed: true })}
  </>
);

/** The chip's name for assistive technology: "+2,000 labor +2,000 Essence". */
const claimWords = (waiting: DailyClaimWaiting | null): string[] => [
  ...(waiting && waiting.labor > 0 ? [`${formatGain(waiting.labor)} ${LABOR}`] : []),
  ...(waiting && waiting.essence > 0 ? [`${formatGain(waiting.essence)} ${ESSENCE}`] : []),
];
