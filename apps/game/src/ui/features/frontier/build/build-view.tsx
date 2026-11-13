import { needsRealmLevel } from "@/ui/design-system/kit/words";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { availableScoutingChoices, type ScoutingSide } from "../progression-choices";
import { researchTier } from "@bibliothecadao/eternum";
import {
  formatExact,
  formatCharge,
  formatPopulation,
  formatPopulationInWords,
  formatShort,
  formatShortDuration,
} from "@bibliothecadao/types";
import { Icon as SemanticIcon, IconGroup, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCard,
  HudChip,
  HudConfirm,
  HudCost,
  HudNotice,
  HudSheet,
  HudWindowFoot,
  rankedTip,
} from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  BARRACKS,
  BUILD,
  BUILDING,
  needsResearchPurchases,
  POPULATION,
  PRICE_UP,
  purchasesOfGate,
  type Rank,
  type RankedWords,
  ROOM_ASK,
} from "@/ui/design-system/kit/words";

import { PRICE_FACES, costLine, type Price } from "@/ui/design-system/kit/price-faces";
import type { ReactNode } from "react";
import { reasonLine } from "@/ui/design-system/kit/reasons";
import type { RealmPopulation } from "../realm/realm-population";
import { SideRank } from "../research/side-rank";

/**
 * One building on the build sheet (the owner's pick, option B · Cards): its painting and name with the population it
 * takes in the card's corner, what one more gives, its research as gems (one per side of a row that has sides), and a
 * band for where it stands: its resource prices, with the wait while the realm holds too little or the population it
 * lacks, a lock with the Barracks research purchases bought against its gate ("1/2 research"), or a tick when the realm already holds its one copy.
 */
export type BuildTile = {
  key: string;
  icon: IconMeaning;
  name: string;
  /** What the building does, in one line, on the card's tooltip. */
  /** Its hover line ("War hall: new armies start with Battle [I]"), a rank in it as its gem. */
  tip: RankedWords | string;
  /** What one more gives: a production rate or population; a training building's attribute alone (its gem is the tier). */
  gives: { icon: IconMeaning; value?: ReactNode };
  /**
   * Its research as gems, never words (owner, 27 October: "why no gems instead of the text ?"): each side of a row that
   * has two (Fields and Granary) with its mark and its gem, else its type's one gem, the research tile's.
   */
  gems: { side?: IconMeaning; tier: Rank }[];
  /** The population it takes; 0 takes none. */
  takes: number;
  standing:
    | {
        kind: "price";
        /** Each price, and whether the realm holds less than it: each line reads its own, white or red. */
        prices: readonly (Price & { short: boolean })[];
        /** Why the price is above its base, when it is. */
        raised?: string;
        /** The missing resource and its wait (unknown when nothing fills it), or population. */
        short?: { of: Price["of"]; wait: number | undefined } | { of: "population" };
      }
    | { kind: "level"; level: number }
    | { kind: "built" }
    | { kind: "locked"; gate: number; bought: number };
};

/**
 * The build sheet (wireframe 02): the realm's population in its head, the grid of building cards, each saying what it
 * gives and where it stands, and Build in the sheet's foot with the chosen one's price (the copy surcharge included; an
 * arrow marks a price that has risen, and the chosen one's foot says why in one line), so the verb never scrolls out of
 * view however many cards there are. When the
 * building cannot rise, the foot says what it needs against what there is, and its gold button carries the fix: the Hut
 * that houses it, the map that pays it, the Research that opens it. Build pressed on a building the realm has no free
 * population for asks instead, in the grid's place (RoomAsk): the Hut on this plot, or another pick.
 */
