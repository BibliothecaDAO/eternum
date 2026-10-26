import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudPanel, HudRarity } from "@/ui/design-system/kit/hud-elements";
import { ESSENCE, LABOR, RESEARCH, RESEARCH_TREE, TIER_WORDS } from "@/ui/design-system/kit/words";
import { ResearchPanel } from "@/ui/features/frontier/research/research-panel";
import {
  firstMissing,
  type Branch,
  type Need,
  needLine,
  type TreeNode,
} from "@/ui/features/frontier/research/research-tree";
import { formatAmount } from "@bibliothecadao/types";
import { useState } from "react";

/**
 * Research panel drafts for the owner's pick (owner, 2026-10-26: "I dont like how the research panel is it's too long
 * like you need to click a building then scroll to see the choices"), each on the game's own tree:
 *
 *   - today: the shipped panel, the tree with the picked node's detail under it;
 *   - choice-first: the picked node's choice pinned at the top, the tree under it; a tap swaps the choice in place;
 *   - cards: no detail step, each building a row with its sides as its buttons; done and locked rows folded;
 *   - overlay: the tree as today, the choice opening over it from the panel's foot, closed with its X.
 */
export type ResearchOption = "today" | "choice-first" | "cards" | "overlay";

export const RESEARCH_OPTIONS: readonly { option: ResearchOption; name: string; line: string }[] = [
  { option: "today", name: "Today", line: "Tree, then the picked building's detail under it" },
  { option: "choice-first", name: "A · Choice first", line: "The choice pinned on top, the tree under it" },
  { option: "cards", name: "B · Cards", line: "Each building a row, its sides its buttons" },
  { option: "overlay", name: "C · Choice over the tree", line: "The tree as today, the choice rising over it" },
];

interface PanelProps {
  nodes: readonly TreeNode[];
  essence: number;
  labor: number;
}

/** A research draft by name, on the realm's tree: the page the rail (desktop) or the phone's page draws. */
export const ResearchOptionPanel = ({ option, ...props }: PanelProps & { option: ResearchOption }) => {
  switch (option) {
    case "today":
      return <TodayPanel {...props} />;
    case "choice-first":
      return <ChoiceFirstPanel {...props} />;
    case "cards":
      return <CardsPanel {...props} />;
    case "overlay":
      return <OverlayPanel {...props} />;
  }
};

/** The node a panel opens on: the first the realm can research now, else the first it saves for, as the game opens it. */
const openingNode = (nodes: readonly TreeNode[]) =>
  (nodes.find(({ state }) => state === "ready") ?? nodes.find(({ state }) => state === "short") ?? nodes[0]!).key;

const TodayPanel = ({ nodes, essence, labor }: PanelProps) => {
  const [picked, setPicked] = useState(openingNode(nodes));
  return (
    <ResearchPanel
      nodes={nodes}
      essence={essence}
      labor={labor}
      picked={picked}
      onPick={setPicked}
      sending={new Set()}
      fixFor={() => undefined}
      onResearch={() => undefined}
    />
  );
};

/** A: the choice a player came to make stands first, never scrolled; the tree under it picks what the choice shows. */
const ChoiceFirstPanel = ({ nodes, essence, labor }: PanelProps) => {
  const [picked, setPicked] = useState(openingNode(nodes));
  const node = nodes.find(({ key }) => key === picked) ?? nodes[0]!;
  return (
    <ResearchFrame essence={essence} labor={labor} option="choice-first">
      <div className="shrink-0 border-b border-hud-divider px-3 pb-3">
        <ChoiceCard key={node.key} node={node} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2">
        <TreeGrid nodes={nodes} picked={node.key} onPick={setPicked} compact />
      </div>
    </ResearchFrame>
  );
};

