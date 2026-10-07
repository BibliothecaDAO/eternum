import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { LEAVE, VISIT } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/**
 * Visiting another realm (wireframe 13): the eye, the realm's Order and name at the foot, and Leave, the one button;
 * nothing can be ordered. The name pulses until the realm's rows arrive. A spectator has no realm to go back to, so no
 * Leave.
 */
export const VisitFoot = ({
  label,
  order,
  name,
  arriving,
  onLeave,
}: {
  /** The realm's name as text, for a screen reader. */
  label: string;
  order: number | undefined;
  name: ReactNode;
  arriving: boolean;
  onLeave?: () => void;
}) => (
  <div
    role="status"
    aria-label={`${VISIT} ${label}`}
    className="frontier-card pointer-events-auto flex items-center gap-2 !rounded-xl p-1.5 pl-2"
  >
    <KitIcon code="Ey" size={24} />
    {order !== undefined && <OrderEmblem order={order} />}
    <span className={cn("min-w-0 flex-1 truncate text-[16px] text-kit-cream", arriving && "animate-pulse")}>
      {name}
    </span>
    {onLeave && <Button role="primary" icon="Bk" word={LEAVE} onClick={onLeave} className="w-[130px]" />}
  </div>
);
