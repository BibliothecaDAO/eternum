import { formatAmount, REALM_LEVELS } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import { HudButton, HudCost, HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import { BUILDING_FIGURES, CASTLE, CASTLE_GIVES, LABOR, UPGRADE, UPGRADING } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { CompareRows } from "../building/compare-rows";
import { RefusedVerb } from "../refused-verb";
import { NodeTile } from "../research/research-panel";
import type { TreeNode } from "../research/research-tree";

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

/** Upgrade to the next level, a player's own castle's order: the next level, its price, and why it cannot run yet. */
export type CastleUpgradeOrder = {
  next: CastleSide;
  prices: Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onUpgrade: () => void;
};

/**
 * The castle's card (the owner's pick A, 26 October): one table of what it gives now against its next level (plots, army
 * slots, storage, max army size) with the labor it makes a minute in its corner, its own research, and Upgrade with its
 * price in the card's foot. When the realm cannot pay, the foot says what it needs against what is held and the exact wait
 * (RefusedVerb). The labor held is the top bar's, never repeated here (owner, 27 October), so the card fits a phone whole.
 * With no upgrade (the last level, or a castle the viewer does not own) there is no next column and no verb.
 */
export const CastleView = ({
  now,
  laborRate,
  research,
  upgrade,
  onClose,
}: {
  now: CastleSide;
  /** The labor the castle itself makes a minute ("+1.7/min"). */
  laborRate: string;
  /** The castle's own research, as tiles that open it on the Research page. */
  research?: ReactNode;
  upgrade?: CastleUpgradeOrder;
  onClose: () => void;
}) => (
  <HudSheet label={CASTLE} onClose={onClose}>
    <div data-castle-card className="flex flex-col gap-2">
      <CompareRows
        corner={
          <span
            data-tip={BUILDING_FIGURES.castleMakes(LABOR)}
            className="flex items-center gap-1.5 self-center text-hud-title tabular-nums text-hud-ink"
          >
            <Icon name="labor" size={24} />
            {laborRate}
          </span>
        }
        now={<LevelHead side={now} />}
        next={upgrade ? <LevelHead side={upgrade.next} /> : undefined}
        rows={castleRows(now, upgrade?.next ?? null)}
      />
      {research}
    </div>
    {upgrade &&
      (upgrade.refusal ? (
        <RefusedVerb word={UPGRADE} refusal={upgrade.refusal} />
      ) : (
        <HudWindowFoot note={<HudCost line={costLine(upgrade.prices)} />}>
          <HudButton kind="primary" busy={upgrade.sending ? UPGRADING : undefined} onClick={upgrade.onUpgrade}>
            {UPGRADE}
          </HudButton>
        </HudWindowFoot>
      ))}
  </HudSheet>
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

/**
 * The castle's own research (the Shrine, the Well, the reaches) in one row of compact tiles, each opening its node on the
 * Research page, where its choice and price are read.
 */
export const CastleResearch = ({ nodes, onOpen }: { nodes: readonly TreeNode[]; onOpen: (node: string) => void }) => (
  <div className="grid grid-flow-col auto-cols-fr gap-1.5">
    {nodes.map((node) => (
      <NodeTile key={node.key} node={node} picked={false} compact onPick={() => onOpen(node.key)} />
    ))}
  </div>
);
