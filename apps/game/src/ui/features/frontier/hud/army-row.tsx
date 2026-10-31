import { formatAmount } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudPanel, HudPortrait, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ARMIES, TROOPS, troopCount, UPGRADE, XP } from "@/ui/design-system/kit/words";
import type { StaminaBar } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";

import { HomecomingReturn, SlotRing, StaminaReading, xpLine, type XpGoal } from "./army-token";

/**
 * One army on a desktop's list: its painting with its number; its name with its XP beside it (what it buys next on
 * hover) and, in the day's last hour, what its Homecoming sends home; under them its troops and its stamina as a bar with
 * the exact count; at its end, while its XP buys a level now, the card fan. A press picks the army and opens its panel,
 * where its levels are bought. The desktop's form of the dock's token; a phone keeps the token. Read-only on a visit.
 */
export const ArmyRow = ({
  label,
  number,
  art,
  troops,
  returnsHome,
  stamina,
  xp,
  xpGoal,
  canSpendSkillPoint,
  selected,
  flyTarget,
  onPick,
}: {
  label: string;
  number: number | undefined;
  art: IconMeaning | undefined;
  troops: number | undefined;
  /** In the day's last hour, the troops its Homecoming sends home when the day ends; none otherwise. */
  returnsHome?: number;
  stamina: StaminaBar | undefined;
  xp: number | undefined;
  xpGoal?: XpGoal;
  canSpendSkillPoint: boolean;
  selected: boolean;
  /** Where a gain flies into the portrait. */
  flyTarget?: string;
  /** Absent on a visit: the row is shown, never picked. */
  onPick?: () => void;
}) => (
  <HudRow
    lead={
      <span data-fly-target={flyTarget} className="relative shrink-0">
        {art ? <HudPortrait icon={art} label={TROOPS} /> : <HudPortrait initial={String(number ?? "")} label={label} />}
        {number !== undefined && (
          <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-hud-line-strong bg-hud-dark px-1 text-hud-strong leading-none text-hud-ink tabular-nums">
            {number}
          </span>
        )}
      </span>
    }
    label={label}
    title={
      <RowLine
        words={label}
        figure={<span data-tip={xpLine(xp, xpGoal)} className="text-hud-gold">{`${formatAmount(xp)} ${XP}`}</span>}
      />
    }
    // The troops line is figures throughout, set as the HUD sets figures.
    detail={
      <span className="flex flex-col gap-1 tabular-nums">
        <RowLine words={troops === undefined ? "—" : troopCount(troops)} figure={<RowStamina stamina={stamina} />} />
        {returnsHome !== undefined && <HomecomingReturn troops={returnsHome} words />}
      </span>
    }
    // The trail is the card fan while a level is affordable now: the row itself opens the panel that buys it.
    trail={<RowTrail>{canSpendSkillPoint && <SemanticIcon name="picks" size={20} data-tip={UPGRADE} />}</RowTrail>}
    selected={selected}
    onClick={onPick}
  />
);

/**
 * An open slot on a desktop's list, as a row like an army's: its dashed ring, Deploy (or the word for an army on its way), and the stamina the slot starts its army on. A press chooses that slot for Deploy. A phone's dock draws the same slot as a token (OpenSlot).
 */
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
  /** The slot Deploy fills, chosen as an army's row is. */
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

/**
 * A line of a list row: its words, and at its end the figure they own. A figure stands on its words' line, so a row of
 * one line (an open slot) keeps its name beside its stamina, not above it (owner, 28 October: "text alignment with no
 * troop line subtext").
 */
const RowLine = ({ words, figure }: { words: string; figure: ReactNode }) => (
  <span className="flex items-center gap-2 whitespace-nowrap">
    <span className="min-w-0 flex-1 truncate">{words}</span>
    <span className="flex shrink-0 items-center gap-2 tabular-nums">{figure}</span>
  </span>
);

/**
 * A row's stamina, in the row's small words on whichever line it stands, one column as wide on every row, so every bar
 * on the list starts at one x and is as long (owner, 27 October).
 */
const RowStamina = ({ stamina }: { stamina: StaminaBar | undefined }) => (
  <span className="flex w-28 text-hud-label text-hud-muted">
    <StaminaReading stamina={stamina} />
  </span>
);

/** A list row's trail, the same place on every row whether it holds the card fan or nothing. */
const RowTrail = ({ children }: { children?: ReactNode }) => (
  <span className="flex size-5 items-center justify-center">{children}</span>
);

/**
 * A desktop's armies: the list's panel, its rows and Deploy inside, with how many of the day's slots stand. The rows
 * stand in the Armies navigation a phone's dock is, so the same reads find them.
 */
export const ArmyList = ({ used, allowed, children }: { used: number; allowed: number; children: ReactNode }) => (
  <HudPanel
    title={ARMIES}
    cue={<span className="text-hud-label tabular-nums text-hud-muted">{`${used}/${allowed}`}</span>}
    collapsible={false}
    className="pointer-events-auto"
  >
    <nav aria-label={ARMIES} className="flex flex-col gap-1">
      {children}
    </nav>
  </HudPanel>
);
