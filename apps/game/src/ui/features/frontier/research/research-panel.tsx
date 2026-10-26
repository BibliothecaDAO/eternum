import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudPanel, HudTier } from "@/ui/design-system/kit/hud-elements";
import type { Fix } from "@/ui/design-system/kit/refusal";
import { ESSENCE, LABOR, RESEARCH, RESEARCH_TREE, RESEARCHING, TIER_WORDS } from "@/ui/design-system/kit/words";
import { formatAmount, formatExact } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";

import { type Branch, firstMissing, type Need, needLine, type NodeState, type TreeNode } from "./research-tree";

/**
 * Research as a tree (the owner's pick, 20 October: "Branches"): three branches side by side, Economy, Army and Castle;
 * each node a tile with its painting, its level pips or price, and its state; a line where one node opens another
 * (Barracks at its gate tier to the four training buildings, Reach I to II to III). The picked node opens under the tree,
 * in the same panel, never over it: what it gives now and next, the sides to pick from, each thing its next tier needs
 * ticked or not, the fix for the first one missing, and Research.
 */
export const ResearchPanel = ({
  nodes,
  essence,
  labor,
  picked,
  onPick,
  sending,
  fixFor,
  onResearch,
}: {
  nodes: readonly TreeNode[];
  essence: number;
  labor: number;
  picked: string;
  onPick: (key: string) => void;
  /** The rows being researched: sent, their outcome not known yet. */
  sending: ReadonlySet<number>;
  /** The step that clears a missing need, where there is one. */
  fixFor: (need: Need, node: TreeNode) => Fix | undefined;
  /** Research the node's next tier, with the side picked (0 where it has none). */
  onResearch: (node: TreeNode, side: number) => unknown;
}) => {
  const node = nodes.find(({ key }) => key === picked) ?? nodes[0]!;
  // A node picked after the panel opened shows its detail: the tree may have scrolled it out of view.
  const opened = useRef(node.key);
  const tile = (item: TreeNode) => (
    <NodeTile key={item.key} node={item} picked={item.key === node.key} onPick={() => onPick(item.key)} />
  );
  const branch = (key: Branch) => nodes.filter((item) => item.branch === key);
  const [barracks, ...training] = branch("army");
  return (
    <HudPanel
      title={RESEARCH}
      icon="research"
      collapsible={false}
      cue={<HeldCue essence={essence} labor={labor} />}
      className="pointer-events-auto flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      <div className="grid grid-cols-3 gap-2 px-3">
        {(Object.keys(RESEARCH_TREE.branches) as Branch[]).map((key) => (
          <BranchHead key={key} branch={key} />
        ))}
        <div className="flex flex-col gap-2">{branch("economy").map(tile)}</div>
        <div className="flex flex-col gap-2">
          {barracks && tile(barracks)}
          {barracks?.gate && <Gate met={barracks.gate.met} word={RESEARCH_TREE.gate(barracks.gate.tier)} />}
          {training.map(tile)}
        </div>
        <div className="flex flex-col">
          {branch("castle").map((item) => (
            <div key={item.key} className="flex flex-col pb-2">
              {tile(item)}
              {item.leadsTo.length > 0 && <span aria-hidden className="mx-auto -mb-2 h-2 w-0.5 bg-hud-line-strong" />}
            </div>
          ))}
        </div>
      </div>
      <NodeDetail
        key={node.key}
        node={node}
        reveal={node.key !== opened.current}
        sending={sending.has(node.row)}
        fix={(need) => fixFor(need, node)}
        onResearch={(side) => onResearch(node, side)}
      />
    </HudPanel>
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

/** The Barracks' gate to the training buildings, lit once reached. */
const Gate = ({ met, word }: { met: boolean; word: string }) => (
  <span
    className={cn(
      "flex items-center justify-center gap-1 border-y border-dashed py-0.5 text-hud-label",
      met ? "border-hud-good text-hud-good" : "border-hud-line text-hud-muted",
    )}
  >
    <Icon name={met ? "unlock" : "lock"} size={14} />
    {word}
  </span>
);

/** A node as a tile: its painting with its state's mark, its name under it, then its level pips or its price. */
const NodeTile = ({ node, picked, onPick }: { node: TreeNode; picked: boolean; onPick: () => void }) => {
  const look = STATE_LOOK[node.state];
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      data-node={node.key}
      data-state={node.state}
      className={cn(
        "relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center",
        // A row locked above the tiers it holds keeps its look: only what it waits on is locked.
        node.state === "locked" && node.tier > 0 ? "border-hud-divider" : look.frame,
        picked && "outline outline-2 outline-offset-1 outline-hud-accent",
      )}
    >
      <Icon name={node.icon} size={36} />
      <span className={cn("text-hud-label leading-tight", look.text)}>{node.name}</span>
      {node.maxTier === 4 ? (
        <HudTier tier={(node.tier + 1) as 1 | 2 | 3 | 4 | 5} />
      ) : (
        <span className="text-hud-label tabular-nums text-hud-muted">
          {node.state === "done" ? RESEARCH_TREE.states.done : RESEARCH_TREE.price(formatAmount(node.price?.essence))}
        </span>
      )}
      {look.icon && (
        <span className="absolute right-1 top-1">
          <Icon name={look.icon} size={16} />
        </span>
      )}
    </button>
  );
};

/** The picked node, in the panel under the tree. */
const NodeDetail = ({
  node,
  reveal,
  sending,
  fix,
  onResearch,
}: {
  node: TreeNode;
  reveal: boolean;
  sending: boolean;
  fix: (need: Need) => Fix | undefined;
  onResearch: (side: number) => unknown;
}) => {
  const [side, setSide] = useState(0);
  const place = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reveal) place.current?.scrollIntoView?.({ block: "nearest" });
  }, [reveal]);
  const missing = firstMissing(node);
  const fixing = missing && fix(missing);
  const verb = node.sides?.[side]?.name ?? node.nextWord ?? node.name;
  return (
    <div ref={place} data-lab="node-detail" className="flex flex-col gap-3 border-t border-hud-divider px-3 pb-3 pt-3">
      <div className="flex items-center gap-3">
        <Icon name={node.icon} size={44} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-hud-title text-hud-ink">{node.name}</span>
          <span className="text-hud-label text-hud-muted">{levelLine(node)}</span>
        </div>
        {node.maxTier === 4 && <HudTier tier={(node.tier + 1) as 1 | 2 | 3 | 4 | 5} />}
      </div>
      <div className="flex flex-col gap-1 rounded-md bg-hud-well px-3 py-2">
        <span className="text-hud-body text-hud-ink">{node.gives.line}</span>
        {!node.sides && (
          <span className="text-hud-strong tabular-nums text-hud-good">
            {node.gives.next ? RESEARCH_TREE.step(node.gives.now, node.gives.next) : node.gives.now}
          </span>
        )}
      </div>
      {node.sides && (
        <>
          <div className={cn("grid gap-2", node.sides.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {node.sides.map((option, index) => (
              <button
                key={option.name}
                type="button"
                onClick={() => setSide(index)}
                aria-pressed={side === index}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-center",
                  side === index ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
                )}
              >
                <Icon name={option.icon} size={32} />
                <span className="text-hud-strong text-hud-ink">{option.name}</span>
                <span className="text-hud-label text-hud-muted">{option.line}</span>
                <span className="text-hud-strong tabular-nums text-hud-good">
                  {RESEARCH_TREE.step(option.now, option.next)}
                </span>
              </button>
            ))}
          </div>
          <span className="text-hud-label text-hud-warn">{RESEARCH_TREE.sideKept}</span>
        </>
      )}
      {node.needs.length > 0 && (
        <ul className="flex flex-col gap-1">
          {node.needs.map((need) => (
            <li key={needLine(need)} className="flex items-center gap-2 text-hud-body">
              <Icon name={need.met ? "check" : needIcon(need)} size={20} />
              <span className={need.met ? "text-hud-muted" : "text-hud-bad"}>{needLine(need)}</span>
            </li>
          ))}
        </ul>
      )}
      {node.state !== "done" && (
        <div className="flex items-center gap-2">
          {fixing && (
            <HudButton kind="secondary" icon={fixing.icon} onClick={fixing.onFix}>
              {fixing.word}
            </HudButton>
          )}
          <span className="flex-1" />
          <HudButton
            kind="primary"
            disabled={node.state !== "ready"}
            busy={sending ? RESEARCHING : undefined}
            onClick={() => onResearch(side)}
          >
            {RESEARCH_TREE.research(verb)}
          </HudButton>
        </div>
      )}
    </div>
  );
};

const needIcon = (need: Need): IconMeaning =>
  need.kind === "essence" ? "essence" : need.kind === "labor" ? "labor" : "lock";

/** The node's level, or what researching it costs: "Rare → Epic", "2,000 Essence", "Legendary · complete". */
const levelLine = (node: TreeNode): string => {
  if (node.maxTier === 1)
    return node.state === "done"
      ? RESEARCH_TREE.states.done
      : RESEARCH_TREE.price(formatExact(node.price?.essence ?? 0));
  if (node.state === "done") return RESEARCH_TREE.complete;
  return RESEARCH_TREE.step(TIER_WORDS[node.tier]!, node.nextWord ?? "");
};

/** The realm's Essence and labor, the panel's cue. */
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
