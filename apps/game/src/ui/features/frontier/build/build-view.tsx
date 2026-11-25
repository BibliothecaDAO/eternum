import "./build-view.css";

import { formatCharge, formatExact, formatShortDuration, rankName } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCard,
  HudChip,
  HudPrice,
  HudRanked,
  HudSheet,
  HudWindowFoot,
  rankedTip,
} from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import {
  BUILD,
  BUILD_GROUPS,
  BUILDING,
  BUILT,
  ONE_PER_REALM_MARK,
  plotsUsed,
  requiresRank,
  type RankedWords,
} from "@/ui/design-system/kit/words";

import { PRICE_FACES, costLine, type Price } from "@/ui/design-system/kit/price-faces";
import type { ReactNode } from "react";
import { useHudLayout } from "@/hooks/helpers/use-compact-hud";
import { RefusedVerb } from "../refused-verb";
import type { BuildGroup } from "./build-options";

export type BuildTile = {
  key: string;
  group: BuildGroup;
  opensAt: number;
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
  const desktop = useHudLayout() === "desktop";
  return (
    <HudSheet
      label={BUILD}
      beside={
        plots && (
          <HudChip icons={["hexagon"]} tip={plotsUsed(plots.used, plots.total)}>
            {`${plots.used} / ${plots.total}`}
          </HudChip>
        )
      }
      onClose={onClose}
    >
      <div data-build-sheet className="build-sheet">
        <div className="build-groups">
          {groupedTiles(tiles).map(({ group, entries }) => (
            <section key={group} data-build-group={group} aria-label={BUILD_GROUPS[group]} className="build-group">
              <header className="build-group__head">
                <SemanticIcon name={GROUP_ICONS[group]} size={16} />
                <span className="build-group__word">{BUILD_GROUPS[group]}</span>
              </header>
              <div data-build-grid className="build-grid">
                {entries.map(({ tile, index }) => (
                  <TileButton
                    key={tile.key}
                    tile={tile}
                    priced={desktop}
                    chosen={index === chosen}
                    onChoose={() => onChoose(index)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        {chosenTile && (
          <ChosenFoot tile={chosenTile} prices={prices} refusal={refusal} sending={sending} onBuild={onBuild} />
        )}
      </div>
    </HudSheet>
  );
};

type IndexedTile = { tile: BuildTile; index: number };

const GROUP_ICONS = { economy: "wheat", army: "barracks", unique: "crown" } as const satisfies Record<
  BuildGroup,
  IconMeaning
>;
const GROUP_ORDER = Object.keys(GROUP_ICONS) as BuildGroup[];

const groupedTiles = (tiles: readonly BuildTile[]): { group: BuildGroup; entries: IndexedTile[] }[] => {
  const indexed = tiles.map((tile, index) => ({ tile, index }));
  return GROUP_ORDER.map((group) => ({
    group,
    entries: indexed
      .filter(({ tile }) => tile.group === group)
      .toSorted((left, right) => left.tile.opensAt - right.tile.opensAt),
  })).filter(({ entries }) => entries.length > 0);
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
  const note = (
    <span data-build-chosen className="build-chosen">
      <b className="build-chosen__name">{tile.name}</b>
      <ChosenLine tile={tile} prices={prices} />
      {refusal?.fix?.prices && <HudPrice prices={refusal.fix.prices} />}
    </span>
  );
  if (refusal) return <RefusedVerb word={BUILD} icon="build" refusal={refusal} note={note} />;
  return (
    <HudWindowFoot note={note}>
      <HudButton kind="primary" icon="build" busy={sending ? BUILDING : undefined} onClick={onBuild}>
        {BUILD}
      </HudButton>
    </HudWindowFoot>
  );
};

const ChosenLine = ({ tile, prices }: { tile: BuildTile; prices: readonly Price[] }) => {
  const raised = tile.standing.kind === "price" ? tile.standing.raised : undefined;
  return (
    <span className="build-chosen__line">
      {tile.standing.kind !== "built" && <HudPrice prices={prices} />}
      {raised && (
        <span role="img" aria-label={raised} data-price-raised={raised} data-tip={raised} className="text-hud-warn">
          ↑
        </span>
      )}
      <span data-build-does className="build-does">
        {tile.gives.value !== undefined ? <Gives gives={tile.gives} /> : <HudRanked words={tile.does} />}
      </span>
    </span>
  );
};

const TileButton = ({
  tile,
  priced,
  chosen,
  onChoose,
}: {
  tile: BuildTile;
  priced: boolean;
  chosen: boolean;
  onChoose: () => void;
}) => (
  <span {...rankedTip([`${tile.name}: `, ...asWords(tile.does)])} className="min-w-0">
    <HudCard
      size="sm"
      title={tile.name}
      picture={<SemanticIcon name={tile.icon} size={40} />}
      corner={<TileBadge tile={tile} />}
      detail={
        <span className="build-tile-detail">
          {tile.standing.kind === "level" && (
            <span data-build-needs className="build-tile-needs">
              {requiresRank(rankName(tile.standing.level))}
            </span>
          )}
          {tile.gives.value !== undefined && tile.standing.kind !== "level" && <Gives gives={tile.gives} />}
          {priced && tile.standing.kind !== "built" && <TilePrice standing={tile.standing} />}
        </span>
      }
      selected={chosen}
      tone={chosen && tile.standing.kind === "price" && tile.standing.short ? "bad" : undefined}
      data-locked={tile.standing.kind === "level" || undefined}
      onClick={onChoose}
    />
  </span>
);

const asWords = (words: RankedWords | string): RankedWords => (typeof words === "string" ? [words] : words);

const TileBadge = ({ tile: { standing, group } }: { tile: BuildTile }) => {
  if (standing.kind === "price")
    return group === "unique" ? (
      <span className="build-badge" data-standing="unique">
        {ONE_PER_REALM_MARK}
      </span>
    ) : null;
  const line = standing.kind === "built" ? BUILT : rankName(standing.level);
  return (
    <span role="img" aria-label={line} data-tip={line} className="build-badge" data-standing={standing.kind}>
      <SemanticIcon name={standing.kind === "built" ? "check" : "lock"} size={12} />
    </span>
  );
};

const Gives = ({ gives }: { gives: BuildTile["gives"] }) => (
  <span className="build-tile-gives">
    {gives.value}
    <SemanticIcon name={gives.icon} size={16} />
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
          {PRICE_FACES[of].icon && <SemanticIcon name={PRICE_FACES[of].icon!} size={15} />}
          {formatCharge(amount)}
        </span>
      ))}
    </span>
  );
};
