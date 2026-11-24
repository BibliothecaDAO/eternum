import "./phone-hud.css";

import { HudIconButton, HudPanel, HudPortrait } from "@/ui/design-system/kit/hud-elements";
import { CLOSE, PICKED_ARMY, TROOPS } from "@/ui/design-system/kit/words";
import { frontierTroopName } from "@bibliothecadao/types";
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
  oaths,
  refill,
  spire,
  onDetails,
  onClose,
}: {
  army: PickedArmyView;
  oaths?: ReactNode;
  refill: ReactNode;
  spire?: ReactNode;
  onDetails: () => void;
  onClose?: () => void;
}) => {
  const category = army.troopsFact?.category;
  const title = PICKED_ARMY.title(army.label, army.troops, (category && frontierTroopName(category)) || undefined);
  return (
    <HudPanel
      collapsible={false}
      className="frontier-army-tray-panel pointer-events-auto"
      bodyClassName="frontier-army-tray"
    >
      <div className="frontier-army-tray__head">
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
        {onClose && <HudIconButton icon="close" label={CLOSE} kind="quiet" size="sm" onClick={onClose} />}
      </div>
      {(oaths || refill || spire) && (
        <div className="frontier-army-tray__actions">
          {oaths}
          <span className="frontier-army-tray__verbs">
            {refill}
            {spire}
          </span>
        </div>
      )}
    </HudPanel>
  );
};
