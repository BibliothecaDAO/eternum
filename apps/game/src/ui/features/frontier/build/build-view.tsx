import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Button, type Price } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { FixButton, type Refusal } from "@/ui/design-system/kit/refused-verb";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { BUILD, BUILDING, freeOf, POPULATION, PRICE_UP } from "@/ui/design-system/kit/words";

/**
 * One building on the build sheet: its icon and name, then its labor price (ember when short), a tick when the realm
 * already holds its one copy, or a lock with the gate it waits for (barracks at a tier).
 */
export type BuildTile = {
  key: string;
  icon: IconCode;
  name: string;
  /** What the building does, in one line, on the card's tooltip. */
  tip: string;
  foot:
    | {
        kind: "price";
        labor: number;
        short: boolean;
        /** Why the price is above its base, when it is. */ raised?: string;
      }
    | { kind: "built" }
    | { kind: "locked"; gate: Tier };
};

/** What the chosen building gives, as chips: what it makes or houses, and the population it takes. */
export type BuildGain = { icon: IconCode; value: string; label: string };

/**
 * The build sheet (wireframe 02): the realm's free population in its head, the grid of buildings, the chosen one's
 * gains, and Build carrying its price (the copy surcharge included; an arrow marks a price that has risen). When the
 * building cannot rise, one line says what it needs against what there is, and the gold button carries the fix: the Hut
 * that houses it, the map that pays it, the Research that opens it.
 */
export const BuildView = ({
  population,
  tiles,
  chosen,
  onChoose,
  gains,
  prices,
  refusal,
  sending,
  onBuild,
  onClose,
}: {
  /** The realm's population: what is free of all it can hold; unknown is a dash. */
  population: { free: number | undefined; total: number | undefined };
  tiles: BuildTile[];
  chosen: number;
  onChoose: (index: number) => void;
  gains: BuildGain[];
  prices: Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onBuild: () => void;
  onClose: () => void;
}) => (
  <Sheet label={BUILD} onClose={onClose}>
    <header className="flex items-center justify-between gap-2">
      <h2 className="frontier-title !text-xl">{BUILD}</h2>
      <Chip
        icons={["Pp"]}
        label={POPULATION}
        value={`${formatExact(population.free)} / ${formatExact(population.total)}`}
        tip={freeOf(POPULATION, formatExact(population.free), formatExact(population.total))}
      />
    </header>
    <div className="grid grid-cols-3 gap-1.5">
      {tiles.map((tile, index) => (
        <TileButton key={tile.key} tile={tile} chosen={index === chosen} onChoose={() => onChoose(index)} />
      ))}
    </div>
    <div className="flex items-center justify-center gap-2">
      {gains.map((gain) => (
        <Chip key={gain.label} icons={[gain.icon]} label={gain.label} value={gain.value} />
      ))}
    </div>
    {refusal ? (
      <>
        <ReasonPlate reason={refusal.reason} />
        {refusal.fix && <FixButton fix={refusal.fix} />}
      </>
    ) : (
      <Button role="primary" word={BUILD} prices={prices} loading={sending ? BUILDING : undefined} onClick={onBuild} />
    )}
  </Sheet>
);

const TileButton = ({ tile, chosen, onChoose }: { tile: BuildTile; chosen: boolean; onChoose: () => void }) => {
  const dim = tile.foot.kind !== "price";
  return (
    <button
      type="button"
      aria-pressed={chosen}
      aria-label={tile.name}
      data-tip={tile.tip}
      onClick={onChoose}
      className={cn(
        "frontier-card flex h-[86px] min-w-0 flex-col items-center justify-center gap-[3px] !rounded-xl",
        chosen && "!border-[3px] !border-kit-hot",
        dim && "opacity-50",
      )}
    >
      <KitIcon code={tile.icon} size={26} />
      <span className="text-sm font-semibold text-kit-cream">{tile.name}</span>
      <Foot foot={tile.foot} />
    </button>
  );
};

const Foot = ({ foot }: { foot: BuildTile["foot"] }) => {
  if (foot.kind === "built") return <KitIcon code="Ok" size={18} />;
  if (foot.kind === "locked")
    return (
      <span className="flex items-center gap-[3px]">
        <KitIcon code="Lk" size={16} />
        <KitIcon code="Bs" size={16} />
        <TierChip tier={foot.gate} showWord={false} />
      </span>
    );
  return (
    <span className="flex items-center gap-[3px]">
      <KitIcon code="La" size={14} />
      <span className={cn("text-sm tabular-nums", foot.short ? "text-light-red" : "text-kit-cream")}>
        {formatExact(foot.labor)}
      </span>
      {foot.raised && (
        <span role="img" aria-label={PRICE_UP} data-tip={foot.raised} className="text-sm leading-none text-kit-hot">
          ↑
        </span>
      )}
    </span>
  );
};
