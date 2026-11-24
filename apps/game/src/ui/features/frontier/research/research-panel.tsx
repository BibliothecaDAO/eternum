import "./research-tree.css";

import { isOathResearch } from "@bibliothecadao/eternum";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPage, HudRanked, HudTier, HudTierStep } from "@/ui/design-system/kit/hud-elements";
import type { Fix } from "@/ui/design-system/kit/refusal";
import { CLOSE, RESEARCH, RESEARCH_TREE, RESEARCHING, type Rank, tierNumeral } from "@/ui/design-system/kit/words";
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
  essence,
  labor,
  castleLevel,
}: {
  nodes: readonly TreeNode[];
  picked: string | null;
  onPick: (key: string | null) => void;
  sending: ReadonlySet<number>;
  fixFor: (need: Need, node: TreeNode) => Fix | undefined;
  onResearch: (node: TreeNode) => unknown;
  onClose: () => void;
  essence: number;
  labor: number;
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
      cue={<ResearchHeaderCue essence={essence} labor={labor} readyCount={readyCount} />}
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
          onClose={() => onPick(null)}
        />
      ) : (
        <div className="research-bar-idle">
          <span className="text-hud-label text-hud-muted">{RESEARCH_TREE.promptPick}</span>
        </div>
      )}
    </HudPage>
  );
};

const ResearchHeaderCue = ({ essence, labor, readyCount }: { essence: number; labor: number; readyCount: number }) => (
  <span className="research-head__cue">
    <span className="research-balance-pill" data-research-balances>
      <span className="research-balance-item tabular-nums">
        <Icon name="essence" size={16} />
        <span>{formatShort(essence)}</span>
      </span>
      <span className="research-balance-item tabular-nums">
        <Icon name="labor" size={16} />
        <span>{formatShort(labor)}</span>
      </span>
    </span>
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

const SCROLL_CUE_THRESHOLD_PX = 4;

const hasMoreBelow = (element: Pick<HTMLElement, "scrollHeight" | "clientHeight" | "scrollTop">): boolean =>
  element.scrollHeight - element.clientHeight - element.scrollTop > SCROLL_CUE_THRESHOLD_PX;

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
  const [moreBelow, setMoreBelow] = useState(false);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateScroll = () => setMoreBelow(scroll ? hasMoreBelow(scroll) : false);
    const update = () => {
      setMeasured(measureResearchLinks(canvas, links));
      updateScroll();
    };
    update();
    scroll?.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (scroll) observer?.observe(scroll);
    observer?.observe(canvas);
    for (const nodeEl of canvas.querySelectorAll("[data-node]")) observer?.observe(nodeEl);
    return () => {
      scroll?.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      observer?.disconnect();
    };
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
      {moreBelow && (
        <div className="research-scroll-cue" data-research-scroll-cue aria-hidden="true">
          <span className="research-scroll-cue__pill">{`${RESEARCH_TREE.moreBelow} ▾`}</span>
        </div>
      )}
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
        data-has-tier={node.tier > 0 || undefined}
        data-selected={picked || undefined}
        aria-pressed={picked}
        className="ui-pick research-node"
        onClick={onPick}
      >
        <div className="research-node__head">
          <span className="research-node__icon">
            <Icon name={node.icon} size={32} />
            {(node.state === "done" || (node.tier > 0 && node.state !== "ready")) && (
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
              className={cn(
                "research-node__delta research-node__delta--desktop tabular-nums",
                node.state === "ready"
                  ? "text-hud-good"
                  : node.state === "done" || node.tier > 0
                    ? "text-hud-gold"
                    : "text-hud-muted",
              )}
            >
              <HudRanked words={researchEffectLine(node)} />
            </span>
            <span
              data-research-effect-short
              aria-hidden="true"
              className={cn(
                "research-node__delta research-node__delta--phone tabular-nums",
                node.state === "ready"
                  ? "text-hud-good"
                  : node.state === "done" || node.tier > 0
                    ? "text-hud-gold"
                    : "text-hud-muted",
              )}
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
        <div className="research-node__phone-pill" data-phone-pill data-pill-tone={badge.tone} aria-hidden="true">
          {node.state === "ready" && price.length > 0 ? (
            <PhonePriceInline price={price} />
          ) : node.state === "short" && missing && isPrice(missing) ? (
            <PhonePriceInline price={[missing]} />
          ) : (
            <span>{phoneStatusText(node, missing, badge.text)}</span>
          )}
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

const phoneStatusText = (node: TreeNode, missing: Need | undefined, fallback: string): string => {
  if (node.state === "done" || node.tier > 0) return fallback;
  if (missing?.kind === "level") return missing.level;
  if (missing?.kind === "tier") return missing.node;
  if (missing?.kind === "stands") return RESEARCH_TREE.buildFirst;
  if (missing?.kind === "store") return missing.level;
  return fallback;
};

const PhonePriceInline = ({ price }: { price: readonly Extract<Need, { kind: "essence" | "labor" }>[] }) => {
  const nonZero = price.filter((need) => need.need > 0);
  const shown = nonZero.length > 0 ? nonZero : price.slice(0, 1);
  return (
    <span className="research-phone-price tabular-nums">
      {shown.length === 1 && <Icon name={shown[0]!.kind} size={12} />}
      <span>{shown.map((need) => formatShort(need.need)).join(" / ")}</span>
    </span>
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
      <div className="research-bar__lead">
        <span className="research-bar__icon">
          <Icon name={node.icon} size={32} />
        </span>
        <div className="research-bar__copy">
          <div className="research-bar__headline">
            <span className="research-bar__name">{node.name}</span>
            <LevelLine node={node} />
          </div>
          <div className="research-bar__meta">
            <span data-choice-summary className="research-bar__line">
              {node.gives.line}
              {" · "}
              <span className="tabular-nums text-hud-good">
                <HudRanked words={researchEffectLine(node)} />
              </span>
            </span>
            {missing && (
              <span
                data-lock-reason
                className={cn("research-bar__reason", node.state === "short" ? "text-hud-warn" : "text-hud-bad")}
              >
                <Icon name={needIcon(missing)} size={14} />
                <span>{needLine(missing)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="research-bar__right">
        {showFooter && (
          <div data-research-footer className="research-bar__footer">
            <span className="research-bar__prices">
              {price.map((need) => (
                <span
                  key={need.kind}
                  aria-label={needLine(need)}
                  className={cn(
                    "research-bar__price tabular-nums",
                    need.met ? "text-hud-ink" : node.state === "short" ? "text-hud-warn" : "text-hud-bad",
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
        <button type="button" aria-label={CLOSE} onClick={onClose} className="research-bar__dismiss">
          <Icon name="close" size={16} />
        </button>
      </div>
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
      <span className="text-hud-label text-hud-muted">
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
