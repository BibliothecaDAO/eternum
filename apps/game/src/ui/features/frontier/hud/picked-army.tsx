import "./phone-hud.css";

import { HudPanel, HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { PICKED_ARMY, TROOPS } from "@/ui/design-system/kit/words";
import { formatAmount, frontierTroopName } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { DeepDrain, EtherealMark, StaminaReading } from "./army-token";
import type { DockArmy } from "./dock-armies";

export type PickedArmyView = Pick<
  DockArmy,
  "explorerId" | "label" | "number" | "art" | "stamina" | "secondsToFull" | "troops" | "ethereal" | "drain"
> & {
  troopsFact?: Pick<DockArmy["troopsFact"], "category">;
};

export const PickedArmy = ({
  army,
  refill,
  spire,
  onDetails,
}: {
  army: PickedArmyView;
  refill: ReactNode;
  spire?: ReactNode;
  onDetails: () => void;
}) => {
  const category = army.troopsFact?.category;
  const heading = (category && frontierTroopName(category)) ?? army.label;
  const title = army.troops === undefined ? heading : `${heading} · ${formatAmount(army.troops)}`;
  return (
    <HudPanel collapsible={false} className="pointer-events-auto" bodyClassName="frontier-picked-army pt-3">
      <button
        type="button"
        aria-label={PICKED_ARMY.details(army.label)}
        onClick={onDetails}
        className="frontier-picked-army__main"
      >
        <span className="frontier-picked-army__portrait">
          {army.art ? (
            <HudPortrait icon={army.art} label={TROOPS} />
          ) : (
            <HudPortrait initial={String(army.number ?? "")} label={army.label} />
          )}
          <EtherealMark layer={army.ethereal} />
        </span>
        <span className="frontier-picked-army__body">
          <span className="frontier-picked-army__title">{title}</span>
          {army.stamina && (
            <span className="flex items-center text-hud-label text-hud-muted tabular-nums">
              <StaminaReading stamina={army.stamina} />
            </span>
          )}
          {army.drain && <DeepDrain drain={army.drain} words compact />}
        </span>
      </button>
      {(refill || spire) && (
        <span className="frontier-picked-army__actions">
          {refill}
          {spire}
        </span>
      )}
    </HudPanel>
  );
};
