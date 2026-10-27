import { formatCharge, formatExact, LORDS, formatShortChange } from "@bibliothecadao/types";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { CANCEL, REFILL, REFILLING, STAMINA, heldAgainstNeed, refillShort } from "@/ui/design-system/kit/words";

/**
 * Refill's control (wireframes 05, 08): the missing points as a LORDS price, one LORDS a point; when the realm holds
 * fewer LORDS, what it holds against the price takes the button's place in two lines (the owner, 27 October), "Refill"
 * over "40 / 150", with no frame of its own, so it stands inside the army card with the stamina. Its hover says what
 * the two numbers count.
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
  new URLSearchParams(window.location.search).get("refill") === "row" ? (
    <RefillRow price={price} held={held} refilling={refilling} onRefill={onRefill} />
  ) : held !== undefined && held < price ? (
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

/** Lab-only (the owner's mock, 27 October): one control on the chips' row, its price, or held against it when short. */
const RefillRow = ({
  price,
  held,
  refilling,
  onRefill,
}: {
  price: number;
  held: number | undefined;
  refilling: boolean;
  onRefill: () => void;
}) => {
  const short = held !== undefined && held < price;
  const tip = short ? refillShort(formatExact(held), formatCharge(price)) : `${REFILL} ${formatCharge(price)} ${LORDS}`;
  return (
    <HudButton
      kind="secondary"
      size="sm"
      icon="stamina"
      disabled={short}
      aria-label={tip}
      data-tip={tip}
      busy={refilling ? REFILLING : undefined}
      onClick={onRefill}
    >
      <SemanticIcon name="lords" size={14} />
      <span className={short ? "tabular-nums text-hud-bad" : "tabular-nums"}>
        {short ? `${formatExact(held)}/${formatExact(price)}` : formatExact(price)}
      </span>
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
