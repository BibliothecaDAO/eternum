import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount, formatExact } from "@/ui/design-system/kit/amount";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { LABOR, LORDS, REALMS } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

const TAB =
  "flex h-[38px] items-center gap-1.5 rounded-b-xl border border-t-0 bg-[linear-gradient(180deg,#221a10,#120d08)] pl-1.5 pr-3";

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
}) => {
  const body = (
    <>
      <KitIcon code="Lo" size={26} />
      <span className="text-[17px] tabular-nums text-kit-cream">{formatExact(lords)}</span>
      {gain !== undefined && <span className="text-[15px] tabular-nums text-[#b9e58a]">+{formatExact(gain)}</span>}
    </>
  );
  const look = cn(
    TAB,
    gain === undefined ? "border-kit-line" : "border-kit-hot shadow-[0_0_14px_rgba(246,172,29,0.45)]",
  );
  return onOpen ? (
    <button type="button" aria-label={`${LORDS} ${formatExact(lords)}`} onClick={onOpen} className={look}>
      {body}
    </button>
  ) : (
    <span role="img" aria-label={`${LORDS} ${formatExact(lords)}`} className={look}>
      {body}
    </span>
  );
};

/** The labor the player's Realms have waiting today; it opens Realms. */
export const RealmsChip = ({ labor, onOpen }: { labor: number; onOpen: () => void }) => (
  <button
    type="button"
    aria-label={`${REALMS} +${formatAmount(labor)} ${LABOR}`}
    onClick={onOpen}
    className={cn(TAB, "border-kit-hot shadow-[0_0_14px_rgba(246,172,29,0.45)]")}
  >
    <KitIcon code="Cs" size={24} />
    <KitIcon code="La" size={22} />
    <span className="text-[17px] tabular-nums text-kit-cream">+{formatAmount(labor)}</span>
  </button>
);
