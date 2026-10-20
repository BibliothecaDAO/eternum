import { Icon } from "@/ui/design-system/icon";
import { HudMeter, HudPanel, HudRarity } from "@/ui/design-system/kit/hud-elements";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { TreePage, type CastleNode, type TreeRow } from "@/ui/features/frontier/research/tree-page";
import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { type ReactNode, useState } from "react";

import { type RealmFacts, researchPrice } from "./progression-facts";
import { HeldCue, NeedLine, NodeDetail, STATE_LOOK, StateLegend } from "./node-detail";
import { BRANCHES, exactAmount, firstMissing, needLine, readResearchTree, type TreeNode } from "./research-tree";

const noop = () => undefined;

/** The node a proposal opens on: the first the realm can research now, else the first it is saving for. */
const firstPick = (nodes: TreeNode[]) =>
  (nodes.find(({ state }) => state === "ready") ?? nodes.find(({ state }) => state === "short") ?? nodes[0]!).key;

/** What a node's corner says: its state's mark, or the price it is saving for. */
const StateMark = ({ node }: { node: TreeNode }) => {
  const look = STATE_LOOK[node.state];
  return look.icon ? <Icon name={look.icon} size={16} /> : null;
};

/**
 * Today's Research page, as the game draws it on the same realm: its rows and the castle row, each opening a sheet over
 * it (owner-research.png).
 */
export const ResearchToday = ({ realm }: { realm: RealmFacts }) => {
  const nodes = readResearchTree(realm);
  const rows: TreeRow[] = nodes
    .toSorted((left, right) => left.row - right.row)
    .filter(({ maxTier, needs }) => maxTier === 4 && needs.every((need) => need.kind !== "stands" || need.met))
    .map((node) => ({
      key: node.key,
      icon: node.icon,
      name: node.name,
      tip: node.gives.line,
      tier: (node.tier + 1) as Tier,
      sides: node.taken,
      next: node.price,
      choice: Boolean(node.sides),
    }));
  const castle: CastleNode[] = nodes
    .filter(({ branch }) => branch === "castle")
    .map((node) => ({
      key: node.key,
      icon: node.icon,
      label: node.name.replace("Reach ", ""),
      tip: node.gives.line,
      essence:
        node.price?.essence ??
        researchPrice(node.row, node.key.startsWith("reach-") ? Number(node.key.slice(6)) : 1).essence,
      state: node.state === "done" ? "learned" : node.state === "locked" ? "locked" : "open",
    }));
  return (
    <TreePage essence={realm.essence} labor={realm.labor} rows={rows} castle={castle} onRow={noop} onCastle={noop} />
  );
};

/**
 * A · Branches: the tree drawn as a tree (Civilization, Rise of Kingdoms). Three branches side by side, Economy, Army
 * and Castle; each node a tile with its painting, its level pips and its state; lines where one node opens another
 * (Barracks rare to the four training buildings, Reach I to II to III). The picked node's detail opens under the tree,
 * in the same panel.
 */
export const ResearchBranches = ({ realm }: { realm: RealmFacts }) => {
  const nodes = readResearchTree(realm);
  const [picked, setPicked] = useState(() => firstPick(nodes));
  const node = nodes.find(({ key }) => key === picked)!;
  const tile = (item: TreeNode) => (
    <NodeTile key={item.key} node={item} picked={item.key === picked} onPick={() => setPicked(item.key)} />
  );
  const barracks = nodes.find(({ key }) => key === "barracks")!;
  const training = nodes.filter(({ branch, key }) => branch === "army" && key !== "barracks");
  return (
    <HudPanel title="Research" icon="research" cue={<HeldCue essence={realm.essence} labor={realm.labor} />}>
      <StateLegend />
      <div className="grid grid-cols-3 gap-2 px-3">
        <BranchHead branch="economy" />
        <BranchHead branch="army" />
        <BranchHead branch="castle" />
        <div className="flex flex-col gap-2">{nodes.filter(({ branch }) => branch === "economy").map(tile)}</div>
        <div className="flex flex-col gap-2">
          {tile(barracks)}
          <Gate met={barracks.tier >= 2} word="Rare opens" />
          {training.map(tile)}
        </div>
        <div className="flex flex-col gap-2">
          {nodes
            .filter(({ branch }) => branch === "castle")
            .map((item) => (
              <div key={item.key} className="flex flex-col items-stretch">
                {tile(item)}
                {item.leadsTo.length > 0 && <span aria-hidden className="mx-auto h-2 w-0.5 bg-hud-line-strong" />}
              </div>
            ))}
        </div>
      </div>
      <NodeDetail key={node.key} node={node} />
    </HudPanel>
  );
};

