import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Check, Lock } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourcesIds } from "@bibliothecadao/types";
import { Fragment, useState } from "react";
import { FRONTIER_BUILDING_NAMES } from "../build/building-names";
import { DEPTH_ART } from "../depth-art";
import { MAP_SITE_ART } from "../sites/site-art";
import { Chip, TierBanner } from "../frontier-chips";
import { formatAmount } from "../frontier-format";
import {
  depthNode,
  firstOpenNode,
  type ResearchNodeView,
  type ResearchPlan,
  siteNode,
  TREE_BUILDINGS,
  tierNode,
} from "./research-plan";
import { FrontierSheet } from "../frontier-sheet";

const ESSENCE_ICON = `/images/resources/${ResourcesIds.Essence}.png`;
const NUMERALS = ["", "I", "II", "III"] as const;

/**
 * Frontier's research (design §3.9, mockup 3): a lit tree of the realm's building tiers, the map's Shrine and Well,
 * and the three Ethereal depths, each a medallion. Learned is gold with a check, open glows with its Essence price,
 * locked is grey behind a lock. The chosen node shows at the foot with what it changes and one button carrying its
 * price. At most one word a node: the sites' names and the depths' numerals.
 */
export const ResearchSheet = ({
  plan,
  research,
  onClose,
}: {
  plan: ResearchPlan;
  research: (node: ResearchNodeView) => Promise<void>;
  onClose: () => void;
}) => {
  const [chosenId, setChosenId] = useState(() => firstOpenNode(plan)?.node);
  const chosen = plan.nodes.find(({ node }) => node === chosenId);
  const [pending, setPending] = useState(false);
  const affordable = chosen !== undefined && plan.essence !== undefined && plan.essence >= chosen.price;
  const canResearch = !pending && chosen?.state === "open" && affordable;

  const buy = async () => {
    if (!chosen) return;
    setPending(true);
    try {
      await research(chosen);
    } finally {
      setPending(false);
    }
  };

  const medallion = (node: ResearchNodeView | undefined, art: string, label?: string, banner?: 2 | 3) =>
    node && (
      <Medallion
        node={node}
        art={art}
        label={label}
        banner={banner}
        chosen={node.node === chosenId}
        onChoose={() => setChosenId(node.node)}
      />
    );

  return (
    <FrontierSheet label="Research" onClose={onClose} workspace bodyClassName="gap-0 overflow-hidden px-0 pb-0">
      <header className="flex items-center justify-between px-4 pb-2">
        <h2 className="frontier-title">Research</h2>
        <Chip label="Essence" icon={<img src={ESSENCE_ICON} alt="" />} value={formatAmount(plan.essence)} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-4 gap-x-2 gap-y-1">
          {TREE_BUILDINGS.map((category) => (
            <TierColumn
              key={category}
              second={medallion(tierNode(plan, category, 2), BUILDING_IMAGES_PATH[category], undefined, 2)}
              third={medallion(tierNode(plan, category, 3), BUILDING_IMAGES_PATH[category], undefined, 3)}
              linked={tierNode(plan, category, 2)?.state === "learned"}
            />
          ))}
        </div>
        <hr className="my-4 border-[#46351c]" />
        <div className="flex justify-center gap-6">
          {medallion(siteNode(plan, "Shrine"), MAP_SITE_ART.Shrine, "Shrine")}
          {medallion(siteNode(plan, "Well"), MAP_SITE_ART.Well, "Well")}
        </div>
        <div className="mt-5 flex items-start justify-center">
          {([1, 2, 3] as const).map((depth) => (
            <Fragment key={depth}>
              {depth > 1 && <Link lit={depthNode(plan, (depth - 1) as 1 | 2)?.state === "learned"} horizontal />}
              {medallion(depthNode(plan, depth), DEPTH_ART[depth], NUMERALS[depth])}
            </Fragment>
          ))}
        </div>
      </div>
      {chosen && <ChosenNode node={chosen} canResearch={canResearch} onResearch={() => void buy()} />}
    </FrontierSheet>
  );
};

/** One building's tiers, II above III, joined by a line that lights once II is learned. */
const TierColumn = ({
  second,
  third,
  linked,
}: {
  second: React.ReactNode;
  third: React.ReactNode;
  linked: boolean;
}) => (
  <div className="flex flex-col items-center">
    {second}
    <Link lit={linked} />
    {third}
  </div>
);

