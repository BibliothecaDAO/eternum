import "./build-view.css";

import { rankName } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact, formatCharge, formatShortDuration } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCard,
  HudChip,
  HudCost,
  HudNotice,
  HudRanked,
  HudSheet,
  HudTier,
  HudWindowFoot,
  rankedTip,
} from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import { BUILD, BUILDING, PRICE_UP, type Rank, type RankedWords } from "@/ui/design-system/kit/words";

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
  gives: { icon: IconMeaning; value?: ReactNode };
  gems: { tier: Rank }[];
  standing:
    | {
        kind: "price";
        /** Each price, and whether the realm holds less than it: each line reads its own, white or red. */
        prices: readonly (Price & { short: boolean })[];
        /** Why the price is above its base, when it is. */
        raised?: string;
        short?: { of: Price["of"]; wait: number | undefined };
      }
    | { kind: "built" }
    | { kind: "level"; level: number };
};

export const BuildView = ({
  tiles,
  chosen,
  onChoose,
  prices,
  refusal,
  sending,
  onBuild,
  onClose,
}: {
  tiles: BuildTile[];
  chosen: number;
  onChoose: (index: number) => void;
  prices: readonly Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onBuild: () => void;
  onClose: () => void;
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
    <div data-build-sheet className="build-sheet">
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
      {choice}
    </HudSheet>
  );
};

type IndexedTile = { tile: BuildTile; index: number };

const ChosenSummary = ({ tile }: { tile: BuildTile }) => {
  const hasTip = typeof tile.tip === "string" ? tile.tip.trim().length > 0 : tile.tip.length > 0;
  return (
    <div data-build-chosen className="build-chosen">
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
  <div data-build-locked className="build-locked">
    {groupLockedByLevel(items).map(([level, group]) => (
      <div key={level} className="build-locked__group">
        <HudChip icons={["lock"]}>{rankName(level)}</HudChip>
        <span className="build-locked__items">
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

const bandTone = (standing: BuildTile["standing"]) =>
  standing.kind === "built" ? "good" : standing.kind === "price" && standing.short ? "bad" : undefined;

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
    {standing.short?.wait !== undefined && (
      <span className="flex items-center gap-0.5">
        <SemanticIcon name="hourglass" size={12} />
        {formatShortDuration(standing.short.wait)}
      </span>
    )}
  </>
);
