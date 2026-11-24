import "./build-view.css";

import { formatCharge, formatExact, formatShortDuration, rankName } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCard,
  HudChip,
  HudCost,
  HudNotice,
  HudRanked,
  HudSheet,
  HudWindowFoot,
  rankedTip,
} from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  BUILD,
  BUILDING,
  BUILT,
  buildNamed,
  moreBelow,
  plotsUsed,
  type RankedWords,
} from "@/ui/design-system/kit/words";

import { PRICE_FACES, costLine, type Price } from "@/ui/design-system/kit/price-faces";
import type { ReactNode } from "react";
import { reasonLine } from "@/ui/design-system/kit/reasons";

const TILES_IN_VIEW = 6;

export type BuildTile = {
  key: string;
  icon: IconMeaning;
  name: string;
  does: RankedWords | string;
  gives: { icon: IconMeaning; value?: ReactNode };
  standing:
    | {
        kind: "price";
        prices: readonly (Price & { short: boolean })[];
        raised?: string;
        short?: { of: Price["of"]; wait: number | undefined };
      }
    | { kind: "built" }
    | { kind: "level"; level: number; prices: readonly Price[] };
};

export const BuildView = ({
  tiles,
  chosen,
  plots,
  onChoose,
  prices,
  refusal,
  sending,
  onBuild,
  onClose,
}: {
  tiles: BuildTile[];
  chosen: number;
  plots?: { used: number; total: number };
  onChoose: (index: number) => void;
  prices: readonly Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onBuild: () => void;
  onClose: () => void;
}) => {
  const chosenTile = tiles[chosen];
  const ordered = orderedTiles(tiles);
  const below = ordered.slice(TILES_IN_VIEW).map(({ tile }) => tile.name);
  return (
    <HudSheet label={BUILD} beside={plots && <HudChip>{plotsUsed(plots.used, plots.total)}</HudChip>} onClose={onClose}>
      <div data-build-sheet className="build-sheet">
        <div data-build-grid className="build-grid">
          {ordered.map(({ tile, index }) => (
            <TileButton key={tile.key} tile={tile} chosen={index === chosen} onChoose={() => onChoose(index)} />
          ))}
        </div>
        {below.length > 0 && (
          <p data-build-more className="build-more">
            <span aria-hidden="true">↓</span> {moreBelow(below)}
          </p>
        )}
        {chosenTile && (
          <ChosenFoot tile={chosenTile} prices={prices} refusal={refusal} sending={sending} onBuild={onBuild} />
        )}
      </div>
    </HudSheet>
  );
};

type IndexedTile = { tile: BuildTile; index: number };

const orderedTiles = (tiles: readonly BuildTile[]): IndexedTile[] => {
  const indexed = tiles.map((tile, index) => ({ tile, index }));
  const levelOf = ({ tile }: IndexedTile) => (tile.standing.kind === "level" ? tile.standing.level : 0);
  return indexed.toSorted((left, right) => levelOf(left) - levelOf(right));
};

const ChosenFoot = ({
  tile,
  prices,
  refusal,
  sending,
  onBuild,
}: {
  tile: BuildTile;
  prices: readonly Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onBuild: () => void;
}) => {
  const standing = tile.standing;
  const raised = standing.kind === "price" ? standing.raised : undefined;
  const cost = standing.kind !== "built" && !refusal?.fix?.prices && (
    <span className="inline-flex items-center gap-1">
      <HudCost line={costLine(prices)} />
      {raised && (
        <span role="img" aria-label={raised} data-price-raised={raised} data-tip={raised} className="text-hud-warn">
          ↑
        </span>
      )}
    </span>
  );
  const note = (
    <span className="flex flex-col items-start gap-0.5">
      {refusal && <RefusalNote refusal={refusal} />}
      {cost}
      <span data-build-does className="build-does">
        <HudRanked words={tile.does} />
      </span>
    </span>
  );
  if (refusal)
    return (
      <HudWindowFoot note={note}>
        {refusal.fix && (
          <HudButton kind="primary" icon={refusal.fix.icon} onClick={refusal.fix.onFix}>
            {refusal.fix.word}
          </HudButton>
        )}
      </HudWindowFoot>
    );
  return (
    <HudWindowFoot note={note}>
      <HudButton kind="primary" icon="build" busy={sending ? BUILDING : undefined} onClick={onBuild}>
        {buildNamed(tile.name)}
      </HudButton>
    </HudWindowFoot>
  );
};

const RefusalNote = ({ refusal }: { refusal: Refusal }) => (
  <span className="flex flex-col items-start gap-1">
    <HudNotice line={reasonLine(refusal.reason)} />
    {refusal.fix?.prices && <HudCost line={costLine(refusal.fix.prices)} />}
  </span>
);

const TileButton = ({ tile, chosen, onChoose }: { tile: BuildTile; chosen: boolean; onChoose: () => void }) => (
  <span {...rankedTip([`${tile.name}: `, ...asWords(tile.does)])} className="min-w-0">
    <HudCard
      size="sm"
      title={tile.name}
      picture={<SemanticIcon name={tile.icon} size={40} />}
      corner={tileBadge(tile.standing)}
      detail={
        <span className="flex w-full flex-col items-center gap-0.5">
          {tile.gives.value !== undefined && <Gives gives={tile.gives} />}
          {tile.standing.kind !== "built" && <TilePrice standing={tile.standing} />}
        </span>
      }
      selected={chosen}
      data-locked={tile.standing.kind === "level" || undefined}
      onClick={onChoose}
    />
  </span>
);

const asWords = (words: RankedWords | string): RankedWords => (typeof words === "string" ? [words] : words);

const tileBadge = (standing: BuildTile["standing"]) =>
  standing.kind === "built" ? (
    <HudChip tone="good">{BUILT}</HudChip>
  ) : standing.kind === "level" ? (
    <HudChip>{rankName(standing.level)}</HudChip>
  ) : undefined;

const Gives = ({ gives }: { gives: BuildTile["gives"] }) => (
  <span className="build-tile-gives">
    <SemanticIcon name={gives.icon} size={14} />
    {gives.value}
  </span>
);

const TilePrice = ({ standing }: { standing: Exclude<BuildTile["standing"], { kind: "built" }> }) => {
  const short = standing.kind === "price" ? standing.short : undefined;
  return (
    <span data-build-price className="build-tile-price">
      <PriceAmounts prices={standing.prices} />
      {short?.wait !== undefined && (
        <span className="flex items-center gap-0.5 text-hud-muted">
          <SemanticIcon name="hourglass" size={12} />
          {formatShortDuration(short.wait)}
        </span>
      )}
    </span>
  );
};

type PriceTag = Price & { short?: boolean };

const PriceAmounts = ({ prices }: { prices: readonly PriceTag[] }) => {
  if (prices.length === 0) return <span className="text-hud-ink">{costLine(prices)}</span>;
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 tabular-nums">
      {prices.map(({ of, amount, short }) => (
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
  );
};
