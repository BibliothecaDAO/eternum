import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

import { COUNTED, type Reason, shortfallLine } from "./reasons";

/** The reason, then the step the player can take (a Button) beside it. */
export const ReasonPlate = ({ reason, step }: { reason: Reason; step?: ReactNode }) => (
  <div className="flex min-h-14 items-center gap-2">
    <div
      role="status"
      className="frontier-card flex min-h-14 min-w-0 flex-1 items-center gap-2.5 !rounded-control px-3 py-1.5 text-kit-cream"
    >
      {reason.kind === "short" ? <Shortfall reason={reason} /> : <span className="text-base">{reason.line}</span>}
    </div>
    {step}
  </div>
);

const Shortfall = ({ reason }: { reason: Extract<Reason, { kind: "short" }> }) => {
  const icon = reason.counted === "limit" ? "resources" : COUNTED[reason.of].icon;
  return (
    <>
      {icon && <SemanticIcon name={icon} size={22} />}
      <span className="min-w-0 flex-1 text-base leading-snug tabular-nums">{shortfallLine(reason)}</span>
    </>
  );
};
