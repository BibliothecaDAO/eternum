import "./fight-side.css";

import { formatCharge, formatExact, formatShort, type Troops } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { FIGHT_WORDS, fightLost, NONE_LOST } from "@/ui/design-system/kit/words";
import { CombatMark } from "./combat-mark";

import type { ReactNode } from "react";

export const AttackStamina = ({ stamina }: { stamina: number }) => (
  <span className="fight-attack-cost" data-attack-stamina={stamina}>
    · {formatCharge(stamina)}
    <SemanticIcon name="stamina" size={14} />
  </span>
);

export type Kept = number | undefined;

type FightArenaSide = {
  label: string;
  mark: ReactNode;
  heading?: ReactNode;
  category?: Troops["category"];
  hitsFirst?: boolean;
  before: number | undefined;
  kept: Kept;
};

const arenaSubtitle = ({ category, hitsFirst }: FightArenaSide) =>
  category || hitsFirst ? (
    <>
      {category && <CombatMark category={category} size={14} />}
      {hitsFirst && <span className="text-hud-gold">{`· ${FIGHT_WORDS.hitsFirst}`}</span>}
    </>
  ) : undefined;

export const FightArena = ({
  ours,
  theirs,
  outcome,
}: {
  ours?: FightArenaSide;
  theirs?: FightArenaSide;
  outcome?: ReactNode;
}) => {
  if (!ours && !theirs) return null;
  return (
    <div className="fight-arena">
      {ours && (
        <FightSide
          label={ours.label}
          mark={ours.mark}
          heading={ours.heading}
          subtitle={arenaSubtitle(ours)}
          before={ours.before}
          kept={ours.kept}
          side="ours"
        />
      )}
      <div className="fight-vs">
        <span className="fight-vs__word" aria-hidden="true">
          VS
        </span>
        {outcome}
      </div>
      {theirs && (
        <FightSide
          label={theirs.label}
          mark={theirs.mark}
          heading={theirs.heading}
          subtitle={arenaSubtitle(theirs)}
          before={theirs.before}
          kept={theirs.kept}
          side="theirs"
        />
      )}
    </div>
  );
};

export const FightSide = ({
  label,
  mark,
  heading,
  subtitle,
  before,
  kept,
  side,
}: {
  label: string;
  mark: ReactNode;
  heading?: ReactNode;
  subtitle?: ReactNode;
  before: number | undefined;
  kept: Kept;
  side: "ours" | "theirs";
}) => {
  const figures = fightFigures(before, kept);
  const title = heading ?? label;
  return (
    <span
      role="img"
      data-fight-side={side}
      aria-label={[`${label} ${formatExact(before)} → ${formatExact(kept)}`, figures.lost].filter(Boolean).join(", ")}
      className="flex min-w-0 flex-1 basis-0"
    >
      <HudPanel
        collapsible={false}
        className={cn("min-w-0 flex-1 fight-side", `fight-side--${side}`)}
        bodyClassName="fight-side__body [container-type:inline-size]"
      >
        {mark && (
          <span aria-hidden className="fight-side__portrait">
            {mark}
          </span>
        )}
        <span aria-hidden className={cn("fight-side__name", side === "ours" ? "text-hud-good" : "text-hud-bad")}>
          {title}
        </span>
        {subtitle && (
          <span aria-hidden className="fight-side__role">
            {subtitle}
          </span>
        )}
        <span aria-hidden className="fight-side__nums tabular-nums">
          <span
            className="whitespace-nowrap text-hud-label text-hud-muted"
            style={{ fontSize: fittedSize("label", `${figures.before} → ${figures.kept}`) }}
          >
            {figures.before} →
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-hud-title leading-none",
              kept === undefined ? "text-hud-muted" : kept === 0 ? "text-hud-bad" : "text-hud-ink",
            )}
            style={{ fontSize: fittedSize("title", figures.kept) }}
          >
            {figures.kept}
          </span>
        </span>
        <FightBar before={before} kept={kept} side={side} />
        {figures.lost && (
          <span
            aria-hidden
            className={cn(
              "max-w-full whitespace-nowrap text-hud-label tabular-nums",
              side === "ours" ? "text-hud-bad" : "text-hud-gold",
            )}
            style={{ fontSize: fittedSize("label", figures.lost) }}
          >
            {figures.lost}
          </span>
        )}
      </HudPanel>
    </span>
  );
};

const CHARACTER_EM = 0.62;

const fittedSize = (role: "label" | "body" | "title" | "display", line: string, beside = "0px"): string =>
  `min(var(--hud-text-${role}), calc((100cqi - ${beside}) / ${line.length * CHARACTER_EM}))`;

const SHORT_FROM = 10_000_000;

export const fightFigures = (
  before: number | undefined,
  kept: Kept,
): { before: string; kept: string; lost?: string } => {
  const known = [before, kept].filter((value): value is number => value !== undefined);
  const readsAlike = known.some((a) => known.some((b) => a !== b && formatShort(a) === formatShort(b)));
  const format = Math.max(0, ...known) < SHORT_FROM || readsAlike ? formatExact : formatShort;
  const write = (value: number | undefined) => (value === undefined ? formatExact(undefined) : format(value));
  const figures = { before: write(before), kept: write(kept) };
  if (before === undefined || kept === undefined) return figures;
  const lost = Math.max(0, before - kept);
  return { ...figures, lost: lost === 0 ? NONE_LOST : fightLost(format(lost), String(lostShare(before, kept))) };
};

const lostShare = (before: number, kept: number): number => {
  if (before <= 0 || kept >= before) return 0;
  if (kept <= 0) return 100;
  return Math.min(99, Math.max(1, Math.round(((before - kept) / before) * 100)));
};

const FightBar = ({ before, kept, side }: { before: number | undefined; kept: Kept; side: "ours" | "theirs" }) => {
  const share = before && before > 0 && kept !== undefined ? Math.max(0, Math.min(1, kept / before)) : 0;
  return (
    <span aria-hidden className="flex h-2 w-full overflow-hidden rounded-full bg-hud-well">
      {kept !== undefined && (
        <>
          <span
            className={cn("h-full", side === "ours" ? "bg-hud-good" : "bg-hud-bad")}
            style={{ width: `${share * 100}%` }}
          />
          <span className="h-full bg-hud-neutral" style={{ width: `${(1 - share) * 100}%` }} />
        </>
      )}
    </span>
  );
};
