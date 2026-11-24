import "./research-tree.css";

import { isOathResearch } from "@bibliothecadao/eternum";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRanked, HudTabs, HudTier, HudTierStep } from "@/ui/design-system/kit/hud-elements";
import type { Fix } from "@/ui/design-system/kit/refusal";
import { CLOSE, RESEARCH, RESEARCH_TREE, RESEARCHING, type Rank } from "@/ui/design-system/kit/words";
import { formatAmount, formatExact, formatShort, rankName } from "@bibliothecadao/types";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  type Branch,
  firstMissing,
  type Need,
  needLine,
  type NodeState,
  readResearchLinks,
  RESEARCH_ERAS,
  researchActionName,
  researchEffectLine,
  type ResearchLink,
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
  picked: string | null;
  onPick: (key: string | null) => void;
  sending: ReadonlySet<number>;
  fixFor: (need: Need, node: TreeNode) => Fix | undefined;
  onResearch: (node: TreeNode) => unknown;
  onClose: () => void;
}) => {
  const [filter, setFilter] = useState<Branch | null>(null);
  const node = picked === null ? undefined : nodes.find(({ key }) => key === picked);
  const visibleBranches = useMemo(() => (filter === null ? BRANCHES : [filter]), [filter]);
  const visibleNodes = useMemo(
    () => nodes.filter((item) => visibleBranches.includes(item.branch)),
    [nodes, visibleBranches],
  );
  const links = useMemo(() => readResearchLinks(visibleNodes), [visibleNodes]);
  const firstReadyKey = useMemo(() => visibleNodes.find((item) => item.state === "ready")?.key, [visibleNodes]);

  return (
    <HudPage label={RESEARCH} icon="research" fills onClose={onClose}>
      <HudTabs
        size="sm"
        value={filter}
        onChange={(key) => setFilter(filter === key ? null : key)}
        tabs={BRANCHES.map((key) => ({ key, label: RESEARCH_TREE.branches[key], icon: BRANCH_ICONS[key] }))}
      />
      <ResearchTreeCanvas
        branches={visibleBranches}
        nodes={visibleNodes}
        links={links}
        pickedKey={node?.key ?? null}
        firstReadyKey={firstReadyKey}
        sending={sending}
        onPick={(key) => onPick(key)}
        onResearch={onResearch}
      />
      {node && (
        <NodeActionBar
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

const ResearchTreeCanvas = ({
  branches,
  nodes,
  links,
  pickedKey,
  firstReadyKey,
  sending,
  onPick,
  onResearch,
}: {
  branches: readonly Branch[];
  nodes: readonly TreeNode[];
  links: readonly ResearchLink[];
  pickedKey: string | null;
  firstReadyKey: string | undefined;
  sending: ReadonlySet<number>;
  onPick: (key: string) => void;
  onResearch: (node: TreeNode) => unknown;
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<MeasuredLinks | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => setMeasured(measureResearchLinks(canvas, links));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    for (const nodeEl of canvas.querySelectorAll("[data-node]")) observer.observe(nodeEl);
    return () => observer.disconnect();
  }, [branches, links, pickedKey, sending]);

  return (
    <div className="research-tree-scroll overflow-y-auto">
      <div ref={canvasRef} className="research-tree-canvas" data-research-tree>
        {measured && measured.paths.length > 0 && <ResearchLinksSvg measured={measured} />}
        <div className="research-tree__eras" data-research-eras>
          <span aria-hidden="true" />
          {RESEARCH_ERAS.map((era) => (
            <div key={era} className="research-era-head text-hud-label" data-era={era}>
              <HudTier tier={(era + 1) as Rank} />
              <span>{rankName(era)}</span>
            </div>
          ))}
        </div>
        <div className="research-tree__tracks" data-single-branch={branches.length === 1 || undefined}>
          {branches.map((branch) => {
            const branchNodes = nodes.filter((item) => item.branch === branch);
            if (branchNodes.length === 0) return null;
            return (
              <ResearchTrack
                key={branch}
                branch={branch}
                nodes={branchNodes}
                pickedKey={pickedKey}
                firstReadyKey={firstReadyKey}
                sending={sending}
                onPick={onPick}
                onResearch={onResearch}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ResearchTrack = ({
  branch,
  nodes,
  pickedKey,
  firstReadyKey,
  sending,
  onPick,
  onResearch,
}: {
  branch: Branch;
  nodes: readonly TreeNode[];
  pickedKey: string | null;
  firstReadyKey: string | undefined;
  sending: ReadonlySet<number>;
  onPick: (key: string) => void;
  onResearch: (node: TreeNode) => unknown;
}) => (
  <section className="research-track" data-branch={branch}>
    <div className="research-track__head text-hud-label">
      <Icon name={BRANCH_ICONS[branch]} size={18} />
      <span>{RESEARCH_TREE.branches[branch]}</span>
    </div>
    {RESEARCH_ERAS.map((era) => {
      const cellNodes = nodes.filter((item) => item.era === era);
      return (
        <div key={era} className="research-era-cell" data-era-cell={era}>
          {cellNodes.map((item) => (
            <TreeNodeCard
              key={item.key}
              node={item}
              picked={item.key === pickedKey}
              primaryAction={item.key === firstReadyKey}
              sending={sending.has(item.row)}
              onPick={() => onPick(item.key)}
              onUpgrade={() => onResearch(item)}
            />
          ))}
        </div>
      );
    })}
  </section>
);

const TreeNodeCard = ({
  node,
  picked,
  primaryAction,
  sending,
  onPick,
  onUpgrade,
}: {
  node: TreeNode;
  picked: boolean;
  primaryAction: boolean;
  sending: boolean;
  onPick: () => void;
  onUpgrade: () => void;
}) => {
  const slotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (picked) slotRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [picked]);
  const look = STATE_LOOK[node.state];
  const missing = firstMissing(node);
  const price = node.needs.filter(isPrice);
  const showDirectUpgrade = node.state === "ready" && !picked;

  return (
    <div ref={slotRef} className="research-node-slot">
      <div
        role="button"
        tabIndex={0}
        data-node={node.key}
        data-state={node.state}
        data-has-tier={node.tier > 0 || undefined}
        data-selected={picked || undefined}
        className="ui-pick research-node"
        onClick={(event) => {
          if (!(event.target as Element).closest("button")) onPick();
        }}
        onKeyDown={(event) => {
          if ((event.target as Element).closest("button")) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPick();
          }
        }}
      >
        <div className="research-node__head">
          <span className="research-node__icon">
            <Icon name={node.icon} size={36} />
            {node.state === "done" && (
              <span className="research-node__mark" data-tone="done" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            )}
            {node.state === "locked" && node.tier === 0 && (
              <span className="research-node__mark" data-tone="locked" aria-hidden="true">
                <Icon name="lock" size={11} />
              </span>
            )}
          </span>
          <div className="research-node__body">
            <span className={cn("research-node__title text-hud-strong", look.text)}>{node.name}</span>
            <span
              data-research-effect
              className={cn(
                "research-node__delta text-hud-label tabular-nums",
                node.state === "done" ? "text-hud-ink" : node.state === "ready" ? "text-hud-good" : "text-hud-muted",
              )}
            >
              <HudRanked words={researchEffectLine(node)} />
            </span>
            <TierPips node={node} />
          </div>
        </div>
        <div className="research-node__foot">
          {node.state === "ready" && (
            <>
              <PriceChips price={price} />
              {showDirectUpgrade ? (
                <HudButton
                  kind={primaryAction ? "primary" : "secondary"}
                  size="sm"
                  busy={sending ? RESEARCHING : undefined}
                  aria-label={researchActionName(node)}
                  onClick={() => onUpgrade()}
                >
                  {RESEARCH_TREE.upgrade}
                </HudButton>
              ) : (
                <StatePill state={node.state} />
              )}
            </>
          )}
          {node.state === "done" && <StatePill state="done" />}
          {(node.state === "locked" || node.state === "short") && (
            <>
              {missing && (
                <span data-lock-reason className="inline-flex min-w-0 items-center gap-1 text-hud-label text-hud-bad">
                  <Icon name={needIcon(missing)} size={13} />
                  <span className="truncate">{needLine(missing)}</span>
                </span>
              )}
              <StatePill state={node.state} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TierPips = ({ node }: { node: TreeNode }) => (
  <span className="research-pips" data-pips={node.maxTier} aria-hidden="true">
    {Array.from({ length: node.maxTier }, (_, index) => (
      <span
        key={index}
        className="research-pip"
        data-filled={index < node.tier || undefined}
        data-next={index === node.tier && node.state === "ready" ? "" : undefined}
      />
    ))}
  </span>
);

const PriceChips = ({ price }: { price: readonly Extract<Need, { kind: "essence" | "labor" }>[] }) => (
  <span className="research-node__costs">
    {price.map((need) => (
      <span
        key={need.kind}
        className={cn("research-cost text-hud-label tabular-nums", need.met ? "text-hud-ink" : "text-hud-bad")}
      >
        <Icon name={need.kind} size={13} />
        {formatShort(need.need)}
      </span>
    ))}
  </span>
);

const StatePill = ({ state }: { state: NodeState }) => (
  <span className="research-state-pill text-hud-label" data-state={state}>
    {state === "done" && <Icon name="check" size={12} />}
    {RESEARCH_TREE.states[state]}
  </span>
);

type MeasuredLink = {
  key: string;
  state: ResearchLink["state"];
  d: string;
  midX: number;
  midY: number;
};

type MeasuredLinks = {
  width: number;
  height: number;
  paths: MeasuredLink[];
};

const measureResearchLinks = (canvas: HTMLDivElement, links: readonly ResearchLink[]): MeasuredLinks | null => {
  const rootRect = canvas.getBoundingClientRect();
  if (rootRect.width === 0 || rootRect.height === 0) return null;
  const paths: MeasuredLink[] = [];
  for (const link of links) {
    const fromEl = canvas.querySelector(`[data-node="${link.from}"]`);
    const toEl = canvas.querySelector(`[data-node="${link.to}"]`);
    if (!fromEl || !toEl) continue;
    const from = fromEl.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    const horizontal = to.left >= from.right - 4;
    if (horizontal) {
      const x1 = from.right - rootRect.left;
      const y1 = from.top + from.height / 2 - rootRect.top;
      const x2 = to.left - rootRect.left;
      const y2 = to.top + to.height / 2 - rootRect.top;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      paths.push({
        key: link.key,
        state: link.state,
        d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
        midX,
        midY,
      });
    } else {
      const x1 = from.left + from.width / 2 - rootRect.left;
      const y1 = from.bottom - rootRect.top;
      const x2 = to.left + to.width / 2 - rootRect.left;
      const y2 = to.top - rootRect.top;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      paths.push({
        key: link.key,
        state: link.state,
        d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
        midX,
        midY,
      });
    }
  }
  return { width: rootRect.width, height: rootRect.height, paths };
};

const ResearchLinksSvg = ({ measured }: { measured: MeasuredLinks }) => (
  <svg
    className="research-tree__links"
    viewBox={`0 0 ${measured.width} ${measured.height}`}
    aria-hidden="true"
    data-research-links
  >
    {measured.paths.map((link) => (
      <g key={link.key}>
        <path className="research-link" data-link={link.key} data-link-state={link.state} d={link.d} />
        {link.state !== "locked" && (
          <circle className="research-link-dot" data-link-state={link.state} cx={link.midX} cy={link.midY} r={3.5} />
        )}
      </g>
    ))}
  </svg>
);

const STATE_LOOK: Record<NodeState, { icon?: IconMeaning; frame: string; text: string }> = {
  done: { icon: "check", frame: "border-hud-line bg-hud-well", text: "text-hud-ink" },
  ready: { icon: "research", frame: "border-hud-good bg-hud-chosen", text: "text-hud-ink" },
  short: { frame: "border-hud-line", text: "text-hud-ink" },
  locked: { icon: "lock", frame: "border-hud-divider opacity-60", text: "text-hud-muted" },
};

const BRANCH_ICONS: Record<Branch, IconMeaning> = { economy: "farm", army: "barracks", castle: "spire" };
const BRANCHES = Object.keys(RESEARCH_TREE.branches) as Branch[];

export const NodeTile = ({ node, onPick }: { node: TreeNode; onPick: () => void }) => {
  const look = STATE_LOOK[node.state];
  return (
    <button
      type="button"
      onClick={onPick}
      data-tip={tileTip(node)}
      data-node={node.key}
      data-state={node.state}
      className={cn(
        "relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center",
        node.state === "locked" && node.tier > 0 ? "border-hud-divider" : look.frame,
      )}
    >
      <Icon name={node.icon} size={32} />
      <span className={cn("break-words text-hud-label leading-tight", look.text)}>{node.name}</span>
      {look.icon && (
        <span className="absolute right-0.5 top-0.5">
          <Icon name={look.icon} size={12} />
        </span>
      )}
    </button>
  );
};

const tileTip = (node: TreeNode) =>
  `${node.name} · ${node.state === "done" ? RESEARCH_TREE.states.done : RESEARCH_TREE.price(formatAmount(node.price?.essence))}`;

const NodeActionBar = ({
  node,
  sending,
  fix,
  onResearch,
  onClose,
}: {
  node: TreeNode;
  sending: boolean;
  fix: (need: Need) => Fix | undefined;
  onResearch: () => void;
  onClose: () => void;
}) => {
  const missing = firstMissing(node);
  const fixing = missing && fix(missing);
  const price = node.needs.filter(isPrice);
  const showFooter = node.state !== "done" && (price.length > 0 || fixing || node.state === "ready");
  return (
    <div data-lab="node-choice" className="research-bar">
      <div className="research-bar__top">
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
          <HudRanked words={researchEffectLine(node)} />
        </span>
      </span>
      {missing && (
        <span data-lock-reason className="flex items-center gap-2 text-hud-label text-hud-bad">
          <Icon name={needIcon(missing)} size={16} />
          {needLine(missing)}
        </span>
      )}
      {showFooter && (
        <div data-research-footer className="research-bar__footer">
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
          {node.state === "ready" ? (
            <HudButton
              kind="primary"
              busy={sending ? RESEARCHING : undefined}
              aria-label={researchActionName(node)}
              onClick={onResearch}
            >
              {RESEARCH_TREE.upgrade}
            </HudButton>
          ) : (
            fixing && (
              <HudButton kind="primary" icon={fixing.icon} onClick={fixing.onFix}>
                {fixing.word}
              </HudButton>
            )
          )}
        </div>
      )}
    </div>
  );
};

const isPrice = (need: Need): need is Extract<Need, { kind: "essence" | "labor" }> =>
  need.kind === "essence" || need.kind === "labor";

const needIcon = (need: Need): IconMeaning => {
  switch (need.kind) {
    case "essence":
      return "essence";
    case "labor":
      return "labor";
    case "level":
    case "store":
      return "realm";
    case "stands":
    case "tier":
      return need.icon;
  }
};

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

const tierOf = (node: TreeNode) => node.tier as Rank;
