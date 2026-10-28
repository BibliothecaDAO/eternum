import { formatCharge, formatPopulation, formatPopulationInWords, formatShortDuration } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCard,
  HudChip,
  HudCost,
  HudNotice,
  HudSheet,
  HudTier,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  type Tier,
  BARRACKS,
  BUILD,
  BUILDING,
  needsTier,
  POPULATION,
  PRICE_UP,
  tierNumeral,
} from "@/ui/design-system/kit/words";

import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import type { ReactNode } from "react";
import { reasonLine } from "@/ui/design-system/kit/reasons";
import type { RealmPopulation } from "../realm/realm-population";

/**
 * One building on the build sheet (the owner's pick, option B · Cards): its painting and name with the population it
 * takes in the card's corner, what one more gives, its research as gems (one per side of a row that has sides), and a
 * band for where it stands: its labor price, with the wait while the realm holds too little or the population it
 * lacks, a lock with the gate it waits for (Barracks at a tier), or a tick when the realm already holds its one copy.
 */
export type BuildTile = {
  key: string;
  icon: IconMeaning;
  name: string;
  /** What the building does, in one line, on the card's tooltip. */
  tip: string;
  /** What one more gives: a production rate or population; a training building's attribute alone (its gem is the tier). */
  gives: { icon: IconMeaning; value?: ReactNode };
  /**
   * Its research as gems, never words (owner, 27 October: "why no gems instead of the text ?"): each side of a row that
   * has two (Fields and Granary) with its mark and its gem, else its type's one gem, the research tile's.
   */
  gems: { side?: IconMeaning; tier: Tier }[];
  /** The population it takes; 0 takes none. */
  takes: number;
  standing:
    | {
        kind: "price";
        labor: number;
        /** Why the price is above its base, when it is. */
        raised?: string;
        /** What the realm lacks: labor, with the wait until it holds it (unknown when nothing fills it), or population. */
        short?: { of: "labor"; wait: number | undefined } | { of: "population" };
      }
    | { kind: "built" }
    | { kind: "locked"; gate: Exclude<Tier, 1> };
};

/**
 * The build sheet (wireframe 02): the realm's population in its head, the grid of building cards, each saying what it
 * gives and where it stands, and Build in the sheet's foot with the chosen one's price (the copy surcharge included; an
 * arrow marks a price that has risen), so the verb never scrolls out of view however many cards there are. When the
 * building cannot rise, the foot says what it needs against what there is, and its gold button carries the fix: the Hut
 * that houses it, the map that pays it, the Research that opens it.
 */
