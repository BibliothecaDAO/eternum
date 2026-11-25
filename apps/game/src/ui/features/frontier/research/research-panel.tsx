import "./research-tree.css";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudActions, HudButton, HudPage, HudPrice, HudRanked, HudTier } from "@/ui/design-system/kit/hud-elements";
import type { Fix } from "@/ui/design-system/kit/refusal";
import { RESEARCH, RESEARCH_TREE, RESEARCHING, type Rank, tierNumeral } from "@/ui/design-system/kit/words";
import { formatAmount, formatShort, rankName } from "@bibliothecadao/types";
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
  researchEraForLevel,
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
  castleLevel,
}: {
  nodes: readonly TreeNode[];
  picked: string | null;
  onPick: (key: string | null) => void;
  sending: ReadonlySet<number>;
  fixFor: (need: Need, node: TreeNode) => Fix | undefined;
  onResearch: (node: TreeNode) => unknown;
  onClose: () => void;
  castleLevel: number;
}) => {
  const node = picked === null ? undefined : nodes.find(({ key }) => key === picked);
  const links = useMemo(() => readResearchLinks(nodes), [nodes]);
  const readyCount = useMemo(() => nodes.filter((item) => item.state === "ready").length, [nodes]);
  const currentEra = researchEraForLevel(castleLevel);

  return (
    <HudPage
      label={RESEARCH}
      icon="research"
      fills
      cue={<ResearchHeaderCue readyCount={readyCount} />}
      bodyClassName="research-page-body"
      onClose={onClose}
    >
      <ResearchTreeCanvas
        nodes={nodes}
        links={links}
        currentEra={currentEra}
        pickedKey={node?.key ?? null}
        onPick={(key) => onPick(key)}
      />
      {node ? (
        <NodeActionBar
          key={node.key}
          node={node}
          sending={sending.has(node.row)}
          fix={(need) => fixFor(need, node)}
          onResearch={() => onResearch(node)}
        />
      ) : (
        <div className="research-bar-idle">{RESEARCH_TREE.promptPick}</div>
      )}
    </HudPage>
  );
};

const ResearchHeaderCue = ({ readyCount }: { readyCount: number }) => (
  <span className="research-head__cue">
    <span className="research-legend" aria-hidden="true">
      <span className="research-legend__item">
        <span className="research-legend__dot" data-state="ready" />
        <span>{RESEARCH_TREE.readyCount(readyCount)}</span>
      </span>
      <span className="research-legend__item">
        <span className="research-legend__dot" data-state="done" />
        <span>{RESEARCH_TREE.states.done}</span>
      </span>
      <span className="research-legend__item">
        <span className="research-legend__dot" data-state="locked" />
        <span>{RESEARCH_TREE.states.locked}</span>
      </span>
    </span>
  </span>
);

