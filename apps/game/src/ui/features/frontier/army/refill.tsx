import { formatExact } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
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
  onRefill,
}: {
  price: number;
  held: number | undefined;
  onRefill: () => void;
}) =>
  held !== undefined && held < price ? (
    <span
      role="img"
      aria-label={`${LORDS} ${formatExact(held)} / ${formatExact(price)}`}
      className="frontier-card flex h-12 shrink-0 items-center gap-1.5 !rounded-xl px-2"
    >
      <KitIcon code="Lo" size={18} />
      <span className="flex min-w-14 flex-col gap-[3px]">
        <span className="whitespace-nowrap text-[14px] tabular-nums text-kit-cream">
          {formatExact(held)} / {formatExact(price)}
        </span>
        <StoreBar amount={held} limit={price} tone="calm" />
      </span>
    </span>
  ) : (
    <Button role="secondary" icon="St" word={REFILL} prices={[{ of: "lords", amount: price }]} onClick={onRefill} />
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
        <KitIcon code="St" size={30} />
        <h2 className="frontier-title flex-1 !text-[20px]">{REFILL}</h2>
      </header>
      <div className="flex items-center justify-center gap-2">
        <Chip icons={["St"]} label={STAMINA} value={`${formatExact(stamina.current)} → ${formatExact(stamina.max)}`} />
        <Chip
          icons={["Lo"]}
          label={LORDS}
          value={`${formatExact(held)} → ${held === undefined ? "—" : formatExact(held - price)}`}
        />
      </div>
      <div className="flex gap-2">
        <Button role="outline" word={CANCEL} onClick={onCancel} className="w-[120px]" />
        <Button
          role="primary"
          word={REFILL}
          prices={[{ of: "lords", amount: price }]}
          loading={sending ? REFILLING : undefined}
          onClick={onRefill}
          className="flex-1"
        />
      </div>
    </Sheet>
  );
};