export const BuildView = ({
  population,
  tiles,
  chosen,
  onChoose,
  prices,
  refusal,
  sending,
  onBuild,
  onClose,
}: {
  /** The realm's population, used of all it can hold; unknown is left out. */
  population: RealmPopulation | undefined;
  tiles: BuildTile[];
  chosen: number;
  onChoose: (index: number) => void;
  prices: Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onBuild: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={BUILD} onClose={onClose}>
    {population && (
      <header className="flex items-center justify-end">
        <HudChip icons={["person"]} label={POPULATION} tip={formatPopulationInWords(population.used, population.total)}>
          {formatPopulation(population.used, population.total)}
        </HudChip>
      </header>
    )}
    <div className="grid grid-cols-3 gap-1.5">
      {tiles.map((tile, index) => (
        <TileButton key={tile.key} tile={tile} chosen={index === chosen} onChoose={() => onChoose(index)} />
      ))}
    </div>
    {refusal ? (
      <HudWindowFoot note={<RefusalNote refusal={refusal} />}>
        {refusal.fix && (
          <HudButton kind="primary" icon={refusal.fix.icon} onClick={refusal.fix.onFix}>
            {refusal.fix.word}
          </HudButton>
        )}
      </HudWindowFoot>
    ) : (
      <HudWindowFoot note={<HudCost line={costLine(prices)} />}>
        <HudButton kind="primary" busy={sending ? BUILDING : undefined} onClick={onBuild}>
          {BUILD}
        </HudButton>
      </HudWindowFoot>
    )}
  </HudSheet>
);

/**
 * Why the building cannot rise, in the foot where Build would stand, over the price of the way past it (the Hut that
 * houses it, the map that pays it), whose verb stands beside it.
 */
const RefusalNote = ({ refusal }: { refusal: Refusal }) => (
  <span className="flex flex-col items-start gap-1">
    <HudNotice line={reasonLine(refusal.reason)} />
    {refusal.fix?.prices && <HudCost line={costLine(refusal.fix.prices)} />}
  </span>
);

const TileButton = ({ tile, chosen, onChoose }: { tile: BuildTile; chosen: boolean; onChoose: () => void }) => (
  <span data-tip={tile.tip} className="min-w-0">
    <HudCard
      size="sm"
      title={tile.name}
      picture={<SemanticIcon name={tile.icon} size={26} />}
      corner={tile.takes > 0 ? <Takes takes={tile.takes} /> : undefined}
      detail={
        <span className="flex w-full flex-col items-center gap-1">
          <Gives tile={tile} />
          <Band standing={tile.standing} />
        </span>
      }
      selected={chosen}
      onClick={onChoose}
    />
  </span>
);

/**
 * What one more gives, then its research's gems: two short lines, so a card three to a 360-wide phone's row holds them
 * whole.
 */
const Gives = ({ tile }: { tile: BuildTile }) => (
  <span className="flex flex-col items-center gap-0.5">
    <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
      <SemanticIcon name={tile.gives.icon} size={14} />
      {tile.gives.value}
    </span>
    <span className="flex items-center justify-center gap-x-1.5 whitespace-nowrap">
      {tile.gems.map((gem, index) => (
        <span key={gem.side ?? index} data-side={gem.side} className="flex items-center gap-0.5">
          {gem.side && <SemanticIcon name={gem.side} size={12} />}
          <HudTier tier={gem.tier} />
        </span>
      ))}
    </span>
  </span>
);

/** The population one more takes, in the card's corner beside its painting. */
const Takes = ({ takes }: { takes: number }) => (
  <span
    className="flex items-center gap-0.5 text-hud-label tabular-nums text-hud-muted"
    role="img"
    aria-label={`${POPULATION} ${formatCharge(takes)}`}
  >
    <SemanticIcon name="person" size={12} />
    {formatCharge(takes)}
  </span>
);

/** The tone of a card's band: red while labor is short, amber while population is, green once built. */
const bandTone = (standing: BuildTile["standing"]) =>
  standing.kind === "built"
    ? "good"
    : standing.kind === "price" && standing.short
      ? standing.short.of === "labor"
        ? "bad"
        : "warn"
      : undefined;

/**
 * Where a building stands, along its card's foot: its price and what it lacks, the Barracks tier it waits for in words
 * with its numeral ("Barracks III" by the lock, "Needs Barracks III" on its tip and refusal: never a gem, which would
 * read as the card's own tier), or a tick.
 */
const Band = ({ standing }: { standing: BuildTile["standing"] }) => (
  <HudChip
    tone={bandTone(standing)}
    tip={standing.kind === "locked" ? needsTier(BARRACKS, tierNumeral(standing.gate)) : undefined}
  >
    <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
      {standing.kind === "built" && <SemanticIcon name="check" size={16} />}
      {standing.kind === "locked" && (
        <>
          <SemanticIcon name="lock" size={14} />
          {`${BARRACKS} ${tierNumeral(standing.gate)}`}
        </>
      )}
      {standing.kind === "price" && <Price standing={standing} />}
    </span>
  </HudChip>
);

/**
 * A labor price, the arrow of a price that has risen, and the wait at a glance ("3h"; the chosen building's line under
 * the grid says it whole) or the population the realm lacks. Every card's price is labor, which the foot names, so the
 * band carries no labor mark; each mark it has sits against its number, so a raised six-figure price with its wait fits
 * a card three to a 360-wide phone's row.
 */
const Price = ({ standing }: { standing: Extract<BuildTile["standing"], { kind: "price" }> }) => (
  <>
    <span className="flex items-center gap-0.5">
      {formatCharge(standing.labor)}
      {standing.raised && (
        <span role="img" aria-label={PRICE_UP} data-tip={standing.raised} className="leading-none text-hud-warn">
          ↑
        </span>
      )}
    </span>
    {standing.short?.of === "labor" && standing.short.wait !== undefined && (
      <span className="flex items-center gap-0.5">
        <SemanticIcon name="hourglass" size={12} />
        {formatShortDuration(standing.short.wait)}
      </span>
    )}
    {standing.short?.of === "population" && <SemanticIcon name="person" size={12} />}
  </>
);
