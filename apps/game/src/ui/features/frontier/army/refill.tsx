import { formatCharge, formatExact, formatShort, LORDS, formatShortChange } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, REFILL, REFILLING, STAMINA, heldAgainstNeed, refillShort } from "@/ui/design-system/kit/words";

/**
 * Refill's control (wireframes 05, 08): the missing points as a LORDS price, one LORDS a point; when the realm holds
 * fewer LORDS, what it holds against the price takes the button's place in two lines, "Refill" over "40 / 150", its
 * hover saying what the two numbers count. The order bar's; the army card's is the chip below.
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
    <span
      role="img"
      aria-label={refillShort(formatExact(held), formatCharge(price))}
      className="flex shrink-0 items-center gap-1.5"
    >
      <SemanticIcon name="lords" size={18} />
      <span className="flex flex-col whitespace-nowrap">
        <span className="text-hud-label text-hud-muted">{REFILL}</span>
        <span className="text-hud-body tabular-nums text-hud-ink">{heldAgainstNeed(held, price)}</span>
      </span>
    </span>
  ) : (
    <HudButton kind="secondary" icon="stamina" busy={refilling ? REFILLING : undefined} onClick={onRefill}>
      {REFILL}
    </HudButton>
  );

/**
 * The army card's Refill (the owner's option 2, 27 October): on the chips' row at a chip's size, framed as a press, its
 * price in LORDS; short of them, the LORDS held against the price in red, and no press.
 */
export const RefillChip = ({
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
}) => {
  const short = held !== undefined && held < price;
  return (
    <HudChip
      icons={["stamina", "lords"]}
      label={REFILL}
      tone={short ? "bad" : undefined}
      tip={short ? refillShort(formatExact(held), formatCharge(price)) : undefined}
      disabled={short || refilling}
      onPress={onRefill}
    >
      {refilling ? REFILLING : short ? heldAgainstNeed(held, price) : formatShort(price)}
    </HudChip>
  );
};

/**
 * A phone's picked army's stamina as its refill, one button over Level up (the owner, 27 October): "14/140", a press
 * opening the refill's confirm. Short of LORDS it reads in red, what the realm holds against the price on its hover, and
 * takes no press; a full bar takes none either.
 */
export const StaminaRefill = ({
  stamina,
  held,
  refilling = false,
  onRefill,
}: {
  stamina: { current: number; max: number };
  held: number | undefined;
  /** A refill of this army is in flight: sent, its outcome not known yet. */
  refilling?: boolean;
  onRefill: () => void;
}) => {
  const price = Math.ceil(stamina.max - stamina.current);
  const short = held !== undefined && held < price;
  const reading = `${formatExact(stamina.current)}/${formatExact(stamina.max)}`;
  return (
    <HudButton
      kind="secondary"
      size="sm"
      icon="stamina"
      tone={short ? "bad" : undefined}
      aria-label={`${REFILL} ${reading}`}
      data-tip={short ? refillShort(formatExact(held), formatCharge(price)) : undefined}
      disabled={price <= 0 || short}
      busy={refilling ? REFILLING : undefined}
      onClick={onRefill}
    >
      {reading}
    </HudButton>
  );
};

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