export const BuildView = ({
  population,
  scouting,
  tiles,
  chosen,
  onChoose,
  prices,
  refusal,
  sending,
  onBuild,
  onClose,
  ask,
}: {
  /** The realm's population, used of all it can hold; unknown is left out. */
  population: RealmPopulation | undefined;
  scouting?: { learned: bigint; kind: ScoutingSide; onChoose: (kind: ScoutingSide) => void };
  tiles: BuildTile[];
  chosen: number;
  onChoose: (index: number) => void;
  prices: readonly Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onBuild: () => void;
  onClose: () => void;
  /** Build was pressed on the chosen building with no free population: the ask stands where the grid stood. */
  ask?: RoomAskChoices;
}) => {
  const chosenStanding = tiles[chosen]?.standing;
  // Why the chosen building's price has risen, in sight under its price, never only on its arrow's hover.
  const raised = chosenStanding?.kind === "price" && chosenStanding.raised && (
    <span data-price-raised className="text-hud-label text-hud-warn">
      {chosenStanding.raised}
    </span>
  );
  const scoutingOptions = scouting ? availableScoutingChoices((row) => researchTier(scouting.learned, row)) : [];
  const needsScoutingChoice = scouting !== undefined && !scoutingOptions.some(({ side }) => side === scouting.kind);
  const choice = (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {tiles.map((tile, index) => (
          <TileButton key={tile.key} tile={tile} chosen={index === chosen} onChoose={() => onChoose(index)} />
        ))}
      </div>
      {scouting && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-hud-label">Common Scouting</legend>
          <div className="flex flex-wrap gap-2">
            {scoutingOptions.map(({ name, side, icon }) => (
              <HudButton
                key={name}
                kind={side === scouting.kind ? "secondary" : "quiet"}
                aria-pressed={side === scouting.kind}
                onClick={() => scouting.onChoose(side)}
              >
                <span className="flex flex-col items-center">
                  <IconGroup name={icon} size={18} />
                  {name}
                </span>
              </HudButton>
            ))}
          </div>
        </fieldset>
      )}
      {refusal ? (
        <HudWindowFoot
          note={
            <span className="flex flex-col items-start gap-1">
              <RefusalNote refusal={refusal} />
              {raised}
            </span>
          }
        >
          {refusal.fix && (
            <HudButton kind="primary" icon={refusal.fix.icon} onClick={refusal.fix.onFix}>
              {refusal.fix.word}
            </HudButton>
          )}
        </HudWindowFoot>
      ) : (
        <HudWindowFoot
          note={
            <span className="flex flex-col items-start gap-1">
              <HudCost line={costLine(prices)} />
              {raised}
            </span>
          }
        >
          <HudButton
            kind="primary"
            busy={sending ? BUILDING : undefined}
            disabled={needsScoutingChoice}
            onClick={onBuild}
          >
            {BUILD}
          </HudButton>
        </HudWindowFoot>
      )}
    </>
  );
  return (
    <HudSheet label={BUILD} onClose={onClose}>
      {population && (
        <header className="flex items-center justify-end">
          <HudChip
            icons={["person"]}
            label={POPULATION}
            tip={formatPopulationInWords(population.used, population.total)}
          >
            {formatPopulation(population.used, population.total)}
          </HudChip>
        </header>
      )}
      {ask && population ? <RoomAsk population={population} building={tiles[chosen]!} choices={ask} /> : choice}
    </HudSheet>
  );
};

/** The ask's two choices: the Hut on this plot (or, when it cannot be paid yet, picking it), or another building. */
export type RoomAskChoices = { hut: BuildTile; hutVerb: string; onHut: () => unknown; onAnother: () => void };

/**
 * Build pressed with no free population (Devcon feedback, 4 November 2026: the sheet swapped to a Hut with no word):
 * the realm full, what the chosen building takes, what a Hut adds, and the choice, never made for the player.
 */
