import { formatAmount, formatDuration, formatExact, layerName, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { HudMeter, HudStamina, type StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { DEEP_WORDS, TROOPS } from "@/ui/design-system/kit/words";
import type { EtherealLayer } from "@bibliothecadao/eternum";
import type { DeepArmyLife } from "@bibliothecadao/eternum/game-client";

import { reachMark } from "../depth-art";

const TOKEN_FRAME = "relative flex w-14 shrink-0 flex-col items-center justify-start gap-1 rounded-xl py-1";

/** A token's portrait: the painting in its ring, as every token draws it. */
const Portrait = ({ art }: { art: IconMeaning | undefined }) => (
  <span className="block size-full overflow-hidden rounded-full border border-hud-line bg-hud-surface">
    {art && <SemanticIcon name={art} alt="" className="size-full object-cover" />}
  </span>
);

/**
 * A site's guard drawn as an army's token is (owner, 28 October 2026: "the 386 number for the troll should maybe be
 * shown like for the army"): its portrait, and its strength under it, where the card does not say it already.
 */
export const GuardToken = ({
  label,
  art,
  troops,
  tip,
}: {
  label: string;
  art: IconMeaning;
  /** Its strength; none where the card says it elsewhere (beside the army's, in the fight). */
  troops?: number;
  tip?: string;
}) => (
  <div
    role="img"
    aria-label={troops === undefined ? label : `${label} ${formatAmount(troops)}`}
    data-tip={tip}
    className={cn(TOKEN_FRAME, "border border-hud-line bg-hud-surface")}
  >
    <span className="relative size-10 shrink-0">
      <Portrait art={art} />
    </span>
    {troops !== undefined && (
      <span className="text-hud-body leading-none text-hud-ink tabular-nums">{formatAmount(troops)}</span>
    )}
  </div>
);

export const EtherealMark = ({ layer, at = "corner" }: { layer: EtherealLayer | undefined; at?: "corner" | "side" }) =>
  layer === undefined ? null : (
    <span
      role="img"
      aria-label={layerName(layer)}
      data-tip={layerName(layer)}
      className={cn(
        "absolute flex h-5 items-center gap-0.5 rounded-full border border-hud-line-strong bg-hud-dark pl-0.5 pr-1 text-hud-strong leading-none text-hud-ink",
        at === "corner" ? "-bottom-1.5 -left-2.5" : "-bottom-1 -right-2.5 pr-0.5",
      )}
    >
      <SemanticIcon name={reachMark(layer)} size={14} />
      {at === "corner" && layerName(layer)}
    </span>
  );

export const ArmyToken = ({
  label,
  number,
  art,
  stamina,
  troops,
  drain,
  ethereal,
  selected,
  flyTarget,
  onPick,
}: {
  label: string;
  /** What its Deep site costs it: its troops fall each tick. None while it holds none. */
  drain?: DeepArmyLife;
  /** The army's number among its realm's; absent where a token stands for no numbered army. */
  number?: number;
  /** The Ethereal layer it stands in; none on the surface. */
  ethereal?: EtherealLayer;
  art: IconMeaning | undefined;
  stamina: StaminaBar | undefined;
  troops: number | undefined;
  selected: boolean;
  /** Where a gain flies into the portrait. */
  flyTarget?: string;
  /** Absent on a visit: the token is shown, never picked. */
  onPick?: () => void;
}) => {
  const body = (
    <>
      <span data-fly-target={flyTarget} className="relative size-8 shrink-0">
        <Portrait art={art} />
        {number !== undefined && (
          <span className="absolute -left-2.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-hud-line-strong bg-hud-dark px-1 text-hud-strong leading-none text-hud-ink tabular-nums">
            {number}
          </span>
        )}
        <EtherealMark layer={ethereal} at="side" />
      </span>
      <TokenStamina stamina={stamina} />
      <span
        role="img"
        aria-label={`${TROOPS} ${formatAmount(troops)}`}
        className="text-hud-body leading-none text-hud-ink tabular-nums"
      >
        {formatAmount(troops)}
      </span>
      {drain && <DeepDrain drain={drain} />}
    </>
  );
  return onPick ? (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onPick}
      className={cn("ui-pick", TOKEN_LOOK)}
    >
      {body}
    </button>
  ) : (
    <div role="group" aria-label={label} data-selected={selected || undefined} className={cn("ui-pick", TOKEN_LOOK)}>
      {body}
    </div>
  );
};

/** A token's frame, an army's and an open slot's alike; the picked one wears the kit's chosen look (ui-pick). */
const TOKEN_LOOK = cn(TOKEN_FRAME, "border border-hud-line bg-hud-surface");

/**
 * An open army slot: a plus in a dashed ring that opens Deploy, and under it the stamina the slot starts its army on,
 * in the same segments an army's token carries, said in words when asked. The first one pulses while no army is out.
 */
export const OpenSlot = ({
  label,
  pulse,
  filling,
  start,
  stock,
  selected,
  onDeploy,
}: {
  label: string;
  pulse: boolean;
  /** Where the slot is one to pick (Deploy's), whether it is the one Deploy fills, picked as an army's token is. */
  selected?: boolean;
  /** An army is on its way into this slot, by the word that says so: the slot cannot be pressed until it is known. */
  filling?: string;
  /** The bar the slot starts its army on, and that in words ("Army 2 starts on 7/150 stamina…"); none while unknown. */
  start?: { bar: StaminaBar; words: string };
  stock?: { count: string; label: string };
  onDeploy: () => void;
}) => (
  <button
    type="button"
    aria-label={filling ?? label}
    aria-busy={filling !== undefined}
    aria-pressed={selected}
    disabled={filling !== undefined}
    data-tip={filling === undefined ? start?.words : undefined}
    onClick={onDeploy}
    className={cn("ui-pick", TOKEN_LOOK, "border-dashed")}
  >
    <SlotRing pulse={pulse} filling={filling} small />
    {start && filling === undefined && <TokenStamina stamina={start.bar} />}
    <span className="text-hud-label leading-none text-hud-muted">{filling ?? label}</span>
    {stock && filling === undefined && (
      <span role="img" aria-label={stock.label} className="text-hud-body leading-none text-hud-ink tabular-nums">
        {stock.count}
      </span>
    )}
  </button>
);

/** An open slot's dashed ring: a plus, "…" while an army is on its way into it. */
export const SlotRing = ({ pulse, filling, small = false }: { pulse: boolean; filling?: string; small?: boolean }) => (
  <span
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full text-hud-ink",
      small
        ? "size-6 border border-hud-line-strong bg-hud-dark text-hud-body"
        : "size-10 border-2 border-dashed border-hud-line text-hud-title",
      (pulse || filling !== undefined) && "animate-pulse border-hud-line-strong",
    )}
  >
    {filling === undefined ? "+" : "…"}
  </span>
);

