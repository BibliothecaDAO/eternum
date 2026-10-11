import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { type Reason, ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { type Tier, TierChip } from "@/ui/design-system/kit/tier-chip";
import { ESSENCE, LABOR, RESEARCH, RESEARCHING } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

/** A building type's row: its tier, the sides taken at each tier, and the next tier's Essence and labor. */
export type TreeRow = {
  key: string;
  icon: IconCode;
  name: string;
  tier: Tier;
  sides: readonly IconCode[];
  /** The next tier's price; undefined at legendary. */
  next: { essence: number; labor: number } | undefined;
  /** The tier is a choice of two sides, final for the season. */
  choice: boolean;
};

/** A castle row: a shrine, a well or a reach beyond the spire, its Essence price, learned or locked. */
export type CastleNode = {
  key: string;
  icon: IconCode;
  /** A word (Shrine, Well) or the reach's numeral (I, II, III). */
  label: string;
  essence: number;
  state: "learned" | "open" | "locked";
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
  <section
    aria-label={RESEARCH}
    className="frontier-card pointer-events-auto flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto !rounded-xl p-2"
  >
    <header className="flex h-12 shrink-0 items-center gap-2">
      <h2 className="frontier-title flex-1 !text-[20px]">{RESEARCH}</h2>
      <Chip icons={["Es"]} label={ESSENCE} value={formatAmount(essence)} />
      <Chip icons={["La"]} label={LABOR} value={formatAmount(labor)} />
    </header>
    {rows.map((row) => (
      <Row key={row.key} row={row} chosen={row.key === chosen} onOpen={() => onRow(row.key)} />
    ))}
    <div className="flex shrink-0 items-stretch gap-1">
      {castle.map((node, index) => (
        <span key={node.key} className="contents">
          {index === 2 && <i aria-hidden className="w-px self-stretch bg-kit-line2" />}
          <Node node={node} onOpen={() => onCastle(node.key)} />
        </span>
      ))}
    </div>
  </section>
);

const Row = ({ row, chosen, onOpen }: { row: TreeRow; chosen: boolean; onOpen: () => void }) => (
  <button
    type="button"
    aria-label={row.name}
    aria-pressed={chosen}
    onClick={onOpen}
    className={cn(
      "frontier-card flex h-[58px] shrink-0 items-center gap-1.5 !rounded-xl px-2 text-left",
      chosen && "!border-2 !border-kit-hot",
    )}
  >
    <KitIcon code={row.icon} size={26} />
    <span className="flex w-24 shrink-0 flex-col gap-0.5">
      <span className="text-[12px] font-semibold text-kit-cream">{row.name}</span>
      <span className="flex gap-0.5">
        {row.sides.map((side, index) => (
          <KitIcon key={index} code={side} size={18} />
        ))}
      </span>
    </span>
    <span className="flex-1" />
    <span className="flex flex-col items-end gap-[3px]">
      <TierChip tier={row.tier} showWord />
      {row.next ? (
        <span className="flex items-center gap-1 text-[14px] tabular-nums text-kit-cream">
          {row.choice && <KitIcon code="Fx" size={16} />}
          <KitIcon code="Es" size={14} />
          {formatAmount(row.next.essence)}
          <KitIcon code="La" size={14} />
          {formatAmount(row.next.labor)}
        </span>
      ) : (
        <KitIcon code="Ok" size={18} />
      )}
    </span>
  </button>
);

const Node = ({ node, onOpen }: { node: CastleNode; onOpen: () => void }) => (
  <button
    type="button"
    aria-label={node.label}
    onClick={onOpen}
    className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1", node.state === "locked" && "opacity-50")}
  >
    <span className="relative flex size-11 items-center justify-center rounded-full border border-kit-line2 bg-kit-ground">
      <KitIcon code={node.icon} size={20} />
      {node.state !== "open" && (
        <KitIcon code={node.state === "learned" ? "Ok" : "Lk"} size={16} className="absolute -right-1 -top-1" />
      )}
    </span>
    <span className="text-[12px] font-semibold text-kit-cream">{node.label}</span>
    <span className="flex items-center gap-0.5 text-[14px] tabular-nums text-kit-cream">
      <KitIcon code="Es" size={14} />
      {formatAmount(node.essence)}
    </span>
  </button>
);

/**
 * A castle row's sheet: what it unlocks on the map (a shrine's XP, a well's stamina, a reach), and Research with its
 * Essence price; when the realm cannot pay, the Essence held against it and the step take Research's place.
 */
export const CastleNodeSheet = ({
  node,
  gives,
  short,
  sending,
  onResearch,
  onClose,
}: {
  node: CastleNode;
  gives: ReactNode;
  short?: { reason: Extract<Reason, { kind: "short" }>; step: ReactNode };
  sending: boolean;
  onResearch: () => void;
  onClose: () => void;
}) => (
  <Sheet label={node.label} onClose={onClose}>
    <header className="flex items-center gap-2.5">
      <KitIcon code={node.icon} size={30} />
      <h2 className="frontier-title flex-1 !text-[20px]">{node.label}</h2>
    </header>
    <div className="flex items-center justify-center gap-2">{gives}</div>
    {node.state === "learned" ? (
      <span className="flex justify-center">
        <KitIcon code="Ok" size={26} />
      </span>
    ) : short ? (
      <ReasonPlate reason={short.reason} step={short.step} />
    ) : (
      node.state === "open" && (
        <Button
          role="primary"
          icon="Rs"
          word={RESEARCH}
          prices={[{ of: "essence", amount: node.essence }]}
          loading={sending ? RESEARCHING : undefined}
          onClick={onResearch}
        />
      )
    )}
  </Sheet>
);
