import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button, type Price } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { type Reason, ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { CASTLE, MAP, REALM_LEVELS, TROOPS, UPGRADE, UPGRADING } from "@/ui/design-system/kit/words";

/** The castle at one level: its art and level, the plots it opens, its army slots, each store's limit, the deploy cap. */
export type CastleSide = {
  level: number;
  art: string;
  plots: number;
  slots: number;
  /** What the castle stores of each store at this level, before the Granary and Storeroom; unknown is undefined. */
  limit: number | undefined;
  deployCap: number;
};

/**
 * The castle's sheet (wireframe 02): the castle now and at its next level side by side, what the next level brings lit,
 * and Upgrade carrying its labor price; when the realm cannot pay, the price held against what it has and the exact
 * wait, with Map, where labor comes from. At the last level there is no next side and no verb.
 */
export const CastleView = ({
  now,
  next,
  prices,
  short,
  sending,
  onUpgrade,
  onMap,
  onClose,
}: {
  now: CastleSide;
  next: CastleSide | null;
  prices: Price[];
  short: Extract<Reason, { kind: "short" }> | undefined;
  sending: boolean;
  onUpgrade: () => void;
  onMap: () => void;
  onClose: () => void;
}) => (
  <Sheet label={CASTLE} onClose={onClose}>
    <header className="flex items-center gap-2.5">
      <KitIcon code="Cs" size={30} />
      <h2 className="frontier-title flex-1 !text-[20px]">{CASTLE}</h2>
    </header>
    <div className="flex items-center gap-2">
      <Side side={now} />
      {next && (
        <>
          <span aria-hidden className="text-[22px] text-kit-hot">
            →
          </span>
          <Side side={next} lit />
        </>
      )}
    </div>
    {next &&
      (short ? (
        <ReasonPlate
          reason={short}
          step={<Button role="primary" icon="Mp" word={MAP} className="w-[104px]" onClick={onMap} />}
        />
      ) : (
        <Button
          role="primary"
          word={UPGRADE}
          prices={prices}
          loading={sending ? UPGRADING : undefined}
          onClick={onUpgrade}
        />
      ))}
  </Sheet>
);

const Side = ({ side, lit = false }: { side: CastleSide; lit?: boolean }) => (
  <div
    className={cn(
      "frontier-card flex flex-1 flex-col items-center gap-1 !rounded-xl py-2",
      lit && "!border-2 !border-kit-hot",
    )}
  >
    <img src={side.art} alt="" className="h-[52px] w-14 object-contain" />
    <span className="text-[13px] font-semibold text-kit-cream">{REALM_LEVELS[side.level]}</span>
    <Chip icons={["Hx"]} label="plots" value={formatAmount(side.plots)} />
    <Chip icons={["Sl"]} label="army slots" value={formatAmount(side.slots)} />
    {side.limit !== undefined && <Chip icons={["Sg"]} label="limit" value={formatAmount(side.limit)} />}
    <Chip icons={["Tr"]} label={TROOPS} value={formatAmount(side.deployCap)} />
  </div>
);