/** C: the tree as today; a tap raises the choice over its foot, the tree still in view above it. */
const OverlayPanel = ({ nodes, essence, labor }: PanelProps) => {
  const [picked, setPicked] = useState<string | null>(openingNode(nodes));
  const node = nodes.find(({ key }) => key === picked);
  return (
    <ResearchFrame essence={essence} labor={labor} option="overlay">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <TreeGrid nodes={nodes} picked={node?.key} onPick={setPicked} />
        </div>
        {node && (
          <div
            data-lab="choice-over-tree"
            className="absolute inset-x-2 bottom-2 rounded-lg border border-hud-line-strong bg-hud-surface p-3 shadow-2xl"
          >
            <ChoiceCard key={node.key} node={node} onClose={() => setPicked(null)} />
          </div>
        )}
      </div>
    </ResearchFrame>
  );
};

/** B: every building a row, its sides its own buttons; what is done or still locked folds into one line each. */
const CardsPanel = ({ nodes, essence, labor }: PanelProps) => (
  <ResearchFrame essence={essence} labor={labor} option="cards">
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
      {(Object.keys(RESEARCH_TREE.branches) as Branch[]).map((branch) => {
        const rows = nodes.filter((node) => node.branch === branch);
        const open = rows.filter(({ state }) => state === "ready" || state === "short");
        const done = rows.filter(({ state }) => state === "done");
        const locked = rows.filter(({ state }) => state === "locked");
        return (
          <section key={branch} className="flex flex-col gap-2">
            <BranchHead branch={branch} />
            {open.map((node) => (
              <RowCard key={node.key} node={node} />
            ))}
            {locked.length > 0 && <FoldedLine icon="lock" nodes={locked} word={RESEARCH_TREE.states.locked} />}
            {done.length > 0 && <FoldedLine icon="check" nodes={done} word={RESEARCH_TREE.states.done} />}
          </section>
        );
      })}
    </div>
  </ResearchFrame>
);

/** The panel every draft stands in: Research's title and the Essence and labor held, as the shipped panel's head. */
const ResearchFrame = ({
  essence,
  labor,
  option,
  children,
}: {
  essence: number;
  labor: number;
  option: ResearchOption;
  children: React.ReactNode;
}) => (
  <HudPanel
    title={RESEARCH}
    icon="research"
    collapsible={false}
    cue={<HeldCue essence={essence} labor={labor} />}
    className="pointer-events-auto flex min-h-0 flex-1 flex-col"
    bodyClassName="flex min-h-0 flex-1 flex-col"
  >
    <div data-lab={`research-${option}`} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  </HudPanel>
);

const HeldCue = ({ essence, labor }: { essence: number; labor: number }) => (
  <span className="flex gap-1">
    <HudChip icons={["essence"]} label={ESSENCE}>
      {formatAmount(essence)}
    </HudChip>
    <HudChip icons={["labor"]} label={LABOR}>
      {formatAmount(labor)}
    </HudChip>
  </span>
);

const BRANCH_ICONS: Record<Branch, IconMeaning> = { economy: "farm", army: "barracks", castle: "spire" };

const BranchHead = ({ branch }: { branch: Branch }) => (
  <span className="flex items-center gap-1 text-hud-label uppercase tracking-wide text-hud-muted">
    <Icon name={BRANCH_ICONS[branch]} size={16} />
    {RESEARCH_TREE.branches[branch]}
  </span>
);

/** The tree as the shipped panel lays it out, three branches side by side; compact, each tile one line high. */
const TreeGrid = ({
  nodes,
  picked,
  onPick,
  compact = false,
}: {
  nodes: readonly TreeNode[];
  picked?: string;
  onPick: (key: string) => void;
  compact?: boolean;
}) => (
  <div className="grid grid-cols-3 gap-2 pb-2">
    {(Object.keys(RESEARCH_TREE.branches) as Branch[]).map((branch) => (
      <div key={branch} className="flex flex-col gap-2">
        <BranchHead branch={branch} />
        {nodes
          .filter((node) => node.branch === branch)
          .map((node) => (
            <Tile
              key={node.key}
              node={node}
              picked={node.key === picked}
              compact={compact}
              onPick={() => onPick(node.key)}
            />
          ))}
      </div>
    ))}
  </div>
);