const ResearchTreeCanvas = ({
  nodes,
  links,
  currentEra,
  pickedKey,
  onPick,
}: {
  nodes: readonly TreeNode[];
  links: readonly ResearchLink[];
  currentEra: number;
  pickedKey: string | null;
  onPick: (key: string) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<MeasuredLinks | null>(null);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () => setMeasured(measureResearchLinks(canvas, links));
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (scroll) observer?.observe(scroll);
    observer?.observe(canvas);
    for (const nodeEl of canvas.querySelectorAll("[data-node]")) observer?.observe(nodeEl);
    return () => observer?.disconnect();
  }, [nodes, links, pickedKey]);

  return (
    <div className="research-tree-viewport">
      <div ref={scrollRef} className="research-tree-scroll overflow-y-auto">
        <div ref={canvasRef} className="research-tree-canvas" data-research-tree>
          <div className="research-tree__backdrop" aria-hidden="true">
            <div className="research-tree__backdrop-rail" />
            {RESEARCH_ERAS.map((era) => (
              <div
                key={era}
                className="research-tree__backdrop-era"
                data-current-era={currentEra === era ? "" : undefined}
              />
            ))}
          </div>
          {measured && measured.paths.length > 0 && <ResearchLinksSvg measured={measured} />}
          <div className="research-tree__eras" data-research-eras>
            <div className="research-era-rail-label">{RESEARCH_TREE.branchColumn}</div>
            {RESEARCH_ERAS.map((era) => (
              <div
                key={era}
                className="research-era-head"
                data-era={era}
                data-current-era={currentEra === era ? "" : undefined}
              >
                <HudTier tier={(era + 1) as Rank} />
                <span className="research-era-head__name">{rankName(era)}</span>
                {currentEra === era && <span className="research-era-head__current">{RESEARCH_TREE.currentEra}</span>}
              </div>
            ))}
          </div>
          <div className="research-tree__tracks">
            {BRANCHES.map((branch) => {
              const branchNodes = nodes.filter((item) => item.branch === branch);
              if (branchNodes.length === 0) return null;
              return (
                <ResearchTrack key={branch} branch={branch} nodes={branchNodes} pickedKey={pickedKey} onPick={onPick} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const ResearchTrack = ({
  branch,
  nodes,
  pickedKey,
  onPick,
}: {
  branch: Branch;
  nodes: readonly TreeNode[];
  pickedKey: string | null;
  onPick: (key: string) => void;
}) => (
  <section className="research-track" data-branch={branch}>
    <div className="research-track__head" data-branch-head={branch}>
      <span className="research-track__icon">
        <Icon name={BRANCH_ICONS[branch]} size={20} />
      </span>
      <span className="research-track__labels">
        <span className="research-track__title">{RESEARCH_TREE.branches[branch]}</span>
        <span className="research-track__subtitle">{RESEARCH_TREE.branchSubtitles[branch]}</span>
      </span>
    </div>
    {RESEARCH_ERAS.map((era) => {
      const cellNodes = nodes.filter((item) => item.era === era);
      return (
        <div key={era} className="research-era-cell" data-era-cell={era}>
          {cellNodes.map((item) => (
            <TreeNodeCard key={item.key} node={item} picked={item.key === pickedKey} onPick={() => onPick(item.key)} />
          ))}
        </div>
      );
    })}
  </section>
);

const TreeNodeCard = ({ node, picked, onPick }: { node: TreeNode; picked: boolean; onPick: () => void }) => {
  const slotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (picked) slotRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [picked]);
  const look = STATE_LOOK[node.state];
  const missing = firstMissing(node);
  const price = node.needs.filter(isPrice);
  const badge = nodeBadgeLabel(node, missing);

  return (
    <div ref={slotRef} className="research-node-slot">
      <button
        type="button"
        data-node={node.key}
        data-state={node.state}
        data-selected={picked || undefined}
        aria-pressed={picked}
        className="ui-pick research-node"
        onClick={onPick}
      >
        <div className="research-node__head">
          <span className="research-node__icon">
            <Icon name={node.icon} size={32} />
            {node.state === "done" && (
              <span className="research-node__mark" data-tone="done" aria-hidden="true">
                <Icon name="check" size={11} />
              </span>
            )}
            {node.state === "locked" && node.tier === 0 && (
              <span className="research-node__mark" data-tone="locked" aria-hidden="true">
                <Icon name="lock" size={10} />
              </span>
            )}
          </span>
          <div className="research-node__body">
            <span className={cn("research-node__title", look.text)}>{node.name}</span>
            <span
              data-research-effect
              className={cn("research-node__delta research-node__delta--desktop tabular-nums", EFFECT_TONE[node.state])}
            >
              <HudRanked words={researchEffectLine(node)} />
            </span>
            <span
              data-research-effect-short
              aria-hidden="true"
              className={cn("research-node__delta research-node__delta--phone tabular-nums", EFFECT_TONE[node.state])}
            >
              {node.shortEffect}
            </span>
            <TierPips node={node} />
          </div>
        </div>
        <div className="research-node__foot">
          <span className="research-node__foot-left">
            {node.state === "done" ? (
              <span className="research-node__unlocked">
                <Icon name="check" size={11} />
                <span>{RESEARCH_TREE.unlocked}</span>
              </span>
            ) : node.state === "ready" || node.state === "short" ? (
              <PriceChips price={price} />
            ) : (
              missing && (
                <span data-lock-reason className="research-node__reason">
                  <Icon name={needIcon(missing)} size={12} />
                  <span>{needLine(missing)}</span>
                </span>
              )
            )}
          </span>
          <span className="research-state-pill" data-badge-tone={badge.tone}>
            {badge.text}
          </span>
        </div>
      </button>
    </div>
  );
};

const nodeBadgeLabel = (
  node: TreeNode,
  missing: Need | undefined,
): { text: string; tone: "ready" | "done" | "calm" } => {
  if (node.state === "ready") return { text: RESEARCH_TREE.states.ready, tone: "ready" };
  if (node.state === "done") return { text: RESEARCH_TREE.states.done, tone: "done" };
  if (node.tier > 0) {
    return {
      text: RESEARCH_TREE.tierBadge(tierNumeral(node.tier as Rank)),
      tone: "done",
    };
  }
  if (missing?.kind === "level" && node.era > 0) {
    return {
      text: RESEARCH_TREE.eraBadge(tierNumeral((node.era + 1) as Rank)),
      tone: "calm",
    };
  }
  return {
    text: RESEARCH_TREE.states[node.state],
    tone: "calm",
  };
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
    {price
      .filter((need) => need.need > 0)
      .map((need) => (
        <span key={need.kind} className="research-cost tabular-nums" data-short={!need.met ? "" : undefined}>
          <Icon name={need.kind} size={12} />
          <span>{formatShort(need.need)}</span>
        </span>
      ))}
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
          <circle className="research-link-dot" data-link-state={link.state} cx={link.midX} cy={link.midY} r={4} />
        )}
      </g>
    ))}
  </svg>
);

