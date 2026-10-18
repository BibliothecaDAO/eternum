import { formatAmount, formatExact, LORDS } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { LABOR, REALMS } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/**
 * What hangs under the strip's right end: the realm's LORDS count (it opens Withdraw where one exists) and, while the
 * player's Realms have labor waiting today, the Realms chip beside it.
 */
export const PurseRow = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-auto absolute right-2 top-full z-10 flex gap-1.5">{children}</div>
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
        {formatExact(lords)}
      </span>,
      ...(gain === undefined
        ? []
        : [
            <span key="gain" className="tabular-nums text-hud-good">
              +{formatExact(gain)}
            </span>,
          ]),
    ]}
  </HudPill>
);

/** The labor the player's Realms have waiting today; it opens Realms. */
export const RealmsChip = ({ labor, onOpen }: { labor: number; onOpen: () => void }) => (
  <HudPill label={`${REALMS} +${formatAmount(labor)} ${LABOR}`} onPress={onOpen}>
    {[
      <span key="labor" className="flex items-center gap-1 tabular-nums">
        <SemanticIcon name="realm" size={24} />
        <SemanticIcon name="labor" size={22} />+{formatAmount(labor)}
      </span>,
    ]}
  </HudPill>
);
