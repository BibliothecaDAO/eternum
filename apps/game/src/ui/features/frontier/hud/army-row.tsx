import "./frontier-desktop.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPortrait, HudStamina, HudTier } from "@/ui/design-system/kit/hud-elements";
import {
  ARMIES,
  ARMY_SLOT_WORDS,
  DEPLOY,
  STAMINA,
  staminaReading,
  TROOPS,
  type Rank,
} from "@/ui/design-system/kit/words";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";

import type { EtherealLayer } from "@bibliothecadao/eternum";
import type { DeepArmyLife } from "@bibliothecadao/eternum/game-client";

import { DeepDrain, EtherealMark, OathWaitingBadge } from "./army-token";

export const ArmyCard = ({
  label,
  tier,
  number,
  art,
  drain,
  stamina,
  ethereal,
  selected,
  oathWaiting = false,
  onPick,
}: {
  label: string;
  tier?: Rank;
  number: number | undefined;
  drain?: DeepArmyLife;
  ethereal?: EtherealLayer;
  art: IconMeaning | undefined;
  stamina: StaminaBar | undefined;
  selected: boolean;
  oathWaiting?: boolean;
  onPick?: () => void;
}) => (
  <button
    type="button"
    className="ui-pick frontier-slot pointer-events-auto"
    data-slot-state="army"
    aria-label={label}
    aria-pressed={selected}
    data-oath-waiting={oathWaiting || undefined}
    disabled={!onPick}
    onClick={onPick}
  >
    <SlotNumber number={number} />
    <span className="frontier-slot__portrait">
      {oathWaiting && <OathWaitingBadge />}
      {art ? <HudPortrait icon={art} label={TROOPS} /> : <HudPortrait initial={String(number ?? "")} label={label} />}
      <EtherealMark layer={ethereal} />
    </span>
    <span className="frontier-slot__body">
      <span className="frontier-slot__line">
        <span className="frontier-slot__title">
          <span className="truncate">{label}</span>
          {tier !== undefined && tier > 1 && <HudTier tier={tier} />}
        </span>
        <StaminaFigure current={stamina?.current} max={stamina?.max} />
      </span>
      <HudStamina stamina={stamina} />
      {drain && <DeepDrain drain={drain} words compact />}
    </span>
  </button>
);

export const OpenSlotCard = ({
  number,
  primary,
  filling,
  start,
  stock,
  onDeploy,
}: {
  number: number | undefined;
  primary: boolean;
  filling?: string;
  start?: { bar: StaminaBar; words: string };
  stock?: { count: string; label: string };
  onDeploy: () => void;
}) => (
  <div className="frontier-slot" data-slot-state="open" data-tip={start?.words}>
    <SlotNumber number={number} />
    <span className="frontier-slot__body">
      <span className="frontier-slot__title">{number === undefined ? DEPLOY : ARMY_SLOT_WORDS.open(number)}</span>
      {stock ? (
        <span className="frontier-slot__detail" data-tone="good">
          {ARMY_SLOT_WORDS.readyAtHome(stock.label)}
        </span>
      ) : (
        start && <HudStamina stamina={start.bar} />
      )}
    </span>
    <HudButton
      kind={primary ? "primary" : "secondary"}
      size="sm"
      icon="plus"
      aria-label={DEPLOY}
      busy={filling}
      onClick={onDeploy}
    >
      {DEPLOY}
    </HudButton>
  </div>
);

export const LockedSlotLine = ({ number, rank }: { number: number; rank: string }) => (
  <p className="frontier-slots__locked">
    <Icon name="lock" size={14} />
    {ARMY_SLOT_WORDS.unlocksAt(number, rank)}
  </p>
);

export const ArmySlotsCard = ({ count, children }: { count?: string; children: ReactNode }) => (
  <section aria-label={ARMY_SLOT_WORDS.title} className="frontier-cluster-card frontier-slots pointer-events-auto">
    <header className="frontier-slots__head">
      <span className="frontier-slots__title">{ARMIES}</span>
      {count && <span className="frontier-slots__count">{count}</span>}
    </header>
    <nav aria-label={ARMIES} className="frontier-slots__list">
      {children}
    </nav>
  </section>
);

const SlotNumber = ({ number }: { number: number | undefined }) => (
  <span className="frontier-slot__number" aria-hidden="true">
    {number ?? "+"}
  </span>
);

const StaminaFigure = ({ current, max }: { current: number | undefined; max: number | undefined }) => (
  <span className="frontier-slot__figure tabular-nums">
    {staminaReading(current, max)}
    <Icon name="stamina" size={14} alt={STAMINA} />
  </span>
);
