import "./army-panel.css";

import { Icon } from "@/ui/design-system/icon";
import { HudPortrait, HudStamina } from "@/ui/design-system/kit/hud-elements";
import { ARMY_DETAIL, FULL_IN, STAMINA, TROOPS } from "@/ui/design-system/kit/words";
import { formatAmount, formatDuration } from "@bibliothecadao/types";

import { DeepDrain, EtherealMark } from "../hud/army-token";
import type { ArmyView } from "./army-detail";

export const ArmyDetail = ({ army }: { army: ArmyView }) => (
  <div data-army-step="stats" className="army-detail">
    <div className="army-detail__head">
      <span className="army-detail__portrait">
        <HudPortrait icon={army.art} label={TROOPS} />
        <EtherealMark layer={army.ethereal} />
      </span>
      <span className="army-detail__body">
        <span className="army-detail__row">
          <span role="img" aria-label={ARMY_DETAIL.troops(army.troops)} className="army-detail__troops tabular-nums">
            {formatAmount(army.troops)}
          </span>
          {army.secondsToFull !== undefined && army.secondsToFull > 0 && (
            <span className="army-detail__full">{`${FULL_IN} ${formatDuration(army.secondsToFull)}`}</span>
          )}
        </span>
        <span data-stamina-line className="army-detail__stamina">
          <Icon name="stamina" size={14} alt={STAMINA} />
          <HudStamina stamina={army.stamina} />
          <span className="army-detail__figure tabular-nums">
            {ARMY_DETAIL.stamina(army.stamina.current, army.stamina.max)}
          </span>
        </span>
      </span>
    </div>
    {army.drain && <DeepDrain drain={army.drain} words />}
  </div>
);
