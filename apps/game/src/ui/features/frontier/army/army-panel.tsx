import "./army-panel.css";

import { Icon } from "@/ui/design-system/icon";
import { HudPortrait, HudStamina } from "@/ui/design-system/kit/hud-elements";
import { FULL_IN, STAMINA, staminaReading, TROOPS } from "@/ui/design-system/kit/words";
import { formatDuration, FRONTIER_TROOP_NAMES } from "@bibliothecadao/types";

import { BaneFigure, BaneLine } from "../day/bane-mark";
import { DeepDrain, EtherealMark } from "../hud/army-token";
import { CombatMarkBadge } from "../sites/combat-mark";
import { TroopTraitStrip } from "../troops/troop-traits-card";
import { UnitDetailsTrigger } from "../troops/unit-details-popover";
import type { ArmyView } from "./army-detail";

export const ArmyDetail = ({ army }: { army: ArmyView }) => {
  const portrait = (
    <span className="army-detail__portrait">
      <HudPortrait icon={army.art} label={TROOPS} />
      {army.category && <CombatMarkBadge category={army.category} />}
      <EtherealMark layer={army.ethereal} />
    </span>
  );
  return (
    <div data-army-step="stats" className="army-detail">
      <div className="army-detail__head">
        {army.category ? (
          <UnitDetailsTrigger
            subject={{
              role: "player",
              name: FRONTIER_TROOP_NAMES[army.category].many,
              art: army.art,
              category: army.category,
              strength: army.troops,
              figures: army.figures,
              staminaCosts: army.staminaCosts,
            }}
          >
            {portrait}
          </UnitDetailsTrigger>
        ) : (
          portrait
        )}
        <span className="army-detail__body">
          {(army.category && army.figures) || (army.secondsToFull !== undefined && army.secondsToFull > 0) ? (
            <span className="army-detail__row">
              {army.category && army.figures && <TroopTraitStrip category={army.category} figures={army.figures} />}
              {army.secondsToFull !== undefined && army.secondsToFull > 0 && (
                <span className="army-detail__full">
                  <BaneFigure figure="stamina">{`${FULL_IN} ${formatDuration(army.secondsToFull)}`}</BaneFigure>
                </span>
              )}
            </span>
          ) : null}
          <span data-stamina-line className="army-detail__stamina">
            <Icon name="stamina" size={14} alt={STAMINA} />
            <HudStamina stamina={army.stamina} />
            <span className="army-detail__figure tabular-nums">
              <BaneFigure figure="stamina" altered={army.stamina.current < army.stamina.max}>
                {staminaReading(army.stamina.current, army.stamina.max)}
              </BaneFigure>
            </span>
          </span>
        </span>
      </div>
      <BaneLine figure="stamina" />
      {army.drain && <DeepDrain drain={army.drain} words />}
    </div>
  );
};
