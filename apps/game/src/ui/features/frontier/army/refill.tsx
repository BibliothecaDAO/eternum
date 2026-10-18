import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { formatExact } from "@/ui/design-system/kit/amount";
import { HudButton, HudChip, HudMeter, HudPanel, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { hudPrices } from "../hud-prices";
import { CANCEL, LORDS, REFILL, REFILLING, STAMINA } from "@/ui/design-system/kit/words";

/**
 * Refill's control (wireframes 05, 08): the missing points as a LORDS price, one LORDS a point; when the realm holds
 * fewer LORDS, what it holds against the price takes the button's place.
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
    <span role="img" aria-label={`${LORDS} ${formatExact(held)} / ${formatExact(price)}`} className="flex shrink-0">
      <HudPanel collapsible={false} bodyClassName="flex items-center gap-1.5">
        <SemanticIcon name="lords" size={18} />
        <span className="flex min-w-14 flex-col gap-1">
          <span className="whitespace-nowrap text-hud-body tabular-nums text-hud-ink">
            {formatExact(held)} / {formatExact(price)}
          </span>
          <HudMeter share={price > 0 ? held / price : 0} label={LORDS} />
        </span>
      </HudPanel>
    </span>
  ) : (
    <HudButton
      kind="secondary"
      icon="stamina"
      prices={hudPrices([{ of: "lords", amount: price }])}
      busy={refilling ? REFILLING : undefined}
      onClick={onRefill}
    >
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
        <HudChip
          icons={["stamina"]}
          label={STAMINA}
        >{`${formatExact(stamina.current)} → ${formatExact(stamina.max)}`}</HudChip>
        <HudChip
          icons={["lords"]}
          label={LORDS}
        >{`${formatExact(held)} → ${held === undefined ? "—" : formatExact(held - price)}`}</HudChip>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <HudButton kind="quiet" onClick={onCancel}>
          {CANCEL}
        </HudButton>
        <span className="col-span-2 grid">
          <HudButton
            kind="primary"
            prices={hudPrices([{ of: "lords", amount: price }])}
            busy={sending ? REFILLING : undefined}
            onClick={onRefill}
          >
            {REFILL}
          </HudButton>
        </span>
      </div>
    </HudSheet>
  );
};
