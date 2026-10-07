import type { ReactNode } from "react";

import { formatExact } from "./amount";
import { type IconCode, KitIcon } from "./kit-icon";
import { StoreBar } from "./store-bar";
import { formatDuration } from "./time";

/**
 * Why a verb cannot run, standing where its button would: either what is held against what is needed (and the exact
 * wait when it fills by itself), or the one line naming what failed.
 */
type Reason =
  | { kind: "short"; icon: IconCode; held: number | undefined; need: number; unit?: string; wait?: number }
  | { kind: "failed"; line: string };

/** The reason, then the step the player can take (a Button) beside it. */
export const ReasonPlate = ({ reason, step }: { reason: Reason; step?: ReactNode }) => (
  <div className="flex min-h-14 items-center gap-2">
    <div
      role="status"
      className="frontier-card flex min-h-14 min-w-0 flex-1 items-center gap-2.5 !rounded-xl px-3 text-[color:var(--frontier-parchment)]"
    >
      {reason.kind === "short" ? <Shortfall {...reason} /> : <span className="text-[15px]">{reason.line}</span>}
    </div>
    {step}
  </div>
);

const Shortfall = ({ icon, held, need, unit, wait }: Extract<Reason, { kind: "short" }>) => (
  <>
    <KitIcon code={icon} size={22} />
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex items-baseline gap-1">
        <span className="whitespace-nowrap text-[15px] tabular-nums">
          {formatExact(held)} / {formatExact(need)}
        </span>
        {unit && <span className="text-[13px] font-semibold">{unit}</span>}
      </span>
      <StoreBar amount={held} limit={need} tone="calm" />
    </span>
    {wait !== undefined && (
      <span className="frontier-chip shrink-0 !gap-1 !py-1 !pl-1.5">
        <span className="contents">
          <KitIcon code="Hg" size={18} />
          <span className="frontier-chip-number tabular-nums !text-[15px]">{formatDuration(wait)}</span>
        </span>
      </span>
    )}
  </>
);
