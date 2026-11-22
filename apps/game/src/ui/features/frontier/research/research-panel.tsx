import { isOathResearch } from "@bibliothecadao/eternum";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRanked, HudTier, HudTierStep } from "@/ui/design-system/kit/hud-elements";
import type { Fix } from "@/ui/design-system/kit/refusal";
import {
  CLOSE,
  RESEARCH,
  RESEARCH_TREE,
  RESEARCHING,
  type Rank,
  type RankedWords,
} from "@/ui/design-system/kit/words";
import { formatAmount, formatExact } from "@bibliothecadao/types";
import {
  type Branch,
  firstMissing,
  type Need,
  needLine,
  type NodeState,
  type TreeNode,
} from "./research-tree";

export const ResearchPanel = ({
  nodes,
  picked,
  onPick,
  sending,
  fixFor,
  onResearch,
  onClose,
}: {
  nodes: readonly TreeNode[];
  /** The node whose choice is open; null with the choice put away. */
  picked: string | null;
  onPick: (key: string | null) => void;
  /** The rows being researched: sent, their outcome not known yet. */
  sending: ReadonlySet<number>;
  /** The step that clears a missing need, where there is one. */
  fixFor: (need: Need, node: TreeNode) => Fix | undefined;
  onResearch: (node: TreeNode) => unknown;
  /** Puts the page away, as every panel closes: its X, Escape or back. */
  onClose: () => void;
}) => {
  const node = picked === null ? undefined : nodes.find(({ key }) => key === picked);
  const tile = (item: TreeNode) => (
    <NodeTile key={item.key} node={item} picked={item.key === node?.key} onPick={() => onPick(item.key)} />
  );
  const branch = (key: Branch) => nodes.filter((item) => item.branch === key);
  return (
    <HudPage label={RESEARCH} icon="research" onClose={onClose}>
      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto">
        {(Object.keys(RESEARCH_TREE.branches) as Branch[]).map((key) => (
          <BranchHead key={key} branch={key} />
        ))}
        <div className="flex flex-col gap-2">{branch("economy").map(tile)}</div>
        <div className="flex flex-col gap-2">{branch("army").map(tile)}</div>
        <div className="flex flex-col">
          {branch("castle").map((item) => (
            <div key={item.key} className="flex flex-col pb-2">
              {tile(item)}
              {item.leadsTo.length > 0 && <span aria-hidden className="mx-auto -mb-2 h-2 w-0.5 bg-hud-line-strong" />}
            </div>
          ))}
        </div>
      </div>
      {node && (
        <NodeChoice
          key={node.key}
          node={node}
          sending={sending.has(node.row)}
          fix={(need) => fixFor(need, node)}
          onResearch={() => onResearch(node)}
          onClose={() => onPick(null)}
        />
      )}
    </HudPage>
  );
};

/** One look per state, the same on a tile and in the detail: each tile's frame and mark say its state. */
const STATE_LOOK: Record<NodeState, { icon?: IconMeaning; frame: string; text: string }> = {
  done: { icon: "check", frame: "border-hud-line bg-hud-well", text: "text-hud-ink" },
  ready: { icon: "research", frame: "border-hud-good bg-hud-chosen", text: "text-hud-ink" },
  short: { frame: "border-hud-line", text: "text-hud-ink" },
  locked: { icon: "lock", frame: "border-hud-divider opacity-60", text: "text-hud-muted" },
};

const BRANCH_ICONS: Record<Branch, IconMeaning> = { economy: "farm", army: "barracks", castle: "spire" };

const BranchHead = ({ branch }: { branch: Branch }) => (
  <span className="flex items-center gap-1 text-hud-label uppercase tracking-wide text-hud-muted">
    <Icon name={BRANCH_ICONS[branch]} size={16} />
    {RESEARCH_TREE.branches[branch]}
  </span>
);

/**
 * A node as a tile: its painting with its state's mark, its name under it, then its tier's gem or its price. A compact
 * tile (a row of them on the castle's card) keeps its painting, mark and name, which a phone cannot hover for (audit
 * 10-27: the castle's five tiles had no names); its price is on its hover and on the Research page it opens.
 */