/**
 * What a Deep guard's site costs it: its troops fall each tick, so the chip says how many ticks it holds and its bar
 * how much of the day those troops last for. On a desktop's row, where there is room, in words.
 */
export const DeepDrain = ({
  drain,
  words = false,
  compact = false,
}: {
  drain: DeepArmyLife;
  words?: boolean;
  compact?: boolean;
}) => {
  const loss = formatExact(Number(drain.lossPerTick) / RESOURCE_PRECISION);
  const time = formatDuration(drain.secondsLeft);
  const line = `${DEEP_WORDS.drain(loss)}; ${DEEP_WORDS.lasts(drain.ticksLeft, time)}`;
  const shown = compact
    ? DEEP_WORDS.drainShort(loss, drain.ticksLeft, time)
    : words
      ? line
      : formatExact(drain.ticksLeft);
  return (
    <span
      data-deep-drain
      role="img"
      aria-label={line}
      data-tip={words && !compact ? undefined : line}
      className="flex min-w-0 shrink-0 flex-col gap-0.5 self-stretch text-hud-label leading-none text-hud-bad tabular-nums"
    >
      <span className="flex min-w-0 items-center gap-1">
        <SemanticIcon name="flame" size={16} />
        <span className={cn(compact && "truncate whitespace-nowrap")}>{shown}</span>
      </span>
      <HudMeter label={line} tone="warn" share={drain.ticksInDay === 0 ? 0 : drain.ticksToEmpty / drain.ticksInDay} />
    </span>
  );
};

/**
 * A desktop row's stamina: the bar in segments, and its exact count beside it ("58/120") in a column wide enough for
 * "150/150", so a full bar and an emptier one end their bars at the same place.
 */
export const StaminaReading = ({ stamina }: { stamina: StaminaBar | undefined }) => (
  <span className="flex flex-1 items-center gap-2">
    <span className="min-w-8 flex-1">
      <HudStamina stamina={stamina} />
    </span>
    <span className="min-w-14 text-right">{`${formatAmount(stamina?.current)}/${formatAmount(stamina?.max)}`}</span>
  </span>
);

/** A token's stamina: the kit's bar, inset from the token's edge. */
const TokenStamina = ({ stamina }: { stamina: StaminaBar | undefined }) => (
  <span className="w-full px-1.5">
    <HudStamina stamina={stamina} />
  </span>
);
