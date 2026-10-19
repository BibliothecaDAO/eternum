import { formatAmount } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { HudIconButton, HudMeter, HudPanel, HudPortrait, HudRow } from "@/ui/design-system/kit/hud-elements";
import { ARMIES, STAMINA, TROOPS, troopCount, UPGRADE, XP } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { xpLine, type XpGoal } from "./army-token";

/**
 * One army on a desktop's list: its painting with its number; its name with its XP beside it (what it buys next on
 * hover); under them its troops and its stamina as a bar with the exact count; at its end, while its XP buys a tier now,
 * Upgrade, which opens the army's sheet to choose the attribute and buy it. The desktop's form of the dock's token; a
 * phone keeps the token. Read-only on a visit, where a tier shows as the card fan alone.
 */
export const ArmyRow = ({
  label,
  number,
  art,
  troops,
  stamina,
  xp,
  xpGoal,
  canBuyTier,
  selected,
  flyTarget,
  onPick,
  onUpgrade,
}: {
  label: string;
  number: number | undefined;
  art: IconMeaning | undefined;
  troops: number | undefined;
  stamina: { current: number; max: number } | undefined;
  xp: number | undefined;
  xpGoal?: XpGoal;
  canBuyTier: boolean;
  selected: boolean;
  /** Where a gain flies into the portrait. */
  flyTarget?: string;
  /** Absent on a visit: the row is shown, never picked. */
  onPick?: () => void;
  /** The army's sheet, where its XP buys a tier; absent on a visit. */
  onUpgrade?: () => void;
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
      <span className="flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        <span data-tip={xpLine(xp, xpGoal)} className="flex shrink-0 items-center gap-1 tabular-nums text-hud-gold">
          {`${formatAmount(xp)} ${XP}`}
        </span>
      </span>
    }
    detail={
      <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
        <span>{troops === undefined ? "—" : troopCount(troops)}</span>
        <span className="flex flex-1 items-center gap-2">
          <span className="min-w-8 flex-1">
            <HudMeter amount={stamina} tone="good" label={STAMINA} />
          </span>
          <span>{`${formatAmount(stamina?.current)}/${formatAmount(stamina?.max)}`}</span>
        </span>
      </span>
    }
    // The trail keeps the row a pressed toggle, as the phone's token is (the same reads find a picked army): Upgrade
    // while a tier is affordable now (the card fan alone on a visit), else nothing.
    trail={canBuyTier ? <UpgradeTrail label={label} onUpgrade={onUpgrade} /> : null}
    selected={selected}
    onClick={onPick}
  />
);

/**
 * Upgrade, the way to the army's sheet while its XP buys a tier: the card fan as a button, as narrow as the fan was, so
 * the row's figures keep their room; the fan alone where it cannot be pressed.
 */
const UpgradeTrail = ({ label, onUpgrade }: { label: string; onUpgrade?: () => void }) =>
  onUpgrade ? (
    <HudIconButton icon="picks" label={`${UPGRADE} ${label}`} data-tip={UPGRADE} size="sm" onClick={onUpgrade} />
  ) : (
    <SemanticIcon name="picks" size={20} />
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
