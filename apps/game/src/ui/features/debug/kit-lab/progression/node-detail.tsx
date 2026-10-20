import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudRarity } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useState } from "react";

import { exactAmount, firstMissing, type Need, needLine, type NodeState, type TreeNode } from "./research-tree";

/**
 * The picked node, drawn in the same panel under the tree (never a panel over the panel): what it is and its level, what
 * its next tier gives (the sides to pick from, where it has them), each thing it needs ticked or not, and one verb.
 * Shared by the three proposals, so they differ only in how the tree reads.
 */
export const NodeDetail = ({ node }: { node: TreeNode }) => {
  const [side, setSide] = useState(0);
  const missing = firstMissing(node);
  return (
    <div data-lab="node-detail" className="flex flex-col gap-3 border-t border-hud-divider px-3 pb-3 pt-3">
      <div className="flex items-center gap-3">
        <Icon name={node.icon} size={44} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-hud-title text-hud-ink">{node.name}</span>
          <span className="text-hud-label text-hud-muted">
            {node.state === "done" ? doneWord(node) : nextWords(node)}
          </span>
        </div>
        {node.maxTier === 4 && <HudRarity tier={(node.tier + 1) as 1 | 2 | 3 | 4 | 5} />}
      </div>
      <Gives node={node} />
      {node.sides && (
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
                {option.now} → {option.next}
              </span>
            </button>
          ))}
        </div>
      )}
      {node.sides && node.state !== "done" && (
        <span className="text-hud-label text-hud-warn">The side is kept for the season.</span>
      )}
      {node.needs.length > 0 && (
        <ul className="flex flex-col gap-1">
          {node.needs.map((need) => (
            <NeedLine key={needLine(need)} need={need} />
          ))}
        </ul>
      )}
      {node.state !== "done" && (
        <div className="flex items-center gap-2">
          {missing && <FixButton need={missing} />}
          <span className="flex-1" />
          <HudButton kind="primary" disabled={node.state !== "ready"}>
            {node.sides ? `Research ${node.sides[side]!.name}` : `Research ${node.nextWord ?? ""}`.trim()}
          </HudButton>
        </div>
      )}
    </div>
  );
};

/** What the node does, with its figure now and after the next tier. */
const Gives = ({ node }: { node: TreeNode }) => (
  <div className="flex items-center justify-between gap-2 rounded-md bg-hud-well px-3 py-2">
    <span className="text-hud-body text-hud-ink">{node.gives.line}</span>
    {!node.sides && (
      <span className="shrink-0 text-hud-strong tabular-nums text-hud-good">
        {node.gives.next ? `${node.gives.now} → ${node.gives.next}` : node.gives.now}
      </span>
    )}
  </div>
);

/** One need: a tick when held, a cross in the bad tone when not, its words, and for a price the amounts. */
export const NeedLine = ({ need, compact = false }: { need: Need; compact?: boolean }) => (
  <li className="flex items-center gap-2 text-hud-body">
    <Icon name={need.met ? "check" : needIcon(need)} size={compact ? 16 : 20} />
    <span className={need.met ? "text-hud-muted" : "text-hud-bad"}>{needLine(need)}</span>
  </li>
);

const needIcon = (need: Need): IconMeaning =>
  need.kind === "essence" ? "essence" : need.kind === "labor" ? "labor" : "lock";

/** The step that clears what a node waits on first: the map for Essence or labor, the board, the castle. */
const FixButton = ({ need }: { need: Need }) => {
  if (need.kind === "essence" || need.kind === "labor")
    return (
      <HudButton kind="secondary" icon="explore">
        Explore for {need.kind === "essence" ? "Essence" : "labor"}
      </HudButton>
    );
  if (need.kind === "stands")
    return (
      <HudButton kind="secondary" icon={need.icon}>
        Build a {need.building}
      </HudButton>
    );
  if (need.kind === "store")
    return (
      <HudButton kind="secondary" icon="realm">
        Level up the castle
      </HudButton>
    );
  return null;
};

const nextWords = (node: TreeNode) =>
  node.maxTier === 4
    ? `${node.tier === 0 ? "Common" : levelWord(node.tier)} → ${node.nextWord}`
    : `Not researched · ${exactAmount(node.price?.essence ?? 0)} Essence`;

const doneWord = (node: TreeNode) => (node.maxTier === 4 ? "Legendary · complete" : "Researched");

const levelWord = (tier: number) => ["Common", "Uncommon", "Rare", "Epic", "Legendary"][tier]!;

/** A node's state as the legend names it: one look per state, the same in every proposal. */
export const STATE_LOOK: Record<NodeState, { word: string; icon?: IconMeaning; frame: string; text: string }> = {
  done: { word: "Researched", icon: "check", frame: "border-hud-line bg-hud-well", text: "text-hud-ink" },
  ready: { word: "Can research", icon: "research", frame: "border-hud-good bg-hud-chosen", text: "text-hud-ink" },
  short: { word: "Saving up", frame: "border-hud-line", text: "text-hud-ink" },
  locked: { word: "Locked", icon: "lock", frame: "border-hud-divider opacity-60", text: "text-hud-muted" },
};

/** The legend: the four states with their marks. */
export const StateLegend = () => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-2 text-hud-label text-hud-muted">
    {(["ready", "short", "done", "locked"] as const).map((state) => (
      <span key={state} className="flex items-center gap-1">
        <span className={cn("inline-block size-3 rounded-sm border", STATE_LOOK[state].frame)} />
        {STATE_LOOK[state].word}
      </span>
    ))}
  </div>
);

/** The realm's Essence and labor, the panel's cue. */
export const HeldCue = ({ essence, labor }: { essence: number; labor: number }) => (
  <span className="flex gap-1">
    <HudChip icons={["essence"]} label="Essence">
      {exactAmount(essence)}
    </HudChip>
    <HudChip icons={["labor"]} label="Labor">
      {exactAmount(labor)}
    </HudChip>
  </span>
);
