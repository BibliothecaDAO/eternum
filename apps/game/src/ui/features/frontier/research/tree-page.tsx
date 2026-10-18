import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { formatAmount } from "@/ui/design-system/kit/amount";
import {
  HudButton,
  HudChip,
  HudPanel,
  HudRarity,
  HudRing,
  HudRow,
  HudSheet,
} from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { ESSENCE, LABOR, RESEARCH, RESEARCHING, UPGRADING } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { hudPrices } from "../hud-prices";
import { RefusedVerb } from "../refused-verb";

/** A building type's row: its tier, the sides taken at each tier, and the next tier's Essence and labor. */
export type TreeRow = {
  key: string;
  icon: IconMeaning;
  name: string;
  /** What the row's next tier gives, in one line, on its tooltip. */
  tip: string;
  tier: Tier;
  sides: readonly IconMeaning[];
  /** The next tier's price; undefined at legendary. */
  next: { essence: number; labor: number } | undefined;
  /** The tier is a choice of two sides, final for the season. */
  choice: boolean;
  /** Its next tier is being researched: sent, its outcome not known yet. */
  researching?: boolean;
};

/** A castle row: a shrine, a well or a reach beyond the spire, its Essence price, learned or locked. */
export type CastleNode = {
  key: string;
  icon: IconMeaning;
  /** A word (Shrine, Well) or the reach's numeral (I, II, III). */
  label: string;
  /** What researching it opens, in one line, on its tooltip. */
  tip: string;
  essence: number;
  state: "learned" | "open" | "locked";
  /** It is being researched: sent, its outcome not known yet. */
  researching?: boolean;
};

/**
 * The castle's tree (wireframe 09), a nav page: the realm's Essence and labor held, a row per building type that
 * stands (its tier, the sides taken, the next price and the seal where it is a choice), then the castle rows Research
 * unlocks (shrine, well, Ethereal I to III). A row opens its sheet over the page.
 */
export const TreePage = ({
  essence,
  labor,
  rows,
  castle,
  chosen,
  onRow,
  onCastle,
}: {
  essence: number | undefined;
  labor: number | undefined;
  rows: readonly TreeRow[];
  castle: readonly CastleNode[];
  chosen?: string;
  onRow: (key: string) => void;
  onCastle: (key: string) => void;
}) => (
  <HudPanel
    label={RESEARCH}
    title={RESEARCH}
    cue={
      <span className="flex gap-1">
        <HudChip icons={["essence"]} label={ESSENCE}>
          {formatAmount(essence)}
        </HudChip>
        <HudChip icons={["labor"]} label={LABOR}>
          {formatAmount(labor)}
        </HudChip>
      </span>
    }
    collapsible={false}
    className="pointer-events-auto flex min-h-0 flex-1 flex-col"
    bodyClassName="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto"
  >
    {rows.map((row) => (
      <Row key={row.key} row={row} chosen={row.key === chosen} onOpen={() => onRow(row.key)} />
    ))}
    <div className="flex shrink-0 items-start justify-around gap-1 border-t border-hud-divider pt-2">
      {castle.map((node) => (
        <Node key={node.key} node={node} onOpen={() => onCastle(node.key)} />
      ))}
    </div>
  </HudPanel>
);

/** A building type: its sides taken, its tier, and the next tier's price (or what is under way, or done). */
const Row = ({ row, chosen, onOpen }: { row: TreeRow; chosen: boolean; onOpen: () => void }) => (
  <HudRow
    lead={<SemanticIcon name={row.icon} size={26} />}
    title={row.name}
    detail={
      row.sides.length > 0 ? (
        <span className="flex gap-0.5">
          {row.sides.map((side, index) => (
            <SemanticIcon key={index} name={side} size={18} />
          ))}
        </span>
      ) : undefined
    }
    selected={chosen}
    tip={row.tip}
    onClick={onOpen}
    trail={
      <span className="flex flex-col items-end gap-1">
        <HudRarity tier={row.tier} word />
        {row.researching ? (
          <InFlightWord word={UPGRADING} />
        ) : row.next ? (
          <span className="flex items-center gap-1 text-hud-label tabular-nums">
            {row.choice && <SemanticIcon name="final-seal" size={16} />}
            <SemanticIcon name="essence" size={14} />
            {formatAmount(row.next.essence)}
            <SemanticIcon name="labor" size={14} />
            {formatAmount(row.next.labor)}
          </span>
        ) : (
          <SemanticIcon name="check" size={18} />
        )}
      </span>
    }
  />
);

/** A castle row as a ring: learned carries a check, locked a lock; its price, or what is under way, at its foot. */
const Node = ({ node, onOpen }: { node: CastleNode; onOpen: () => void }) => (
  <span className="flex flex-col items-center gap-1">
    <HudRing
      icon={node.icon}
      label={node.label}
      tip={node.tip}
      corner={
        node.state === "open" ? undefined : (
          <SemanticIcon name={node.state === "learned" ? "check" : "lock"} size={14} />
        )
      }
      foot={
        node.researching ? (
          <InFlightWord word={RESEARCHING} />
        ) : (
          <span className="flex items-center gap-0.5 tabular-nums">
            <SemanticIcon name="essence" size={12} />
            {formatAmount(node.essence)}
          </span>
        )
      }
      onClick={onOpen}
    />
    <span className="text-hud-label">{node.label}</span>
  </span>
);

/** In the price's place on a row whose research is in flight: the word of what is under way. */
const InFlightWord = ({ word }: { word: string }) => (
  <span role="status" className="text-hud-label text-hud-warn">
    {word}
  </span>
);

/**
 * A castle row's sheet: what it unlocks on the map (a shrine's XP, a well's stamina, a reach), and Research with its
 * Essence price. While it cannot run, Research stays, dimmed, with its price, over the one line that says why (the
 * Essence it needs against what is held, or the row that comes first) and the fix where there is one.
 */
export const CastleNodeSheet = ({
  node,
  gives,
  refusal,
  sending,
  onResearch,
  onClose,
}: {
  node: CastleNode;
  gives: ReactNode;
  refusal?: Refusal;
  sending: boolean;
  onResearch: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={node.label} onClose={onClose}>
    <SemanticIcon name={node.icon} size={30} />
    <div className="flex items-center justify-center gap-2">{gives}</div>
    {node.state === "learned" ? (
      <span className="flex justify-center">
        <SemanticIcon name="check" size={26} />
      </span>
    ) : refusal ? (
      <RefusedVerb
        icon="research"
        word={RESEARCH}
        prices={[{ of: "essence", amount: node.essence }]}
        refusal={refusal}
      />
    ) : (
      <HudButton
        kind="primary"
        icon="research"
        prices={hudPrices([{ of: "essence", amount: node.essence }])}
        busy={sending ? RESEARCHING : undefined}
        onClick={onResearch}
      >
        {RESEARCH}
      </HudButton>
    )}
  </HudSheet>
);
