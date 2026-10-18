import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { formatExact } from "@/ui/design-system/kit/amount";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { hudPrices } from "../hud-prices";
import { Chip } from "@/ui/design-system/kit/chip";

import { Sheet } from "@/ui/design-system/kit/sheet";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
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
    <span
      role="img"
      aria-label={`${LORDS} ${formatExact(held)} / ${formatExact(price)}`}
      className="frontier-card flex h-12 shrink-0 items-center gap-1.5 !rounded-xl px-2"
    >
      <SemanticIcon name="lords" size={18} />
      <span className="flex min-w-14 flex-col gap-1">
        <span className="whitespace-nowrap text-hud-body tabular-nums text-hud-ink">
          {formatExact(held)} / {formatExact(price)}
        </span>
        <StoreBar amount={held} limit={price} tone="calm" />
      </span>
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
    <Sheet label={REFILL} onClose={onCancel}>
      <header className="flex items-center gap-2.5">
        <SemanticIcon name="stamina" size={30} />
        <h2 className="frontier-title flex-1 !text-hud-display">{REFILL}</h2>
      </header>
      <div className="flex items-center justify-center gap-2">
        <Chip
          icons={["stamina"]}
          label={STAMINA}
          value={`${formatExact(stamina.current)} → ${formatExact(stamina.max)}`}
        />
        <Chip
          icons={["lords"]}
          label={LORDS}
          value={`${formatExact(held)} → ${held === undefined ? "—" : formatExact(held - price)}`}
        />
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
    </Sheet>
  );
};
