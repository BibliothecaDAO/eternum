import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { PICKED_ARMY } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { ArmyToken } from "./army-token";
import type { DockArmy } from "./dock-armies";

/** What the picked army's row reads of an army: the dock's own, so the lab draws it on its fiction. */
export type PickedArmyView = Pick<
  DockArmy,
  "explorerId" | "label" | "number" | "art" | "stamina" | "secondsToFull" | "troops" | "ethereal" | "drain"
>;

/** A phone's selected army: tap its token for details, with refill and Spire actions beside it. */
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
    <span className="grid w-24 shrink-0 gap-1.5">
      {refill}
      {spire}
    </span>
  </HudPanel>
);
