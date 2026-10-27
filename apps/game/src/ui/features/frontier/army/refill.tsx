import { useState } from "react";
import { formatExact, LORDS } from "@bibliothecadao/types";
import { HudButton, HudChip, HudSheet, HudSlider } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, REFILL, REFILLING, STAMINA } from "@/ui/design-system/kit/words";

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
    disabled={held === undefined || held < 1}
    busy={refilling ? REFILLING : undefined}
    onClick={onRefill}
  >
    {REFILL}
  </HudButton>
);

/** The army card's compact refill opens the same partial purchase as the order bar. */
export const RefillChip = ({ price, held, refilling = false, onRefill }: {
  price: number;
  held: number | undefined;
  refilling?: boolean;
  onRefill: () => void;
}) => (
  <HudChip icons={["stamina", "lords"]} label={REFILL} disabled={held === undefined || held < 1 || refilling} onPress={onRefill}>
    {refilling ? REFILLING : held === undefined ? "—" : formatExact(Math.min(price, Math.floor(held)))}
  </HudChip>
);

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
        <HudChip
          icons={["stamina"]}
          label={STAMINA}
        >{`${formatExact(stamina.current)} → ${formatExact(stamina.current + amount)}`}</HudChip>
        <HudChip
          icons={["lords"]}
          label={LORDS}
        >{`${formatExact(held)} → ${held === undefined ? "—" : formatExact(held - amount)}`}</HudChip>
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