const RoomAsk = ({
  population,
  building,
  choices: { hut, hutVerb, onHut, onAnother },
}: {
  population: RealmPopulation;
  building: BuildTile;
  choices: RoomAskChoices;
}) => (
  <HudConfirm
    question={ROOM_ASK.question}
    verb={hutVerb}
    cancel={ROOM_ASK.another}
    onConfirm={onHut}
    onCancel={onAnother}
  >
    <span className="flex items-center gap-3">
      <SemanticIcon name={hut.icon} size={64} />
      <span className="flex flex-col items-start gap-1.5">
        <HudChip tone="bad" icons={["person"]} label={POPULATION}>
          {formatPopulation(population.used, population.total)}
        </HudChip>
        <AskLine tile={building}>
          <HudChip icons={["person"]} label={`${building.name} ${POPULATION}`}>
            {formatShort(building.takes)}
          </HudChip>
        </AskLine>
        <AskLine tile={hut}>
          <HudChip tone="good" icons={["person"]} label={`${hut.name} ${POPULATION}`}>
            {hut.gives.value}
          </HudChip>
        </AskLine>
      </span>
    </span>
  </HudConfirm>
);

const AskLine = ({ tile, children }: { tile: BuildTile; children: ReactNode }) => (
  <span className="flex items-center gap-1.5 text-hud-body text-hud-ink">
    <SemanticIcon name={tile.icon} size={22} />
    {tile.name}
    {children}
  </span>
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
  <span {...rankedTip(tile.tip)} className="min-w-0">
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
        <SideRank key={gem.side ?? index} icon={gem.side} rank={gem.tier} />
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

/** The tone of a card's band: red while a resource is short, amber while population is, green once built. */
const bandTone = (standing: BuildTile["standing"]) =>
  standing.kind === "built"
    ? "good"
    : standing.kind === "price" && standing.short
      ? standing.short.of !== "population"
        ? "bad"
        : "warn"
      : undefined;

/**
 * Where a building stands, along its card's foot: its price and what it lacks, the Barracks purchases it waits for (its
 * refusal names the Barracks), or a tick.
 */
const Band = ({ standing }: { standing: BuildTile["standing"] }) => (
  <HudChip
    tone={bandTone(standing)}
    tip={standing.kind === "locked" ? needsResearchPurchases(BARRACKS, standing.bought, standing.gate) : undefined}
  >
    <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
      {standing.kind === "built" && <SemanticIcon name="check" size={16} />}
      {standing.kind === "locked" && (
        <>
          <SemanticIcon name="lock" size={14} />
          {purchasesOfGate(standing.bought, standing.gate)} research
        </>
      )}
      {standing.kind === "level" && (
        <>
          <SemanticIcon name="lock" size={14} />
          {needsRealmLevel(standing.level)}
        </>
      )}
      {standing.kind === "price" && <Price standing={standing} />}
    </span>
  </HudChip>
);

/**
 * Every resource price, each in red only while the realm holds less of it (owner, 4 November: "white if the player has
 * sufficient amount of that resource"), the arrow of a price that has risen, and the wait at a glance ("3h"; the chosen
 * building's line under the grid says it whole) or the population the realm lacks.
 */
const Price = ({ standing }: { standing: Extract<BuildTile["standing"], { kind: "price" }> }) => (
  <>
    <span className="flex flex-col gap-0.5">
      {standing.prices.map(({ of, amount, short }) => (
        <span
          key={of}
          data-short={short || undefined}
          className={cn("inline-flex items-center gap-1", short ? "text-hud-bad" : "text-hud-ink")}
          aria-label={`${formatExact(amount)} ${PRICE_FACES[of].word}`}
        >
          {PRICE_FACES[of].icon && <SemanticIcon name={PRICE_FACES[of].icon!} size={14} />}
          {formatCharge(amount)}
        </span>
      ))}
    </span>
    {standing.raised && (
      <span role="img" aria-label={PRICE_UP} data-tip={standing.raised} className="leading-none text-hud-warn">
        ↑
      </span>
    )}
    {standing.short && standing.short.of !== "population" && standing.short.wait !== undefined && (
      <span className="flex items-center gap-0.5">
        <SemanticIcon name="hourglass" size={12} />
        {formatShortDuration(standing.short.wait)}
      </span>
    )}
    {standing.short?.of === "population" && <SemanticIcon name="person" size={12} />}
  </>
);
