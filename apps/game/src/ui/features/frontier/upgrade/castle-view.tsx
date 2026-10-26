import { formatAmount, REALM_LEVELS } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import { HudButton, HudCost, HudMeter, HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import { BUILDING_FIGURES, CASTLE, CASTLE_GIVES, LABOR, UPGRADE, UPGRADING } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { CompareRows } from "../building/compare-rows";
import { RefusedVerb } from "../refused-verb";

/** The castle at a level: its art and level, the plots it opens, its army slots, its storage, its max army size. */
export type CastleSide = {
  level: number;
  art: IconMeaning;
  plots: number;
  slots: number;
  /** What the castle holds of each resource at this level, before the Granary and Storeroom; unknown is undefined. */
  limit: number | undefined;
  maxArmySize: number;
};

/** What the castle itself makes now: its labor a minute, and the labor it holds against its storage. */
export type CastleMakes = { rate: string; held: number | undefined; storage: number | undefined };

/**
 * The castle's card (the owner's pick A, 26 October): the labor it makes and holds, then one table of what it gives now
 * against its next level (plots, army slots, storage, max army size), its own research, and Upgrade with its price in
 * the card's foot. When the realm cannot pay, the foot says what it needs against what is held and the exact wait
 * (RefusedVerb), with the map as its button where a reveal pays labor. At the last level there is no next column and no
 * verb.
 */
export const CastleView = ({
  now,
  next,
  makes,
  research,
  prices,
  refusal,
  sending,
  onUpgrade,
  onClose,
}: {
  now: CastleSide;
  next: CastleSide | null;
  makes: CastleMakes;
  /** The castle's own research, as tiles that open it on the Research page. */
  research?: ReactNode;
  prices: Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={CASTLE} onClose={onClose}>
    <div data-castle-card className="flex flex-col gap-2">
      <LaborMade makes={makes} />
      <CompareRows
        now={<LevelHead side={now} />}
        next={next ? <LevelHead side={next} /> : undefined}
        rows={castleRows(now, next)}
      />
      {research}
    </div>
    {next &&
      (refusal ? (
        <RefusedVerb word={UPGRADE} prices={prices} refusal={refusal} />
      ) : (
        <HudWindowFoot note={<HudCost line={costLine(prices)} />}>
          <HudButton kind="primary" busy={sending ? UPGRADING : undefined} onClick={onUpgrade}>
            {UPGRADE}
          </HudButton>
        </HudWindowFoot>
      ))}
  </HudSheet>
);

/** The castle's labor a minute over its storage's meter: held against what it holds. */
const LaborMade = ({ makes }: { makes: CastleMakes }) => (
  <div className="flex items-center gap-2">
    <Icon name="labor" size={28} />
    <div className="flex flex-1 flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-hud-title tabular-nums text-hud-ink">{makes.rate}</span>
        <span className="text-hud-label tabular-nums text-hud-muted">
          {formatAmount(makes.held)} / {formatAmount(makes.storage)}
        </span>
      </span>
      <HudMeter
        label={BUILDING_FIGURES.held(LABOR)}
        amount={
          makes.held === undefined || makes.storage === undefined
            ? undefined
            : { current: makes.held, max: makes.storage }
        }
      />
    </div>
  </div>
);

/** A level's head in the table: its painting and its name. */
const LevelHead = ({ side }: { side: CastleSide }) => (
  <span className="flex flex-col items-center">
    <Icon name={side.art} alt="" size={28} />
    {REALM_LEVELS[side.level]}
  </span>
);

/** What a level gives, row by row, now and at the next level, each that grows lit. */
const castleRows = (now: CastleSide, next: CastleSide | null) => {
  const row = (icon: IconMeaning, word: string, at: (side: CastleSide) => number | undefined) => ({
    icon,
    word,
    now: formatAmount(at(now)),
    next: next ? formatAmount(at(next)) : undefined,
    grows: next !== null && (at(next) ?? 0) > (at(now) ?? 0),
  });
  return [
    row("hexagon", CASTLE_GIVES.plots, (side) => side.plots),
    row("army-capacity", CASTLE_GIVES.armySlots, (side) => side.slots),
    row("resources", CASTLE_GIVES.storage, (side) => side.limit),
    row("troops", CASTLE_GIVES.maxArmySize, (side) => side.maxArmySize),
  ];
};