const STATE_FRAME: Record<TreeNode["state"], string> = {
  done: "border-hud-line bg-hud-well",
  ready: "border-hud-good bg-hud-chosen",
  short: "border-hud-line",
  locked: "border-hud-divider opacity-60",
};

const Tile = ({
  node,
  picked,
  compact,
  onPick,
}: {
  node: TreeNode;
  picked: boolean;
  compact: boolean;
  onPick: () => void;
}) => (
  <button
    type="button"
    onClick={onPick}
    aria-pressed={picked}
    data-node={node.key}
    data-state={node.state}
    className={cn(
      "relative flex items-center rounded-md border text-center",
      compact ? "flex-col gap-0 px-1 py-1" : "flex-col gap-0.5 px-1 py-1.5",
      STATE_FRAME[node.state],
      picked && "outline outline-2 outline-offset-1 outline-hud-accent",
    )}
  >
    <Icon name={node.icon} size={compact ? 24 : 36} />
    <span className="flex min-w-0 max-w-full flex-col items-center">
      <span className="truncate text-hud-label leading-tight text-hud-ink">{node.name}</span>
      {node.maxTier === 4 ? (
        <HudRarity tier={(node.tier + 1) as 1 | 2 | 3 | 4 | 5} />
      ) : (
        <span className="text-hud-label tabular-nums text-hud-muted">
          {node.state === "done" ? RESEARCH_TREE.states.done : formatAmount(node.price?.essence)}
        </span>
      )}
    </span>
    {(node.state === "ready" || node.state === "locked" || node.state === "done") && (
      <span className="absolute right-1 top-1">
        <Icon name={node.state === "ready" ? "research" : node.state === "locked" ? "lock" : "check"} size={14} />
      </span>
    )}
  </button>
);

/**
 * The choice a player came to make, the one card A and C share: the building and its level, its sides (or what its
 * next tier gives), the price as two chips held against needed, the first thing missing, and Research.
 */
