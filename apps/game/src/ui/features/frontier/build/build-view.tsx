import { rankName } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact, formatCharge, formatShort, formatShortDuration } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCard,
  HudChip,
  HudConfirm,
  HudCost,
  HudNotice,
  HudRanked,
  HudSheet,
  HudTier,
  HudWindowFoot,
  rankedTip,
} from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import { BUILD, BUILDING, PRICE_UP, type Rank, type RankedWords, ROOM_ASK } from "@/ui/design-system/kit/words";

import { PRICE_FACES, costLine, type Price } from "@/ui/design-system/kit/price-faces";
import type { ReactNode } from "react";
import { reasonLine } from "@/ui/design-system/kit/reasons";

export type BuildTile = {
  key: string;
  icon: IconMeaning;
  name: string;
  /** What the building does, in one line, on the card's tooltip. */
  /** Its hover line ("War hall: new armies start with Battle [I]"), a rank in it as its gem. */
  tip: RankedWords | string;
  /** What one more gives: a production rate or population; a training building's attribute alone (its gem is the tier). */
  gives: { icon: IconMeaning; value?: ReactNode };
  gems: { tier: Rank }[];
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
    | { kind: "built" }
    | { kind: "level"; level: number };
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
  const chosenTile = tiles[chosen];
  const chosenStanding = chosenTile?.standing;
  const indexed = tiles.map((tile, index) => ({ tile, index }));
  const unlocked = indexed.filter(({ tile }) => tile.standing.kind !== "level");
  const locked = indexed.filter(({ tile }) => tile.standing.kind === "level");
  const raised = chosenStanding?.kind === "price" && chosenStanding.raised && (
    <span data-price-raised className="text-hud-label text-hud-warn">
      {chosenStanding.raised}
    </span>
  );
  const choice = (
    <div data-build-sheet className="ui-build-sheet">
      <div data-build-grid className="grid grid-cols-3 gap-1.5 lg:gap-2">
        {unlocked.map(({ tile, index }) => (
          <TileButton key={tile.key} tile={tile} chosen={index === chosen} onChoose={() => onChoose(index)} />
        ))}
      </div>
      {chosenTile && <ChosenSummary tile={chosenTile} />}
      {locked.length > 0 && <LockedUnlocks items={locked} chosen={chosen} onChoose={onChoose} />}
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
          <HudButton kind="primary" busy={sending ? BUILDING : undefined} onClick={onBuild}>
            {BUILD}
          </HudButton>
        </HudWindowFoot>
      )}
    </div>
  );
  return (
    <HudSheet label={BUILD} onClose={onClose}>
      {ask ? <RoomAsk building={tiles[chosen]!} choices={ask} /> : choice}
    </HudSheet>
  );
};

type IndexedTile = { tile: BuildTile; index: number };

const ChosenSummary = ({ tile }: { tile: BuildTile }) => {
  const hasTip = typeof tile.tip === "string" ? tile.tip.trim().length > 0 : tile.tip.length > 0;
  return (
    <div data-build-chosen className="ui-build-chosen">
      <SemanticIcon name={tile.icon} size={18} />
      <span className="min-w-0 flex-1 truncate">
        {hasTip ? (
          <HudRanked words={tile.tip} />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-hud-ink">{tile.name}</span>
            {tile.gives.value !== undefined && <span className="text-hud-muted">{tile.gives.value}</span>}
          </span>
        )}
      </span>
    </div>
  );
};

const groupLockedByLevel = (items: readonly IndexedTile[]): [number, IndexedTile[]][] => {
  const groups = new Map<number, IndexedTile[]>();
  for (const item of items) {
    if (item.tile.standing.kind !== "level") continue;
    const list = groups.get(item.tile.standing.level) ?? [];
    list.push(item);
    groups.set(item.tile.standing.level, list);
  }
  return [...groups.entries()].toSorted(([left], [right]) => left - right);
};

const LockedUnlocks = ({
  items,
  chosen,
  onChoose,
}: {
  items: readonly IndexedTile[];
  chosen: number;
  onChoose: (index: number) => void;
}) => (
  <div data-build-locked className="ui-build-locked">
    {groupLockedByLevel(items).map(([level, group]) => (
      <div key={level} className="ui-build-locked__group">
        <HudChip icons={["lock"]}>{rankName(level)}</HudChip>
        <span className="ui-build-locked__items">
          {group.map(({ tile, index }) => (
            <span key={tile.key} {...rankedTip(tile.tip)}>
              <HudButton
                kind="secondary"
                size="sm"
                icon={tile.icon}
                aria-pressed={index === chosen}
                onClick={() => onChoose(index)}
              >
                {tile.name}
              </HudButton>
            </span>
          ))}
        </span>
      </div>
    ))}
  </div>
);

/** The ask's two choices: the Hut on this plot (or, when it cannot be paid yet, picking it), or another building. */
export type RoomAskChoices = { hut: BuildTile; hutVerb: string; onHut: () => unknown; onAnother: () => void };

/**
 * Build pressed with no free population (Devcon feedback, 4 November 2026: the sheet swapped to a Hut with no word):
 * the realm full, what the chosen building takes, what a Hut adds, and the choice, never made for the player.
 */
const RoomAsk = ({
  building,
  choices: { hut, hutVerb, onHut, onAnother },
}: {
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
        <AskLine tile={building}>
          <HudChip icons={["person"]}>{formatShort(building.takes)}</HudChip>
        </AskLine>
        <AskLine tile={hut}>
          <HudChip tone="good" icons={["person"]}>
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

const Gives = ({ tile }: { tile: BuildTile }) => (
  <span className="flex flex-col items-center gap-0.5">
    <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
      <SemanticIcon name={tile.gives.icon} size={14} />
      {tile.gives.value}
    </span>
    <span className="flex items-center justify-center gap-x-1.5 whitespace-nowrap">
      {tile.gems.map((gem, index) => (
        <HudTier key={index} tier={gem.tier} />
      ))}
    </span>
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
  <HudChip tone={bandTone(standing)}>
    <span className="flex items-center gap-1 whitespace-nowrap tabular-nums">
      {standing.kind === "level" && (
        <>
          <SemanticIcon name="lock" size={14} />
          {rankName(standing.level)}
        </>
      )}
      {standing.kind === "built" && <SemanticIcon name="check" size={16} />}
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
    <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
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
