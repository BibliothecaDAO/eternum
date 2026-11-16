import { Icon } from "@/ui/design-system/icon";
import { HudPanel, HudTier } from "@/ui/design-system/kit/hud-elements";
import { PICKED_ARMY, type Rank, tierNumeral } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { ArmyToken } from "./army-token";
import type { DockArmy } from "./dock-armies";

/** What the picked army's row reads of an army: the dock's own, so the lab draws it on its fiction. */
export type PickedArmyView = Pick<
  DockArmy,
  | "explorerId"
  | "label"
  | "number"
  | "art"
  | "stamina"
  | "secondsToFull"
  | "troops"
  | "ethereal"
  | "drain"
>;

/**
 * A phone's picked army, in the dock's place (owner, 22 October 2026: mobile direction A; 27 October: D, its stamina
 * over Level up): its token, a tap opening its card; its four sides with their tiers, which the token does not show;
 * then its stamina, which is its refill, over Level up, and Spire where it stands at its spire. Level up opens the card on its choices while a skill point can be spent, else the card. A tap on an empty tile lets the army go, and the dock comes back.
 */
export const PickedArmy = ({
  army,
  refill,
  spire,
  onDetails,
}: {
  army: PickedArmyView;
  /** The army's stamina as its refill's button. */
  refill: ReactNode;
  /** Its next-reveal Spire chance, or the nearby discovered Spire's card. */
  spire?: ReactNode;
  onDetails: () => void;
}) => (
  <HudPanel collapsible={false} className="pointer-events-auto" bodyClassName="flex items-center gap-3 pt-3">
    <ArmyToken
      label={PICKED_ARMY.details(army.label)}
      number={army.number}
      art={army.art}
      stamina={army.stamina}
      troops={army.troops}
      ethereal={army.ethereal}
      drain={army.drain}
      selected
      onPick={onDetails}
    />
    <span data-picked-army className="min-w-0 flex-1">
    </span>
    <span className="grid w-24 shrink-0 gap-1.5">
      {refill}
      {spire}
    </span>
  </HudPanel>
);
