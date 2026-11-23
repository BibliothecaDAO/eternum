import "./frontier-bar.css";

import { type IconMeaning } from "@/ui/design-system/icon";
import { HudPortrait, HudTier } from "@/ui/design-system/kit/hud-elements";
import { ARMIES, ARMY_MOVE_HINT, TROOPS, type Rank } from "@/ui/design-system/kit/words";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";

import type { EtherealLayer } from "@bibliothecadao/eternum";
import type { DeepArmyLife } from "@bibliothecadao/eternum/game-client";

import { DeepDrain, EtherealMark, SlotRing, StaminaReading } from "./army-token";

export const ArmyCard = ({
  label,
  title,
  tier,
  number,
  art,
  drain,
  stamina,
  ethereal,
  selected,
  onPick,
}: {
  label: string;
  title?: string;
  tier?: Rank;
  number: number | undefined;
  drain?: DeepArmyLife;
  ethereal?: EtherealLayer;
  art: IconMeaning | undefined;
  stamina: StaminaBar | undefined;
  selected: boolean;
  onPick?: () => void;
}) => (
  <button
    type="button"
    className="ui-pick frontier-army-card pointer-events-auto"
    aria-label={label}
    aria-pressed={selected}
    disabled={!onPick}
    onClick={onPick}
  >
    <span className="frontier-army-card__portrait">
      {art ? <HudPortrait icon={art} label={TROOPS} /> : <HudPortrait initial={String(number ?? "")} label={label} />}
      <EtherealMark layer={ethereal} />
    </span>
    <span className="frontier-army-card__body">
      <span className="frontier-army-card__title">
        <span className="truncate">{title ?? label}</span>
        {tier !== undefined && tier > 1 && <HudTier tier={tier} />}
      </span>
      <span className="frontier-army-card__stamina">
        <StaminaReading stamina={stamina} />
        {drain && <DeepDrain drain={drain} words compact />}
      </span>
      {selected && <span className="frontier-army-card__hint">{ARMY_MOVE_HINT}</span>}
    </span>
  </button>
);

export const OpenSlotCard = ({
  label,
  pulse,
  filling,
  start,
  selected,
  onDeploy,
}: {
  label: string;
  pulse: boolean;
  filling?: string;
  start?: { bar: StaminaBar; words: string };
  selected?: boolean;
  onDeploy: () => void;
}) => (
  <button
    type="button"
    className="ui-pick frontier-army-card pointer-events-auto"
    data-open-slot="true"
    aria-label={filling ?? label}
    aria-pressed={selected}
    disabled={filling !== undefined}
    aria-busy={filling !== undefined}
    data-tip={filling === undefined ? start?.words : undefined}
    onClick={onDeploy}
  >
    <SlotRing pulse={pulse} filling={filling} />
    <span className="frontier-army-card__body">
      <span className="frontier-army-card__title">{filling ?? label}</span>
      {start && filling === undefined && (
        <span className="frontier-army-card__stamina">
          <StaminaReading stamina={start.bar} />
        </span>
      )}
    </span>
  </button>
);

export const ArmyCardDock = ({ children }: { children: ReactNode }) => (
  <nav aria-label={ARMIES} className="frontier-army-dock pointer-events-auto">
    {children}
  </nav>
);
