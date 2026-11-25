import "./order-bar.css";

import { formatDuration, formatShort } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudIconButton, HudPanel } from "@/ui/design-system/kit/hud-elements";

import {
  CANCEL,
  EXPLORE,
  LEFT,
  MOVE,
  NEXT_ORDER,
  AFTER_THIS_ONE,
  STAMINA,
  WHEAT,
  heldAgainstNeed,
} from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { type Cost, isCovered } from "./army-order";
import { useEnterConfirms } from "./enter-confirms";

/** The order the row stands for, as assistive technology names it: its icons and numbers say it on screen. */
const VERBS = { explore: EXPLORE, move: MOVE } as const;

export const OrderBar = ({
  kind,
  stamina,
  wheat,
  refill,
  onCancel,
  onGo,
}: {
  kind: "explore" | "move";
  stamina: Cost;
  wheat: Cost;
  /** Refill, offered in the row when the order's stamina is short. */
  refill?: ReactNode;
  onCancel: () => void;
  onGo: () => void;
}) => {
  const covered = isCovered(stamina) && isCovered(wheat);
  useEnterConfirms(covered ? onGo : undefined);
  return (
    <HudPanel label={VERBS[kind]} collapsible={false} bodyClassName="order-tray">
      <div className="order-tray__costs">
        <CostLine icon="stamina" label={STAMINA} cost={stamina} after={(held) => `${held} → ${held - stamina.cost}`} />
        <CostLine icon="wheat" label={WHEAT} cost={wheat} after={() => `−${formatShort(wheat.cost)}`} />
        {!isCovered(stamina) && refill}
      </div>
      {covered && (
        <HudButton kind="primary" icon={kind} onClick={onGo}>
          {VERBS[kind]}
        </HudButton>
      )}
      <HudIconButton icon="close" label={CANCEL} kind="quiet" size="sm" onClick={onCancel} />
    </HudPanel>
  );
};

/**
 * The action bar while the selected army's order is in flight and a tile was tapped for it: that tile is the army's
 * next order, which leaves when the order in flight applies. Cancel drops it; another tap replaces it.
 */
export const NextOrderBar = ({ onCancel }: { onCancel: () => void }) => (
  <div className="pointer-events-auto grid grid-cols-3 gap-2">
    <HudPanel
      collapsible={false}
      className="col-span-2"
      bodyClassName="flex min-h-11 items-center justify-center gap-1.5"
    >
      <HudChip icons={["hourglass"]} label={NEXT_ORDER}>
        {AFTER_THIS_ONE}
      </HudChip>
    </HudPanel>
    <HudButton kind="quiet" onClick={onCancel}>
      {CANCEL}
    </HudButton>
  </div>
);

const CostLine = ({
  icon,
  label,
  cost,
  after,
}: {
  icon: IconMeaning;
  label: string;
  cost: Cost;
  after: (held: number) => string;
}) => {
  if (cost.held !== undefined && isCovered(cost))
    return (
      <span role="img" aria-label={`${label} ${after(cost.held)}`} className="order-tray__cost">
        <Icon name={icon} size={20} />
        {after(cost.held)}
      </span>
    );
  return (
    <>
      <HudChip icons={[icon]} label={label} tone="bad">
        {heldAgainstNeed(cost.held, cost.cost)}
      </HudChip>
      {cost.wait !== undefined && (
        <HudChip icons={["hourglass"]} label={LEFT}>
          {formatDuration(cost.wait)}
        </HudChip>
      )}
    </>
  );
};