const BranchHead = ({ branch }: { branch: (typeof BRANCHES)[number]["key"] }) => {
  const { name, icon } = BRANCHES.find(({ key }) => key === branch)!;
  return (
    <span className="flex items-center gap-1 text-hud-label uppercase tracking-wide text-hud-muted">
      <Icon name={icon} size={16} />
      {name}
    </span>
  );
};

/** The Barracks' gate: rare opens the training buildings, lit once reached. */
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
      className={cn(
        "relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center",
        // A row locked above the tiers it already holds keeps its look: only what it waits on is locked.
        node.state === "locked" && node.tier > 0 ? "border-hud-divider" : look.frame,
        picked && "outline outline-2 outline-offset-1 outline-[rgb(var(--hud-accent))]",
      )}
    >
      <Icon name={node.icon} size={36} />
      <span className={cn("text-hud-label leading-tight", look.text)}>{node.name}</span>
      {node.maxTier === 4 ? (
        <HudRarity tier={(node.tier + 1) as 1 | 2 | 3 | 4 | 5} />
      ) : (
        <span className="text-hud-label tabular-nums text-hud-muted">
          {node.state === "done" ? "Researched" : shortEssence(node.price?.essence)}
        </span>
      )}
      <span className="absolute right-1 top-1">
        <StateMark node={node} />
      </span>
    </button>
  );
};

const shortEssence = (essence: number | undefined) =>
  essence === undefined ? "" : essence >= 1000 ? `${essence / 1000}K Essence` : `${essence} Essence`;

/**
 * B · Ladders: one line per node, its five levels as steps left to right (Age of Empires' tech tree, Clash of Clans'
 * laboratory). Done steps are filled (with the side taken), the next step is lit with its price under the line, a
 * locked line says why in place of its steps. Grouped by branch. Picking a line opens its detail under it.
 */
export const ResearchLadders = ({ realm }: { realm: RealmFacts }) => {
  const nodes = readResearchTree(realm);
  const [picked, setPicked] = useState(() => firstPick(nodes));
  return (
    <HudPanel title="Research" icon="research" cue={<HeldCue essence={realm.essence} labor={realm.labor} />}>
      <StateLegend />
      {BRANCHES.map((branch) => (
        <div key={branch.key} className="flex flex-col">
          <span className="flex items-center gap-1 px-3 pb-1 pt-2 text-hud-label uppercase tracking-wide text-hud-muted">
            <Icon name={branch.icon} size={16} />
            {branch.name}
          </span>
          {ladderLines(nodes.filter((node) => node.branch === branch.key)).map((line) => (
            <div key={line.key}>
              <LadderLine line={line} picked={line.nodes.some(({ key }) => key === picked)} onPick={setPicked} />
              {line.nodes.some(({ key }) => key === picked) && (
                <NodeDetail key={picked} node={line.nodes.find(({ key }) => key === picked)!} />
              )}
            </div>
          ))}
        </div>
      ))}
    </HudPanel>
  );
};

/** A ladder line: a building row (four steps), or the three reaches on one line. */
type Line = { key: string; name: string; icon: TreeNode["icon"]; nodes: TreeNode[] };
const ladderLines = (nodes: TreeNode[]): Line[] => {
  const reaches = nodes.filter(({ key }) => key.startsWith("reach-"));
  const own = nodes.filter(({ key }) => !key.startsWith("reach-"));
  return [
    ...own.map((node) => ({ key: node.key, name: node.name, icon: node.icon, nodes: [node] })),
    ...(reaches.length ? [{ key: "reaches", name: "Ethereal", icon: "spire" as const, nodes: reaches }] : []),
  ];
};

