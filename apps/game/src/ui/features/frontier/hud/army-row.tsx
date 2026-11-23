import "./frontier-bar.css";

import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudPortrait, HudRow, HudTier } from "@/ui/design-system/kit/hud-elements";
import { ARMIES, MOVE, TROOPS, type Rank } from "@/ui/design-system/kit/words";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";

import type { EtherealLayer } from "@bibliothecadao/eternum";
import type { DeepArmyLife } from "@bibliothecadao/eternum/game-client";

import { DeepDrain, EtherealMark, SlotRing, StaminaReading } from "./army-token";

export const OpenSlotRow = ({
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
  <HudRow
    lead={<SlotRing pulse={pulse} filling={filling} />}
    label={filling ?? label}
    title={
      <RowLine words={filling ?? label} figure={start && filling === undefined && <RowStamina stamina={start.bar} />} />
    }
    trail={<RowTrail />}
    selected={selected}
    disabled={filling !== undefined}
    busy={filling !== undefined}
    tip={filling === undefined ? start?.words : undefined}
    onClick={onDeploy}
  />
);

const RowLine = ({ words, figure }: { words: string; figure: ReactNode }) => (
  <span className="flex items-center gap-2 whitespace-nowrap">
    <span className="min-w-0 flex-1 truncate">{words}</span>
    <span className="flex shrink-0 items-center gap-2 tabular-nums">{figure}</span>
  </span>
);

const RowStamina = ({ stamina }: { stamina: StaminaBar | undefined }) => (
  <span className="flex w-28 text-hud-label text-hud-muted">
    <StaminaReading stamina={stamina} />
  </span>
);

const RowTrail = ({ children }: { children?: ReactNode }) => (
  <span className="flex size-5 items-center justify-center">{children}</span>
);

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
    <span className="relative mb-1.5 shrink-0">
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
    </span>
    {selected && (
      <span className="frontier-army-card__move">
        <SemanticIcon name="explore" size={14} />
        {MOVE}
      </span>
    )}
  </button>
);

export const OpenSlotCard = ({
  label,
  pulse,
  filling,
  start,
  onDeploy,
}: {
  label: string;
  pulse: boolean;
  filling?: string;
  start?: { bar: StaminaBar; words: string };
  onDeploy: () => void;
}) => (
  <button
    type="button"
    className="frontier-army-card pointer-events-auto"
    data-open-slot="true"
    aria-label={filling ?? label}
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
