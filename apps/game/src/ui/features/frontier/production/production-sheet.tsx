import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { FullIn } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import type { Tone } from "@/ui/design-system/kit/tone";
import { BUILD, DEPLOY, FULL, PRODUCTION, REALM } from "@/ui/design-system/kit/words";

/** Where a full store is spent: labor on the realm board, wheat and troops by Deploy. */
export type SpentAt = "realm" | "deploy";

/** One store's row: what it makes an hour (with the side marks that shape it), what it holds against its limit. */
export type ProductionLine = {
  icon: IconCode;
  perHour: number | undefined;
  sides?: readonly IconCode[];
  held: number | undefined;
  limit: number | undefined;
  tone: Tone;
  /** Seconds until it is full; 0 when full, undefined while the limit or the rate is unknown. */
  fullIn: number | undefined;
  /** No building makes it: Build is the way. */
  noBuilding: boolean;
  spentAt: SpentAt;
};

/**
 * Production (wireframe 03): three rows, wheat, labor and troops: the rate an hour with its side marks, what each holds
 * against its limit, and when it is full, in hours, never days. A Full row says so and points to where that store is
 * spent; a store no building makes offers Build. No input rows.
 */
export const ProductionSheet = ({
  lines,
  onSpend,
  onBuild,
  onClose,
}: {
  lines: readonly ProductionLine[];
  onSpend: (at: SpentAt) => void;
  onBuild: () => void;
  onClose: () => void;
}) => (
  <Sheet label={PRODUCTION} onClose={onClose}>
    <h2 className="frontier-title !text-[20px]">{PRODUCTION}</h2>
    {lines.map((line) => (
      <Row key={line.icon} line={line} onSpend={onSpend} onBuild={onBuild} />
    ))}
  </Sheet>
);

const Row = ({
  line,
  onSpend,
  onBuild,
}: {
  line: ProductionLine;
  onSpend: (at: SpentAt) => void;
  onBuild: () => void;
}) => {
  const full = line.limit !== undefined && line.held !== undefined && line.held >= line.limit;
  return (
    <div className="flex h-14 items-center gap-2 border-b border-kit-line">
      <KitIcon code={line.icon} size={28} />
      <span
        className={cn(
          "flex w-[92px] shrink-0 items-center gap-[3px] text-[15px] tabular-nums",
          full ? "text-light-red" : "text-kit-cream",
        )}
      >
        {full ? "+0/h" : line.perHour === undefined ? "—" : `+${formatAmount(line.perHour)}/h`}
        {line.sides?.map((side, index) => (
          <KitIcon key={index} code={side} size={18} />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {/* The kit's amount rule, as on the strip: a phone's row has no room for two exact five-digit amounts. A full
            store holds its limit, so its row says the one number beside Full. */}
        <span className="whitespace-nowrap text-[14px] tabular-nums text-kit-cream">
          {formatAmount(line.held)}
          {line.limit !== undefined && !full && ` / ${formatAmount(line.limit)}`}
        </span>
        <StoreBar amount={line.held} limit={line.limit} tone={line.tone} />
      </span>
      {full ? (
        <>
          <span className="frontier-chip h-7 !border-light-red !px-2.5 !py-0 text-[13px] font-semibold text-light-red">
            {FULL}
          </span>
          <Button
            role="secondary"
            icon={line.spentAt === "realm" ? "Cs" : undefined}
            word={line.spentAt === "realm" ? REALM : DEPLOY}
            className="!h-12 w-24 !px-2 !text-[15px]"
            onClick={() => onSpend(line.spentAt)}
          />
        </>
      ) : line.noBuilding ? (
        <Button role="secondary" word={BUILD} className="!h-12 w-[84px] !text-[15px]" onClick={onBuild} />
      ) : (
        line.fullIn !== undefined && <FullIn seconds={line.fullIn} />
      )}
    </div>
  );
};
