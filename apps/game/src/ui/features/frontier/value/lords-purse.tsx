import { formatExact } from "@/ui/design-system/kit/amount";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { LORDS } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/** What hangs under the strip's right end: the realm's LORDS count. */
export const PurseRow = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-auto absolute right-2 top-full z-10 flex gap-1.5">{children}</div>
);

/** The realm's LORDS. */
export const LordsPurse = ({ lords }: { lords: number | undefined }) => (
  <span
    role="img"
    aria-label={`${LORDS} ${formatExact(lords)}`}
    className="flex h-[38px] items-center gap-1.5 rounded-b-xl border border-t-0 border-kit-line bg-[linear-gradient(180deg,#221a10,#120d08)] pl-1.5 pr-3"
  >
    <KitIcon code="Lo" size={26} />
    <span className="text-[17px] tabular-nums text-kit-cream">{formatExact(lords)}</span>
  </span>
);