export const NodeTile = ({
  node,
  picked,
  compact = false,
  onPick,
}: {
  node: TreeNode;
  picked: boolean;
  compact?: boolean;
  onPick: () => void;
}) => {
  const look = STATE_LOOK[node.state];
  const reading = isOathResearch(node.row) ? (
    <span className="text-hud-label">
      <HudRanked words={node.gives.now} />
    </span>
  ) : node.maxTier === 5 ? (
    <HudTier tier={tierOf(node)} />
  ) : (
    <span className="text-hud-label tabular-nums text-hud-muted">
      {node.state === "done" ? RESEARCH_TREE.states.done : RESEARCH_TREE.price(formatAmount(node.price?.essence))}
    </span>
  );
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      data-tip={compact ? tileTip(node) : undefined}
      data-node={node.key}
      data-state={node.state}
      className={cn(
        "ui-pick relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center",
        // A row locked above the tiers it holds keeps its look: only what it waits on is locked.
        node.state === "locked" && node.tier > 0 ? "border-hud-divider" : look.frame,
      )}
    >
      <Icon name={node.icon} size={compact ? 32 : 36} />
      <span className={cn("text-hud-label leading-tight", compact && "break-words", look.text)}>{node.name}</span>
      {!compact && reading}
      {look.icon && (
        <span className={cn("absolute", compact ? "right-0.5 top-0.5" : "right-1 top-1")}>
          <Icon name={look.icon} size={compact ? 12 : 16} />
        </span>
      )}
    </button>
  );
};

/** A compact tile's hover: its name, then its state or its price. */
const tileTip = (node: TreeNode) =>
  `${node.name} · ${node.state === "done" ? RESEARCH_TREE.states.done : RESEARCH_TREE.price(formatAmount(node.price?.essence))}`;

const NodeChoice = ({
  node,
  sending,
  fix,
  onResearch,
  onClose,
}: {
  node: TreeNode;
  sending: boolean;
  fix: (need: Need) => Fix | undefined;
  onResearch: () => unknown;
  onClose: () => void;
}) => {
  const missing = firstMissing(node);
  const fixing = missing && fix(missing);
  const verb: RankedWords | string = isOathResearch(node.row)
    ? RESEARCH_TREE.oaths
    : node.nextTier
      ? [`${node.name} `, { rank: node.nextTier }]
      : node.name;
  const price = node.needs.filter(isPrice);
  return (
    <div
      data-lab="node-choice"
      className="flex shrink-0 flex-col gap-2 rounded-lg border border-hud-line-strong bg-hud-surface p-3 shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <Icon name={node.icon} size={36} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-hud-title text-hud-ink">{node.name}</span>
          <LevelLine node={node} />
        </div>
        <button type="button" aria-label={CLOSE} onClick={onClose} className="p-1 text-hud-muted hover:text-hud-ink">
          <Icon name="close" size={18} />
        </button>
      </div>
        <span className="text-hud-body text-hud-ink">
          {node.gives.line}
          {" · "}
          <span className="tabular-nums text-hud-good">
            <HudRanked words={node.gives.next ? RESEARCH_TREE.step(node.gives.now, node.gives.next) : node.gives.now} />
          </span>
        </span>
      {missing && !isPrice(missing) && (
        <span className="flex items-center gap-2 text-hud-label text-hud-bad">
          <Icon name={needIcon(missing)} size={16} />
          {needLine(missing)}
        </span>
      )}
      {node.state !== "done" && (
        <div data-research-footer className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <span className="flex shrink-0 gap-1">
            {price.map((need) => (
              <span
                key={need.kind}
                aria-label={needLine(need)}
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
          {fixing ? (
            <HudButton kind="primary" icon={fixing.icon} onClick={fixing.onFix}>
              {fixing.word}
            </HudButton>
          ) : (
            <HudButton
              kind="primary"
              disabled={node.state !== "ready"}
              busy={sending ? RESEARCHING : undefined}
              onClick={() => onResearch()}
            >
              <HudRanked words={RESEARCH_TREE.research(verb)} />
            </HudButton>
          )}
        </div>
      )}
    </div>
  );
};

/** A need that is the next tier's price: the Essence or the labor it costs. */
const isPrice = (need: Need): need is Extract<Need, { kind: "essence" | "labor" }> =>
  need.kind === "essence" || need.kind === "labor";

const needIcon = (need: Need): IconMeaning =>
  need.kind === "essence" ? "essence" : need.kind === "labor" ? "labor" : "lock";

/** The node's tier and its next as gems, complete at Legendary, or a one-off node's price. */
const LevelLine = ({ node }: { node: TreeNode }) => {
  if (isOathResearch(node.row))
    return (
      <span className="text-hud-label">
        <HudRanked words={node.gives.now} />
      </span>
    );
  if (node.maxTier === 5 && node.nextTier) return <HudTierStep from={tierOf(node)} to={node.nextTier} />;
  if (node.maxTier === 5)
    return (
      <span className="flex items-center gap-1.5 text-hud-label text-hud-muted">
        <HudTier tier={tierOf(node)} />
        {RESEARCH_TREE.complete}
      </span>
    );
  return (
    <span className="text-hud-label text-hud-muted">
      {node.state === "done" ? RESEARCH_TREE.states.done : RESEARCH_TREE.price(formatExact(node.price?.essence ?? 0))}
    </span>
  );
};

/** A tiered row's tier as the kit counts it, common (1) to legendary (5). */
const tierOf = (node: TreeNode) => node.tier as Rank;
