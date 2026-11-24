import "./frontier-desktop.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPortrait, HudStamina, HudTier } from "@/ui/design-system/kit/hud-elements";
import {
  ARMIES,
  ARMY_MOVE_HINT,
  ARMY_SLOT_WORDS,
  DEPLOY,
  STAMINA,
  TROOPS,
  type Rank,
} from "@/ui/design-system/kit/words";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { formatAmount } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import type { EtherealLayer } from "@bibliothecadao/eternum";
import type { DeepArmyLife } from "@bibliothecadao/eternum/game-client";

import { DeepDrain, EtherealMark } from "./army-token";

export const ArmyCard = ({
  label,
  title,
  tier,
  number,
  art,
  troops,
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
  troops?: number;
  stamina: StaminaBar | undefined;
  selected: boolean;
  onPick?: () => void;
}) => (
  <button
    type="button"
    className="ui-pick frontier-slot pointer-events-auto"
    data-slot-state="army"
    aria-label={label}
    aria-pressed={selected}
    disabled={!onPick}
    onClick={onPick}
  >
    <SlotNumber number={number} />
    <span className="frontier-slot__portrait">
      {art ? <HudPortrait icon={art} label={TROOPS} /> : <HudPortrait initial={String(number ?? "")} label={label} />}
      <EtherealMark layer={ethereal} />
    </span>
    <span className="frontier-slot__body">
      <span className="frontier-slot__line">
        <span className="frontier-slot__title">
          <span className="truncate">
            {troops === undefined ? (title ?? label) : `${title ?? label} · ${formatAmount(troops)}`}
          </span>
          {tier !== undefined && tier > 1 && <HudTier tier={tier} />}
        </span>
        <StaminaFigure current={stamina?.current} max={stamina?.max} />
      </span>
      <HudStamina stamina={stamina} />
      {drain && <DeepDrain drain={drain} words compact />}
      {selected && <span className="frontier-slot__detail">{ARMY_MOVE_HINT}</span>}
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
        start && (
          <span className="frontier-slot__detail">
            {`${ARMY_SLOT_WORDS.anyTroop} · ${formatAmount(start.bar.current)}`}
            <Icon name="stamina" size={14} alt={STAMINA} />
          </span>
        )
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

export const LockedSlotCard = ({ number, rank }: { number: number; rank: string }) => (
  <div className="frontier-slot" data-slot-state="locked">
    <SlotNumber number={number} />
    <Icon name="lock" size={16} />
    <span className="frontier-slot__detail">{ARMY_SLOT_WORDS.unlocksAt(number, rank)}</span>
  </div>
);

export const ArmySlotsCard = ({ count, children }: { count?: string; children: ReactNode }) => (
  <section aria-label={ARMY_SLOT_WORDS.title} className="frontier-cluster-card frontier-slots pointer-events-auto">
    <header className="frontier-slots__head">
      <span className="frontier-slots__title">{ARMY_SLOT_WORDS.title}</span>
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
    {`${formatAmount(current)}/${formatAmount(max)}`}
    <Icon name="stamina" size={14} alt={STAMINA} />
  </span>
);
