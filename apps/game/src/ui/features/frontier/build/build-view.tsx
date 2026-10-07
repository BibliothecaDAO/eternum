import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";
import { Button, type Price } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { type Reason, ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { BUILD, BUILDING, MAP } from "@/ui/design-system/kit/words";

/**
 * One building on the build sheet: its icon and name, then its labor price (ember when short), a tick when the realm
 * already holds its one copy, or a lock with the gate it waits for (barracks at a tier).
 */
export type BuildTile = {
  key: string;
  icon: IconCode;
  name: string;
  foot: { kind: "price"; labor: number; short: boolean } | { kind: "built" } | { kind: "locked"; gate: Tier };
};

/** What the chosen building gives, as chips: what it makes or houses, the population it takes, the marked plot's ×2. */
export type BuildGain = { icon: IconCode; value: string; label: string };

/**
 * The build sheet (wireframe 02): the grid of buildings, the chosen one's gains, and Build carrying its price (the copy
 * surcharge included). When the realm cannot pay, the price held against what it has and the exact wait take Build's
 * place, with Map, where labor comes from.
 */
export const BuildView = ({
  tiles,
  chosen,
  onChoose,
  gains,
  prices,
  short,
  sending,
  onBuild,
  onMap,
  onClose,
}: {
  tiles: BuildTile[];
  chosen: number;
  onChoose: (index: number) => void;
  gains: BuildGain[];
  prices: Price[];
  /** Why Build cannot run: a price held against what the realm has. */
  short: Extract<Reason, { kind: "short" }> | undefined;
  sending: boolean;
  onBuild: () => void;
  onMap: () => void;
  onClose: () => void;
}) => (
  <Sheet label={BUILD} onClose={onClose}>
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
    {short ? (
      <ReasonPlate
        reason={short}
        step={<Button role="primary" icon="Mp" word={MAP} className="w-[104px]" onClick={onMap} />}
      />
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
      onClick={onChoose}
      className={cn(
        "frontier-card flex h-[86px] min-w-0 flex-col items-center justify-center gap-[3px] !rounded-xl",
        chosen && "!border-[3px] !border-[color:var(--frontier-hot)]",
        dim && "opacity-50",
      )}
    >
      <KitIcon code={tile.icon} size={26} />
      <span className="text-[11px] font-semibold text-[color:var(--frontier-parchment)]">{tile.name}</span>
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
      <span
        className={cn(
          "text-[14px] tabular-nums",
          foot.short ? "text-light-red" : "text-[color:var(--frontier-parchment)]",
        )}
      >
        {formatExact(foot.labor)}
      </span>
    </span>
  );
};