const ChoiceCard = ({ node, onClose }: { node: TreeNode; onClose?: () => void }) => {
  const [side, setSide] = useState(0);
  const missing = firstMissing(node);
  const verb = node.sides?.[side]?.name ?? node.nextWord ?? node.name;
  return (
    <div data-lab="choice-card" className="flex flex-col gap-2 pt-2">
      <div className="flex items-center gap-2">
        <Icon name={node.icon} size={36} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-hud-title text-hud-ink">{node.name}</span>
          <span className="text-hud-label text-hud-muted">{levelLine(node)}</span>
        </div>
        {onClose && (
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-hud-muted">
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      {node.sides ? (
        <div className={cn("grid gap-2", node.sides.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {node.sides.map((option, index) => (
            <button
              key={option.name}
              type="button"
              onClick={() => setSide(index)}
              aria-pressed={side === index}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left",
                side === index ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
              )}
            >
              <Icon name={option.icon} size={28} />
              <span className="flex min-w-0 flex-col">
                <span className="text-hud-strong text-hud-ink">{option.name}</span>
                <span className="text-hud-label tabular-nums text-hud-good">
                  {RESEARCH_TREE.step(option.now, option.next)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        node.gives.next && (
          <span className="text-hud-body text-hud-ink">
            {node.gives.line} ·{" "}
            <span className="tabular-nums text-hud-good">{RESEARCH_TREE.step(node.gives.now, node.gives.next)}</span>
          </span>
        )
      )}
      {node.state !== "done" && (
        <div className="flex items-center gap-2">
          <PriceChips node={node} />
          <span className="flex-1" />
          <HudButton kind="primary" disabled={node.state !== "ready"} onClick={() => undefined}>
            {RESEARCH_TREE.research(verb)}
          </HudButton>
        </div>
      )}
      {missing && !isPrice(missing) && <span className="text-hud-label text-hud-bad">{needLine(missing)}</span>}
    </div>
  );
};

/**
 * B's row: the building, its level and its price; its sides as choice tiles, a tap on one researching that side; a row
 * with no sides says its next step and has one Research. Ready rows wear the tree's "can research" frame; nothing in
 * the list wears the gold of a primary action, since every row is one.
 */
const RowCard = ({ node }: { node: TreeNode }) => {
  const ready = node.state === "ready";
  const missing = firstMissing(node);
  return (
    <div
      data-node={node.key}
      data-state={node.state}
      className={cn("flex flex-col gap-1.5 rounded-md border px-2 py-2", STATE_FRAME[node.state])}
    >
      <div className="flex items-center gap-2">
        <Icon name={node.icon} size={28} />
        <span className="flex items-center gap-2 text-hud-strong text-hud-ink">
          {node.name}
          {node.maxTier === 4 && <HudRarity tier={(node.tier + 1) as 1 | 2 | 3 | 4 | 5} />}
        </span>
        <span className="flex-1" />
        <PriceChips node={node} />
      </div>
      {!node.sides && (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-hud-label text-hud-muted">
            {node.gives.next && (
              <>
                {node.gives.line} · <span className="tabular-nums text-hud-good">{node.gives.next}</span>
              </>
            )}
          </span>
          <HudButton kind="secondary" disabled={!ready} onClick={() => undefined}>
            {RESEARCH_TREE.research(node.nextWord ?? node.name)}
          </HudButton>
        </div>
      )}
      {node.sides && (
        <div className={cn("grid gap-1.5", node.sides.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
          {node.sides.map((option) => (
            <button
              key={option.name}
              type="button"
              disabled={!ready}
              aria-label={RESEARCH_TREE.research(option.name)}
              className="flex items-center gap-1.5 rounded-md border border-hud-line-strong bg-hud-well px-2 py-1 text-left enabled:hover:bg-hud-chosen disabled:opacity-60"
            >
              <Icon name={option.icon} size={24} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-hud-label text-hud-ink">{option.name}</span>
                <span className="truncate text-hud-label tabular-nums text-hud-good">
                  {RESEARCH_TREE.step(option.now, option.next)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {missing && !isPrice(missing) && <span className="text-hud-label text-hud-bad">{needLine(missing)}</span>}
    </div>
  );
};

/** Rows folded into one line: their marks and the word they share ("Researched", "Barracks Rare opens them"). */
const FoldedLine = ({ icon, nodes, word }: { icon: IconMeaning; nodes: readonly TreeNode[]; word: string }) => (
  <div className="flex items-center gap-2 rounded-md border border-dashed border-hud-divider px-2 py-1.5">
    <Icon name={icon} size={16} />
    <span className="flex gap-1">
      {nodes.map((node) => (
        <Icon key={node.key} name={node.icon} size={22} />
      ))}
    </span>
    <span className="truncate text-hud-label text-hud-muted">
      {word} · {nodes.map(({ name }) => name).join(", ")}
    </span>
  </div>
);

const isPrice = (need: Need) => need.kind === "essence" || need.kind === "labor";

/** The next tier's price as chips, each red while the realm holds less than it. */
const PriceChips = ({ node }: { node: TreeNode }) => {
  const price = node.needs.filter(isPrice) as Extract<Need, { kind: "essence" | "labor" }>[];
  return (
    <span className="flex gap-1">
      {price.map((need) => (
        <span
          key={need.kind}
          className={cn(
            "flex items-center gap-0.5 rounded-full bg-hud-well px-1.5 text-hud-label tabular-nums",
            need.met ? "text-hud-ink" : "text-hud-bad",
          )}
        >
          <Icon name={need.kind} size={14} />
          {formatAmount(need.need)}
        </span>
      ))}
    </span>
  );
};

const levelLine = (node: TreeNode): string => {
  if (node.state === "done") return node.maxTier === 1 ? RESEARCH_TREE.states.done : RESEARCH_TREE.complete;
  if (node.maxTier === 1) return RESEARCH_TREE.states[node.state];
  return RESEARCH_TREE.step(TIER_WORDS[node.tier]!, node.nextWord ?? "");
};
