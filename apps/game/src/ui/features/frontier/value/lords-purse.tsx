import { formatAmount, formatExact, LORDS } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPill } from "@/ui/design-system/kit/hud-elements";
import { LABOR, REALMS } from "@/ui/design-system/kit/words";
import { useLayout } from "@/shell/frame/layout";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";

/**
 * Under the strip's right end: the realm's LORDS count (it opens Withdraw where one exists) and, while the player's
 * Realms have labor waiting today, the Realms chip beside it. A phone hangs it over the map; a desktop's column gives it
 * its own row under the strip, so nothing below it lies under it.
 */
export const PurseRow = ({ children }: { children: ReactNode }) => (
  <div
    className={cn(
      "pointer-events-auto flex gap-1.5",
      useLayout() === "desktop" ? "justify-end pr-2" : "absolute right-2 top-full z-10",
    )}
  >
    {children}
  </div>
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
