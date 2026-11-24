import { DeepDrain, EtherealMark } from "../hud/army-token";
import { formatExact, formatShort } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";
import "./army-panel.css";

import { HudPortrait, HudStamina } from "@/ui/design-system/kit/hud-elements";
import { ARMY_DETAIL, TROOPS } from "@/ui/design-system/kit/words";
import { FullIn } from "../full-in";
import type { ArmyView } from "./army-detail";

export const ArmyDetail = ({ army }: { army: ArmyView }) => (
  <div data-army-step="stats" className="army-detail">
    <div className="army-detail__head">
      <span className="relative shrink-0">
        <HudPortrait icon={army.art} label={TROOPS} />
        <EtherealMark layer={army.ethereal} />
      </span>
      <span className="army-detail__who">
        <span className="army-detail__title">{army.title ?? army.name}</span>
        <span className="army-detail__sub">
          <span>{ARMY_DETAIL.troops(army.troops)}</span>
          {army.revealYield !== null && (
            <span
              role="img"
              aria-label={`${ARMY_DETAIL.revealPaysLabel} ${army.revealYield === undefined ? "—" : ARMY_DETAIL.revealPays(formatShort(army.revealYield))}`}
              className="inline-flex items-center gap-1"
            >
              <span aria-hidden="true">·</span>
              <Icon name="essence" size={14} />
              <Icon name="labor" size={14} />
              {army.revealYield === undefined ? "—" : ARMY_DETAIL.revealPays(formatShort(army.revealYield))}
            </span>
          )}
        </span>
      </span>
    </div>
    <StaminaBlock stamina={army.stamina} secondsToFull={army.secondsToFull} />
    {army.drain && <DeepDrain drain={army.drain} words />}
  </div>
);

const StaminaBlock = ({ stamina, secondsToFull }: Pick<ArmyView, "stamina" | "secondsToFull">) => (
  <div data-stamina-line className="army-detail__stamina">
    <span className="army-detail__row">
      <span className="army-detail__label">{ARMY_DETAIL.stamina}</span>
      <span className="army-detail__figure tabular-nums">
        {`${formatExact(stamina.current)}/${formatExact(stamina.max)}`}
        <Icon name="stamina" size={14} />
        {secondsToFull !== undefined && secondsToFull > 0 && <FullIn seconds={secondsToFull} />}
      </span>
    </span>
    <HudStamina stamina={stamina} />
  </div>
);