const STATE_LOOK: Record<NodeState, { icon?: IconMeaning; frame: string; text: string }> = {
  done: { icon: "check", frame: "border-hud-line bg-hud-well", text: "text-hud-ink" },
  ready: { icon: "research", frame: "border-hud-good bg-hud-chosen", text: "text-hud-ink" },
  short: { frame: "border-hud-line", text: "text-hud-ink" },
  locked: { icon: "lock", frame: "border-hud-divider opacity-60", text: "research-node__title--locked" },
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
}: {
  node: TreeNode;
  sending: boolean;
  fix: (need: Need) => Fix | undefined;
  onResearch: () => void;
}) => {
  const missing = firstMissing(node);
  const fixing = missing && fix(missing);
  const price = node.state === "done" ? [] : node.needs.filter(isPrice);
  return (
    <div data-lab="node-choice" className="research-bar" data-fix={node.state !== "ready" && fixing ? "" : undefined}>
      <span data-choice-summary className="research-bar__name">
        {node.name}
        {" · "}
        <HudRanked words={researchEffectLine(node)} />
      </span>
      <div data-research-footer className="research-bar__footer">
        <span className="research-bar__meta">
          {price.length > 0 && (
            <HudPrice prices={price.map((need) => ({ of: need.kind, amount: need.need, short: !need.met }))} />
          )}
          {node.state === "done" && <span className="text-hud-good">{RESEARCH_TREE.states.done}</span>}
          {missing && !isPrice(missing) && (
            <span data-lock-reason className="research-bar__reason text-hud-bad">
              <Icon name={needIcon(missing)} size={16} />
              <span>{needLine(missing)}</span>
            </span>
          )}
        </span>
        {node.state !== "done" && (
          <HudActions className="research-bar__verbs">
            {node.state !== "ready" && fixing && (
              <HudButton kind="secondary" icon={fixing.icon} onClick={fixing.onFix}>
                {fixing.word}
              </HudButton>
            )}
            <HudButton
              kind="primary"
              disabled={node.state !== "ready"}
              busy={sending ? RESEARCHING : undefined}
              aria-label={researchActionName(node)}
              onClick={onResearch}
            >
              {RESEARCH_TREE.upgrade}
            </HudButton>
          </HudActions>
        )}
      </div>
    </div>
  );
};

const EFFECT_TONE: Record<NodeState, string> = {
  ready: "text-hud-good",
  done: "text-hud-gold",
  short: "text-hud-muted",
  locked: "text-hud-muted",
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
