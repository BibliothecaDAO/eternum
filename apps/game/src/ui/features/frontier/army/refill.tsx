import { useState } from "react";
import { nativeFragmentConstants } from "@bibliothecadao/eternum/game-client";
import { formatCount, formatHeldAgainst, formatShortChange, FRAGMENT, FRAGMENTS } from "@bibliothecadao/types";
import { HudButton, HudChip, HudSheet, HudSlider } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, needsHave, REFILL, REFILLING, STAMINA } from "@/ui/design-system/kit/words";

const POINTS = nativeFragmentConstants.STAMINA_PER_FRAGMENT;

export const fragmentsToFill = (stamina: { current: number; max: number }): number =>
  Math.max(0, Math.ceil((stamina.max - stamina.current) / POINTS));

const refillOutOfReach = (held: number | undefined): boolean => held === undefined || held < 1;

export const RefillButton = ({
  held,
  refilling = false,
  onRefill,
}: {
  held: number | undefined;
  refilling?: boolean;
  onRefill: () => void;
}) => (
  <HudButton
    kind="secondary"
    icon="stamina"
    disabled={refillOutOfReach(held)}
    busy={refilling ? REFILLING : undefined}
    onClick={onRefill}
  >
    {REFILL}
  </HudButton>
);

export const RefillPrice = ({
  price,
  held,
  refilling = false,
  onRefill,
}: {
  price: number;
  held: number | undefined;
  refilling?: boolean;
  onRefill: () => void;
}) => {
  const short = refillOutOfReach(held);
  const pair = formatHeldAgainst(held, price);
  const holds = needsHave(pair.need, FRAGMENTS, pair.held);
  return (
    <HudButton
      kind="secondary"
      icon="fragment"
      tone={short ? "bad" : undefined}
      disabled={short}
      busy={refilling ? REFILLING : undefined}
      title={short ? holds : undefined}
      aria-label={`${REFILL} ${STAMINA} · ${formatCount(price, FRAGMENT, FRAGMENTS)}${short ? ` · ${holds}` : ""}`}
      onClick={onRefill}
    >
      <span className="flex flex-col items-start text-hud-label leading-tight">
        <span>{REFILL}</span>
        <span className="tabular-nums">{formatCount(price, FRAGMENT, FRAGMENTS)}</span>
      </span>
    </HudButton>
  );
};

export const RefillConfirm = ({
  stamina,
  held,
  sending,
  onRefill,
  onCancel,
}: {
  stamina: { current: number; max: number };
  held: number | undefined;
  sending: boolean;
  onRefill: (fragments: number) => void;
  onCancel: () => void;
}) => {
  const needed = fragmentsToFill(stamina);
  const affordable = Math.min(needed, Math.max(0, Math.floor(held ?? 0)));
  const [selected, setSelected] = useState(affordable);
  const fragments = Math.min(selected, affordable);
  const after = Math.min(stamina.max, stamina.current + fragments * POINTS);
  return (
    <HudSheet label={REFILL} onClose={onCancel}>
      <div className="flex items-center justify-center gap-2">
        <HudChip icons={["stamina"]} label={STAMINA}>
          {formatShortChange(stamina.current, after)}
        </HudChip>
        <HudChip icons={["fragment"]} label={FRAGMENTS}>
          {formatShortChange(held, held === undefined ? undefined : held - fragments)}
        </HudChip>
      </div>
      <HudSlider
        label={FRAGMENTS}
        value={fragments}
        min={0}
        max={needed}
        stop={affordable}
        disabled={sending || affordable === 0}
        onChange={setSelected}
      />
      <div className="grid grid-cols-3 gap-2">
        <HudButton kind="quiet" onClick={onCancel}>
          {CANCEL}
        </HudButton>
        <span className="col-span-2 grid">
          <HudButton
            kind="primary"
            disabled={fragments <= 0 || held === undefined}
            busy={sending ? REFILLING : undefined}
            onClick={() => onRefill(fragments)}
          >
            {REFILL} · {formatCount(fragments, FRAGMENT, FRAGMENTS)}
          </HudButton>
        </span>
      </div>
    </HudSheet>
  );
};
