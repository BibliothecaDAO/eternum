import { formatExact } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  HudButton,
  HudCard,
  HudChip,
  HudCost,
  HudNotice,
  HudRarity,
  HudSheet,
} from "@/ui/design-system/kit/hud-elements";
import type { Fix, Refusal } from "@/ui/design-system/kit/refusal";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { BUILD, BUILDING, freeOf, POPULATION, PRICE_UP } from "@/ui/design-system/kit/words";

import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import { shortfallLine } from "@/ui/design-system/kit/reasons";

/**
 * One building on the build sheet: its icon and name, then its labor price (ember when short), a tick when the realm
 * already holds its one copy, or a lock with the gate it waits for (barracks at a tier).
 */
export type BuildTile = {
  key: string;
  icon: IconMeaning;
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
export type BuildGain = { icon: IconMeaning; value: string; label: string };

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
  <HudSheet label={BUILD} onClose={onClose}>
    <header className="flex items-center justify-end">
      <HudChip
        icons={["person"]}
        label={POPULATION}
        tip={freeOf(POPULATION, formatExact(population.free), formatExact(population.total))}
      >
        {`${formatExact(population.free)} / ${formatExact(population.total)}`}
      </HudChip>
    </header>
    <div className="grid grid-cols-3 gap-1.5">
      {tiles.map((tile, index) => (
        <TileButton key={tile.key} tile={tile} chosen={index === chosen} onChoose={() => onChoose(index)} />
      ))}
    </div>
    <div className="flex items-center justify-center gap-2">
      {gains.map((gain) => (
        <HudChip key={gain.label} icons={[gain.icon]} label={gain.label}>
          {gain.value}
        </HudChip>
      ))}
    </div>
    {refusal ? (
      <>
        <HudNotice line={refusal.reason.kind === "short" ? shortfallLine(refusal.reason) : refusal.reason.line} />
        {refusal.fix && <FixVerb fix={refusal.fix} />}
      </>
    ) : (
      <>
        <HudButton kind="primary" busy={sending ? BUILDING : undefined} onClick={onBuild}>
          {BUILD}
        </HudButton>
        <HudCost line={costLine(prices)} />
      </>
    )}
  </HudSheet>
);

/** The way past a refusal (the Hut that houses it, the map that pays it), as the sheet's one verb. */
const FixVerb = ({ fix }: { fix: Fix }) => (
  <>
    <HudButton kind="primary" icon={fix.icon} onClick={fix.onFix}>
      {fix.word}
    </HudButton>
    <HudCost line={costLine(fix.prices ?? [])} />
  </>
);

const TileButton = ({ tile, chosen, onChoose }: { tile: BuildTile; chosen: boolean; onChoose: () => void }) => (
  <span data-tip={tile.tip} className="min-w-0">
    <HudCard
      size="sm"
      title={tile.name}
      picture={<SemanticIcon name={tile.icon} size={26} />}
      detail={<Foot foot={tile.foot} />}
      selected={chosen}
      onClick={onChoose}
    />
  </span>
);

const Foot = ({ foot }: { foot: BuildTile["foot"] }) => {
  if (foot.kind === "built") return <SemanticIcon name="check" size={18} />;
  if (foot.kind === "locked")
    return (
      <span className="flex items-center gap-1">
        <SemanticIcon name="lock" size={16} />
        <SemanticIcon name="barracks" size={16} />
        <HudRarity tier={foot.gate} />
      </span>
    );
  return (
    <span className="flex items-center gap-1">
      <SemanticIcon name="labor" size={14} />
      <span className={cn("tabular-nums", foot.short ? "text-hud-bad" : "text-hud-ink")}>
        {formatExact(foot.labor)}
      </span>
      {foot.raised && (
        <span role="img" aria-label={PRICE_UP} data-tip={foot.raised} className="leading-none text-hud-warn">
          ↑
        </span>
      )}
    </span>
  );
};