const LadderLine = ({ line, picked, onPick }: { line: Line; picked: boolean; onPick: (key: string) => void }) => {
  const single = line.nodes.length === 1 ? line.nodes[0]! : undefined;
  // The reaches' line acts on the first one not yet researched.
  const next = single ?? line.nodes.find(({ state }) => state !== "done") ?? line.nodes[line.nodes.length - 1]!;
  const missing = firstMissing(next);
  const locked = next.state === "locked";
  return (
    <button
      type="button"
      onClick={() => onPick(next.key)}
      aria-pressed={picked}
      className={cn(
        "flex w-full flex-col gap-1 px-3 py-1.5 text-left",
        picked ? "bg-hud-chosen" : "hover:bg-hud-hover",
      )}
    >
      <span className="flex w-full items-center gap-2">
        <Icon name={line.icon} size={30} className={locked ? "opacity-60" : undefined} />
        <span className={cn("w-24 shrink-0 truncate text-hud-body", locked ? "text-hud-muted" : "text-hud-ink")}>
          {line.name}
        </span>
        {locked && single ? (
          <span className="flex min-w-0 flex-1 items-center gap-1 text-hud-label text-hud-bad">
            <Icon name="lock" size={14} />
            <span>{missing && needLine(missing)}</span>
          </span>
        ) : (
          <span className="flex flex-1 gap-1">
            {single?.maxTier === 4 ? (
              <BuildingSteps node={single} />
            ) : (
              line.nodes.map((node) => <CastleStep key={node.key} node={node} />)
            )}
          </span>
        )}
      </span>
      {next.state !== "done" && !(locked && single) && next.price && (
        <span className="flex items-center gap-2 pl-[8.25rem] text-hud-label tabular-nums">
          <span className="text-hud-muted">{next.nextWord ?? next.name}</span>
          <Price have={next.needs} />
        </span>
      )}
    </button>
  );
};

/** A building row's four steps above common: done (the side's mark), next (lit), later (dim). */
const BuildingSteps = ({ node }: { node: TreeNode }) => (
  <>
    {["Unc", "Rare", "Epic", "Leg"].map((word, index) => {
      const done = index < node.tier;
      const next = index === node.tier;
      return (
        <span
          key={word}
          title={word}
          className={cn(
            "flex h-8 flex-1 items-center justify-center rounded border",
            done && "border-hud-line-strong bg-hud-chosen",
            next && (node.state === "ready" ? "border-hud-good" : "border-hud-line-strong border-dashed"),
            !done && !next && "border-hud-divider opacity-50",
          )}
        >
          {done ? (
            node.taken[index] ? (
              <Icon name={node.taken[index]!} size={22} />
            ) : (
              <Icon name="check" size={16} />
            )
          ) : (
            <span className="text-hud-badge text-hud-muted">{word}</span>
          )}
        </span>
      );
    })}
  </>
);

/** A castle node as one step: Shrine, Well, or a reach. */
const CastleStep = ({ node }: { node: TreeNode }) => (
  <span
    title={node.name}
    className={cn(
      "flex h-8 flex-1 items-center justify-center gap-1 rounded border",
      node.state === "done" && "border-hud-line-strong bg-hud-chosen",
      node.state === "ready" && "border-hud-good",
      node.state === "short" && "border-dashed border-hud-line-strong",
      node.state === "locked" && "border-hud-divider opacity-50",
    )}
  >
    <Icon name={node.state === "done" ? "check" : node.state === "locked" ? "lock" : node.icon} size={16} />
    <span className="text-hud-badge text-hud-muted">{node.name.replace("Reach ", "")}</span>
  </span>
);

/** The next step's price, each amount in the bad tone while it is not held. */
const Price = ({ have }: { have: TreeNode["needs"] }) => (
  <>
    {have.flatMap((need) =>
      need.kind === "essence" || need.kind === "labor"
        ? [
            <span key={need.kind} className={cn("flex items-center gap-1", need.met ? "text-hud-ink" : "text-hud-bad")}>
              <Icon name={need.kind} size={14} />
              {exactAmount(need.need)}
            </span>,
          ]
        : [],
    )}
  </>
);