const Link = ({ lit, horizontal = false }: { lit: boolean; horizontal?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      horizontal ? "mt-10 h-1 w-6 shrink-0" : "h-6 w-1",
      "rounded-full",
      lit ? "bg-[#f6ac1d]" : "bg-[#46351c]",
    )}
  />
);

const Medallion = ({
  node,
  art,
  label,
  banner,
  chosen,
  onChoose,
}: {
  node: ResearchNodeView;
  art: string;
  label?: string;
  banner?: 2 | 3;
  chosen: boolean;
  onChoose: () => void;
}) => (
  <button
    type="button"
    aria-pressed={chosen}
    aria-label={`${nodeTitle(node)}, ${node.state}`}
    data-research-node={node.node}
    onClick={onChoose}
    className="flex flex-col items-center gap-1"
  >
    <span
      className={cn(
        "relative flex size-[76px] items-center justify-center rounded-full border-4 bg-[#15100a] p-1",
        node.state === "learned" && "border-[#f6ac1d] shadow-[0_0_14px_rgba(246,172,29,0.45)]",
        node.state === "open" && "border-[#f3d08a] shadow-[0_0_22px_rgba(246,172,29,0.7)]",
        node.state === "locked" && "border-[#46351c]",
        chosen && "ring-2 ring-[#fff3c4] ring-offset-2 ring-offset-[#15100a]",
      )}
    >
      {/* The building renders carry wide margins: clipped to the medallion, they are drawn larger to fill it. */}
      <span className="size-full overflow-hidden rounded-full">
        <img
          src={art}
          alt=""
          className={cn(
            "size-full object-contain",
            banner && "scale-[1.9]",
            node.state === "locked" && "opacity-45 grayscale",
          )}
        />
      </span>
      {node.state === "learned" && (
        <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-[#9fd06a]">
          <Check className="size-4" />
        </span>
      )}
      {node.state === "locked" && (
        <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-[#2a2013]">
          <Lock className="size-4 opacity-80" />
        </span>
      )}
      {banner && (
        <span className="absolute -bottom-2">
          <TierBanner tier={banner} large />
        </span>
      )}
    </span>
    {label && <span className="font-[Lexend] text-[13px] font-extrabold text-[#a2926f]">{label}</span>}
    {node.state !== "learned" && (
      <span className={cn("mt-1", node.state === "locked" && "opacity-50")}>
        <Chip small label="Essence" icon={<img src={ESSENCE_ICON} alt="" />} value={formatAmount(node.price)} />
      </span>
    )}
  </button>
);

/** The chosen node at the foot: its art, name and tier, what it changes, and the one button with its price. */
const ChosenNode = ({
  node,
  canResearch,
  onResearch,
}: {
  node: ResearchNodeView;
  canResearch: boolean;
  onResearch: () => void;
}) => (
  <footer className="frontier-sheet flex items-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
    <img src={nodeArt(node)} alt="" className="size-20 shrink-0 object-contain" />
    <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
      <span className="flex items-center gap-2">
        <span className="frontier-title">{nodeTitle(node)}</span>
        {node.effect.kind === "tier" && <TierBanner tier={node.effect.tier} large />}
      </span>
      {node.gain && (
        <span className="whitespace-nowrap">
          <Chip
            small
            label="With it"
            icon={<img src={node.gain.icon} alt="" />}
            value={`+${formatAmount(node.gain.now)} → +${formatAmount(node.gain.next)}`}
          />
        </span>
      )}
    </span>
    <button
      type="button"
      aria-label="Research"
      disabled={!canResearch}
      onClick={onResearch}
      className="frontier-primary flex shrink-0 items-center justify-center px-4"
    >
      <Chip
        tone="price"
        label="Costs Essence"
        icon={<img src={ESSENCE_ICON} alt="" />}
        value={formatAmount(node.price)}
      />
    </button>
  </footer>
);

const nodeTitle = ({ effect }: ResearchNodeView): string =>
  effect.kind === "tier"
    ? (FRONTIER_BUILDING_NAMES[effect.category] ?? "")
    : effect.kind === "site"
      ? effect.site
      : NUMERALS[effect.depth];

export const nodeArt = ({ effect }: ResearchNodeView): string =>
  effect.kind === "tier"
    ? BUILDING_IMAGES_PATH[effect.category as keyof typeof BUILDING_IMAGES_PATH]
    : effect.kind === "site"
      ? MAP_SITE_ART[effect.site]
      : DEPTH_ART[effect.depth];
