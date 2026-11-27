import "./fight-side.css";

import { formatCharge, formatExact, formatShort, type TroopType } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { FIGHT_WORDS, fightLost, NONE_LOST } from "@/ui/design-system/kit/words";

import type { ReactNode } from "react";

import type { BaneFigure as BaneKind } from "../day/bane-face";
import { BaneFigure } from "../day/bane-mark";
import { UnitDetailsTrigger, type UnitDetailsSubject } from "../troops/unit-details-popover";
import { BeastMarkBadge, CombatMarkBadge } from "./combat-mark";

export const AttackStamina = ({ stamina }: { stamina: number }) => (
  <span className="fight-attack-cost" data-attack-stamina={stamina}>
    <SemanticIcon name="stamina" size={16} />
    {formatCharge(stamina)}
  </span>
);

export type Kept = number | undefined;

type FightArenaSide = {
  label: string;
  mark: ReactNode;
  before: number | undefined;
  kept: Kept;
  bane?: BaneKind;
  combatCategory?: TroopType;
  beastMark?: boolean;
  cornerBadge?: ReactNode;
  details?: UnitDetailsSubject;
};

export const FightArena = ({ ours, theirs }: { ours?: FightArenaSide; theirs?: FightArenaSide }) => {
  if (!ours && !theirs) return null;
  return (
    <div className="fight-arena">
      {ours && <FightSide {...ours} side="ours" />}
      <span className="fight-vs" aria-hidden="true">
        VS
      </span>
      {theirs && <FightSide {...theirs} side="theirs" />}
    </div>
  );
};

export const FightSide = ({
  label,
  mark,
  before,
  kept,
  bane,
  combatCategory,
  beastMark,
  cornerBadge,
  details,
  side,
}: FightArenaSide & { side: "ours" | "theirs" }) => {
  const figures = fightFigures(before, kept);
  const spoken = [`${label} ${formatExact(before)} → ${formatExact(kept)}`, figures.lost].filter(Boolean).join(", ");
  const defeated = kept === 0;
  const portrait = mark && (
    <span className="fight-side__portrait">
      <span aria-hidden className="fight-side__portrait-frame">
        {mark}
      </span>
      {cornerBadge}
      {combatCategory &&
        (beastMark ? <BeastMarkBadge category={combatCategory} /> : <CombatMarkBadge category={combatCategory} />)}
    </span>
  );
  return (
    <span
      role="img"
      data-fight-side={side}
      aria-label={spoken}
      data-tip={spoken}
      className={cn("fight-side", `fight-side--${side}`, defeated && "fight-side--gone")}
    >
      {portrait &&
        (details ? (
          <UnitDetailsTrigger subject={details} openOnClick>
            {portrait}
          </UnitDetailsTrigger>
        ) : (
          portrait
        ))}
      <b aria-hidden className="fight-side__nums">
        {bane ? <BaneFigure figure={bane}>{figures.before}</BaneFigure> : figures.before}{" "}
        <span className="fight-side__arrow">→</span> {figures.kept}
      </b>
      {figures.taken && (
        <span aria-hidden className="fight-side__taken" data-tone={!defeated && side === "theirs" ? "good" : "bad"}>
          {defeated ? FIGHT_WORDS.defeated : figures.taken}
        </span>
      )}
    </span>
  );
};

const SHORT_FROM = 10_000_000;

export const fightFigures = (
  before: number | undefined,
  kept: Kept,
): { before: string; kept: string; taken?: string; lost?: string } => {
  const known = [before, kept].filter((value): value is number => value !== undefined);
  const readsAlike = known.some((a) => known.some((b) => a !== b && formatShort(a) === formatShort(b)));
  const format = Math.max(0, ...known) < SHORT_FROM || readsAlike ? formatExact : formatShort;
  const write = (value: number | undefined) => (value === undefined ? formatExact(undefined) : format(value));
  const figures = { before: write(before), kept: write(kept) };
  if (before === undefined || kept === undefined) return figures;
  const lost = Math.max(0, before - kept);
  if (lost === 0) return { ...figures, taken: NONE_LOST, lost: NONE_LOST };
  return { ...figures, taken: `−${format(lost)}`, lost: fightLost(format(lost), String(lostShare(before, kept))) };
};

const lostShare = (before: number, kept: number): number => {
  if (before <= 0 || kept >= before) return 0;
  if (kept <= 0) return 100;
  return Math.min(99, Math.max(1, Math.round(((before - kept) / before) * 100)));
};
