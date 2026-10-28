import { useState } from "react";
import { formatExact, formatShort, formatShortChange, LORDS } from "@bibliothecadao/types";
import { HudButton, HudChip, HudSheet, HudSlider } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, REFILL, REFILLING, STAMINA } from "@/ui/design-system/kit/words";

/** Every refill control requires enough LORDS to buy at least one whole stamina point. */
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

/** The army card's compact refill opens the same partial purchase as the order bar. */
export const RefillChip = ({
  price,
  held,
  refilling = false,
  onRefill,
}: {
  price: number;
  held: number | undefined;
  refilling?: boolean;
  onRefill: () => void;
}) => (
  <HudChip
    icons={["stamina", "lords"]}
    label={REFILL}
    disabled={refillOutOfReach(held) || refilling}
    onPress={onRefill}
  >
    {refilling ? REFILLING : held === undefined ? "—" : formatShort(Math.min(price, Math.floor(held)))}
  </HudChip>
);

/**
 * A phone's picked army's stamina as its refill, one button over Level up (the owner, 27 October): "14/140", a press
 * opening the refill's confirm. A whole LORDS buys a partial refill;
 * with no affordable point, or with a full bar, it takes no press.
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
  const short = refillOutOfReach(held);
  const reading = `${formatExact(stamina.current)}/${formatExact(stamina.max)}`;
  return (
    <HudButton
      kind="secondary"
      size="sm"
      icon="stamina"
      tone={short ? "bad" : undefined}
      aria-label={`${REFILL} ${reading}`}
      disabled={price <= 0 || short}
      busy={refilling ? REFILLING : undefined}
      onClick={onRefill}
    >
      {reading}
    </HudButton>
  );
};

/** Purchase whole stamina points, up to the missing bar or the realm's available LORDS. */
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
  onRefill: (amount: number) => void;
  onCancel: () => void;
}) => {
  const missing = Math.max(0, Math.floor(stamina.max - stamina.current));
  const affordable = Math.min(missing, Math.max(0, Math.floor(held ?? 0)));
  const [selected, setSelected] = useState(affordable);
  const amount = Math.min(selected, affordable);
  return (
    <HudSheet label={REFILL} onClose={onCancel}>
      <div className="flex items-center justify-center gap-2">
        <HudChip icons={["stamina"]} label={STAMINA}>
          {formatShortChange(stamina.current, stamina.current + amount)}
        </HudChip>
        <HudChip icons={["lords"]} label={LORDS}>
          {formatShortChange(held, held === undefined ? undefined : held - amount)}
        </HudChip>
      </div>
      <HudSlider
        label="Stamina to refill"
        value={amount}
        min={0}
        max={missing}
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
            disabled={amount <= 0 || held === undefined}
            busy={sending ? REFILLING : undefined}
            onClick={() => onRefill(amount)}
          >
            {REFILL} · {formatExact(amount)} {LORDS}
          </HudButton>
        </span>
      </div>
    </HudSheet>
  );
};
