import "./picked-army.css";

import { HudChip, HudIconButton, HudPanel, HudPortrait, HudStamina } from "@/ui/design-system/kit/hud-elements";
import { Icon } from "@/ui/design-system/icon";
import { CLOSE, PICKED_ARMY, STAMINA, TROOPS } from "@/ui/design-system/kit/words";
import { formatAmount, formatShort } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { DeepDrain, EtherealMark } from "./army-token";
import type { DockArmy } from "./dock-armies";

export type PickedArmyView = Pick<
  DockArmy,
  "explorerId" | "label" | "number" | "art" | "stamina" | "secondsToFull" | "troops" | "ethereal" | "drain"
>;

/**
 * The picked army's tray (Opus's army picked): its painting with its layer as a badge, its name, its troops, one smooth
 * stamina bar with what is left, its Oath sockets, and the one verb it has where it stands.
 */
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
}) => (
  <HudPanel collapsible={false} className="frontier-army-tray-panel pointer-events-auto" bodyClassName="army-tray">
    <div data-picked-army={army.label} className="army-tray__head">
      <button
        type="button"
        aria-label={PICKED_ARMY.details(army.label)}
        onClick={onDetails}
        className="army-tray__main"
      >
        <span className="army-tray__portrait">
          {army.art ? (
            <HudPortrait icon={army.art} label={TROOPS} />
          ) : (
            <HudPortrait initial={String(army.number ?? "")} label={army.label} />
          )}
          <EtherealMark layer={army.ethereal} />
        </span>
        <span className="army-tray__body">
          <span className="army-tray__name">{army.label}</span>
          {army.troops !== undefined && (
            <span className="army-tray__troops">
              <HudChip icons={army.art ? [army.art] : ["troops"]} label={TROOPS}>
                {formatShort(army.troops)}
              </HudChip>
            </span>
          )}
          {army.stamina && (
            <span className="army-tray__stamina">
              <Icon name="stamina" size={18} />
              <span className="army-tray__bar">
                <HudStamina stamina={army.stamina} />
              </span>
              <b aria-label={`${STAMINA} ${formatAmount(army.stamina.current)}`}>{formatAmount(army.stamina.current)}</b>
            </span>
          )}
          {army.drain && <DeepDrain drain={army.drain} words compact />}
        </span>
      </button>
      {onClose && <HudIconButton icon="close" label={CLOSE} kind="quiet" size="sm" onClick={onClose} />}
    </div>
    {(oaths || refill || spire) && (
      <div className="army-tray__foot">
        {oaths}
        <span className="army-tray__verbs">
          {refill}
          {spire}
        </span>
      </div>
    )}
  </HudPanel>
);
