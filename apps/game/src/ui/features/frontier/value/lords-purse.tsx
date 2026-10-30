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

/** The settled home's daily claim: the Labor and a campaign home's Essence waiting today, each by its icon. */
export const RealmsChip = ({ waiting, onOpen }: { waiting: DailyClaimWaiting | null; onOpen: () => void }) => (
  <HudPill label={[REALM_LABOR, ...claimWords(waiting)].join(" ")} onPress={onOpen}>
    {[
      <span key="claim" className="flex items-center gap-1 tabular-nums">
        <SemanticIcon name="realm" size={24} />
        {waiting && waiting.labor > 0 && <ClaimAmount icon="labor" amount={waiting.labor} />}
        {waiting && waiting.essence > 0 && <ClaimAmount icon="essence" amount={waiting.essence} />}
      </span>,
    ]}
  </HudPill>
);

const ClaimAmount = ({ icon, amount }: { icon: "labor" | "essence"; amount: number }) => (
  <>
    <SemanticIcon name={icon} size={22} />
    {formatShort(amount, { signed: true })}
  </>
);

/** The chip's name for assistive technology: "+2,000 labor +2,000 Essence". */
const claimWords = (waiting: DailyClaimWaiting | null): string[] => [
  ...(waiting && waiting.labor > 0 ? [`${formatGain(waiting.labor)} ${LABOR}`] : []),
  ...(waiting && waiting.essence > 0 ? [`${formatGain(waiting.essence)} ${ESSENCE}`] : []),
];
