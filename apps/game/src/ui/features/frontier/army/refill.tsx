import { formatCharge, formatExact, LORDS, formatShortChange } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPanel, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, REFILL, REFILLING, STAMINA, heldAgainstNeed, refillShort } from "@/ui/design-system/kit/words";

/**
 * Refill's control (wireframes 05, 08): the missing points as a LORDS price, one LORDS a point; when the realm holds
 * fewer LORDS, what it holds against the price takes the button's place, named Refill, its hover saying what it counts.
 */
export const RefillButton = ({
  price,
  held,
  refilling = false,
  onRefill,
}: {
  price: number;
  held: number | undefined;
  /** A refill of this army is in flight: sent, its outcome not known yet. */
  refilling?: boolean;
  onRefill: () => void;
}) =>
  held !== undefined && held < price ? (
    <span role="img" aria-label={refillShort(formatExact(held), formatCharge(price))} className="flex shrink-0">
      <HudPanel collapsible={false} bodyClassName="flex items-center gap-1.5">
        <SemanticIcon name="lords" size={18} />
        <span className="flex min-w-14 flex-col gap-1">
          <span className="text-hud-label text-hud-muted">{REFILL}</span>
          <span className="whitespace-nowrap text-hud-body tabular-nums text-hud-ink">
            {heldAgainstNeed(held, price)}
          </span>
          <HudMeter share={price > 0 ? held / price : 0} label={LORDS} />
        </span>
      </HudPanel>
    </span>
  ) : (
    <HudButton kind="secondary" icon="stamina" busy={refilling ? REFILLING : undefined} onClick={onRefill}>
      {REFILL}
    </HudButton>
  );

/**
 * Refill's confirm (wireframe 08): the bar now → full, the realm's LORDS before → after, then Cancel and Refill with its
 * price. A full refill only.
 */
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
  onRefill: () => void;
  onCancel: () => void;
}) => {
  const price = Math.max(0, stamina.max - stamina.current);
  return (
    <HudSheet label={REFILL} onClose={onCancel}>
      <div className="flex items-center justify-center gap-2">
        <HudChip icons={["stamina"]} label={STAMINA}>
          {formatShortChange(stamina.current, stamina.max)}
        </HudChip>
        <HudChip icons={["lords"]} label={LORDS}>
          {formatShortChange(held, held === undefined ? undefined : held - price)}
        </HudChip>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <HudButton kind="quiet" onClick={onCancel}>
          {CANCEL}
        </HudButton>
        <span className="col-span-2 grid">
          <HudButton kind="primary" busy={sending ? REFILLING : undefined} onClick={onRefill}>
            {REFILL}
          </HudButton>
        </span>
      </div>
    </HudSheet>
  );
};