/**
 * C · What's next: the tree read as a to-do (a 4X's "what can I do now"). Ready now first with its verb, then what the
 * realm is saving for with how much of the price it holds, then the locked nodes with the one step that opens each, and
 * last a row of what is done. Picking any opens its detail at the foot of the panel.
 */
export const ResearchNext = ({ realm }: { realm: RealmFacts }) => {
  const nodes = readResearchTree(realm);
  const [picked, setPicked] = useState(() => firstPick(nodes));
  const node = nodes.find(({ key }) => key === picked)!;
  const group = (state: TreeNode["state"]) => nodes.filter((item) => item.state === state);
  return (
    <HudPanel title="Research" icon="research" cue={<HeldCue essence={realm.essence} labor={realm.labor} />}>
      <Group title="Ready now" count={group("ready").length} empty="Nothing yet: save Essence and labor below.">
        {group("ready").map((item) => (
          <NextRow key={item.key} node={item} picked={item.key === picked} onPick={() => setPicked(item.key)} />
        ))}
      </Group>
      <Group title="Saving up" count={group("short").length}>
        {group("short")
          .toSorted((left, right) => heldShare(right) - heldShare(left))
          .map((item) => (
            <NextRow key={item.key} node={item} picked={item.key === picked} onPick={() => setPicked(item.key)} />
          ))}
      </Group>
      <Group title="Locked" count={group("locked").length}>
        {group("locked").map((item) => (
          <NextRow key={item.key} node={item} picked={item.key === picked} onPick={() => setPicked(item.key)} />
        ))}
      </Group>
      {group("done").length > 0 && (
        <Group title="Researched" count={group("done").length}>
          <div className="flex flex-wrap gap-1 px-3">
            {group("done").map((item) => (
              <button
                key={item.key}
                type="button"
                title={item.name}
                onClick={() => setPicked(item.key)}
                className="rounded border border-hud-line bg-hud-well p-1"
              >
                <Icon name={item.icon} size={28} />
              </button>
            ))}
          </div>
        </Group>
      )}
      <NodeDetail key={node.key} node={node} />
    </HudPanel>
  );
};

const Group = ({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col pb-1">
    <span className="flex items-center justify-between px-3 pb-1 pt-2 text-hud-label uppercase tracking-wide text-hud-muted">
      {title}
      <span className="tabular-nums">{count}</span>
    </span>
    {count === 0 && empty ? <span className="px-3 text-hud-label text-hud-muted">{empty}</span> : children}
  </div>
);

/** How much of a node's price is held, 0 to 1, the least of its Essence and labor. */
const heldShare = (node: TreeNode) =>
  Math.min(
    1,
    ...node.needs.flatMap((need) =>
      need.kind === "essence" || need.kind === "labor" ? [need.need === 0 ? 1 : need.have / need.need] : [],
    ),
  );

const NextRow = ({ node, picked, onPick }: { node: TreeNode; picked: boolean; onPick: () => void }) => {
  const missing = firstMissing(node);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left",
        picked ? "bg-hud-chosen" : "hover:bg-hud-hover",
      )}
    >
      <Icon name={node.icon} size={30} className={node.state === "locked" ? "opacity-60" : undefined} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-hud-body text-hud-ink">{node.name}</span>
          {node.nextWord && <span className="text-hud-label text-hud-muted">→ {node.nextWord}</span>}
        </span>
        {node.state === "short" ? (
          <span className="flex items-center gap-2">
            <span className="min-w-12 flex-1">
              <HudMeter share={heldShare(node)} tone="warn" label="Held" />
            </span>
            <span className="text-hud-label tabular-nums text-hud-muted">{Math.floor(heldShare(node) * 100)}%</span>
          </span>
        ) : node.state === "locked" && missing ? (
          <ul>
            <NeedLine need={missing} compact />
          </ul>
        ) : (
          <span className="text-hud-label text-hud-good">{node.gives.line}</span>
        )}
      </span>
    </button>
  );
};
