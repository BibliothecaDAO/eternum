import { useHudMode } from "@/hooks/use-hud-mode";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import {
  HudButton,
  HudChip,
  HudMeter,
  HudPanel,
  HudPortrait,
  HudTier,
  HudTierStep,
} from "@/ui/design-system/kit/hud-elements";
import { BACK, RESEARCH, RESEARCH_TREE, type Tier, TROOPS, XP } from "@/ui/design-system/kit/words";
import { type ArmyDetailFacts, type AttributeView, readArmyDetail } from "@/ui/features/frontier/army/army-detail";
import { ArmyDetail, AttributeTile, StaminaLine, StatusChips } from "@/ui/features/frontier/army/army-panel";
import { RefillChip } from "@/ui/features/frontier/army/refill";
import { MID_REALM } from "@/ui/features/frontier/research/progression-fixture";
import { BranchHead, Gate, NodeTile, STATE_LOOK } from "@/ui/features/frontier/research/research-panel";
import { readResearchTree, type TreeNode } from "@/ui/features/frontier/research/research-tree";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { formatAmount, formatExact } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { RankGem, RankStep } from "./rank-gem";
import { SkillPoints } from "./skill-points";

/**
 * Lab only, for the owner's pick (27 October): separate side levels and ranked skill points, drawn three ways beside
 * today, one still per address. `?option=today|gems|tiles|highest&surface=card|levelup|research`.
 * - gems: every side shows its own gem; held points are gems by Level up.
 * - tiles: every side is its own tile; the XP bar carries the round's four points.
 * - highest: one gem per building, its highest side; points are a count.
 */
type Option = "today" | "gems" | "tiles" | "highest" | "zero";
type Surface = "card" | "levelup" | "research";
type Point = 2 | 3 | 4 | 5;

const noop = () => undefined;

/** Ranked points: one of each rank every 800 XP, at 100, 200, 400 and 800; each refills its stamina when spent. */
const ROUND_XP = 800;
const MILESTONES: { at: number; rank: Point }[] = [
  { at: 100, rank: 2 },
  { at: 200, rank: 3 },
  { at: 400, rank: 4 },
  { at: 800, rank: 5 },
];
const REFILL: Record<Point, number> = { 2: 20, 3: 40, 4: 60, 5: 80 };

/** Army 2: Battle trained to Uncommon, then lifted to Rare with its Rare point; 460 XP earned, 40 of 120 stamina. */
const EARNED_XP = 460;
const SPENT: Point[] = [3];
const ARMY: ArmyDetailFacts = {
  name: "Army 2",
  art: "knight-t1",
  troops: 1_240,
  // Today's rules: 460 earned, 200 spent on Battle Rare.
  xp: EARNED_XP - 200,
  stamina: { current: 40, max: 120, perExplore: 20 },
  secondsToFull: 2 * 3_600 + 40 * 60,
  revealYield: 120,
  progress: { battle: 3, logistics: 1, scouting: 1, homecoming: 1, scoutingKinds: [] },
  levelXp: [100, 200, 400, 800],
  revealXp: 2,
  shrineXp: 200,
  refillOnLevel: 30,
};

const earnedPoints = (xp: number): { at: number; rank: Point }[] =>
  Array.from({ length: 16 }, (_, k) => ({
    at: Math.floor(k / 4) * ROUND_XP + MILESTONES[k % 4]!.at,
    rank: MILESTONES[k % 4]!.rank,
  })).filter(({ at }) => at <= xp);

const heldPoints = (): Point[] => {
  const held = earnedPoints(EARNED_XP).map(({ rank }) => rank);
  for (const spent of SPENT) held.splice(held.indexOf(spent), 1);
  return held;
};

/** The lowest held point that can lift a side at `level` one rank: a point lifts up to its own rank. */
const pointFor = (level: Tier, held: readonly Point[]): Point | undefined =>
  held.filter((rank) => rank >= level + 1).sort((left, right) => left - right)[0];

const nextMilestone = () => {
  const round = Math.floor(EARNED_XP / ROUND_XP) * ROUND_XP;
  const next = MILESTONES.find(({ at }) => round + at > EARNED_XP)!;
  const previous = [...MILESTONES].reverse().find(({ at }) => round + at <= EARNED_XP);
  const from = round + (previous?.at ?? 0);
  return { rank: next.rank, at: round + next.at, share: (EARNED_XP - from) / (round + next.at - from) };
};

export const ArmyProgressionLab = () => {
  useHudMode("frontier");
  const [params] = useSearchParams();
  const option = (params.get("option") ?? "gems") as Option;
  const surface = (params.get("surface") ?? "card") as Surface;
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]">
      <div className="mx-auto flex w-full max-w-[460px] flex-col p-2">
        <div data-lab="still">
          {params.get("round") ? (
            <SkillPoints
              set={[params.get("round"), params.get("set")].filter(Boolean).join("-")}
              surface={params.get("surface") ?? "levelup"}
              pick={(params.get("pick") ?? "battle") as Parameters<typeof SkillPoints>[0]["pick"]}
              stamina={Number(params.get("stamina") ?? 40)}
            />
          ) : surface === "research" ? (
            <Research option={option} />
          ) : (
            <Army option={option} surface={surface} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ army */

const Army = ({ option, surface }: { option: Option; surface: Surface }) => {
  const army = readArmyDetail(ARMY);
  const refill = <RefillChip price={80} held={600} onRefill={noop} />;
  return (
    <HudPanel title={army.name} icon="troops" collapsible={false} bodyClassName="px-3 pb-3">
      {option === "today" ? (
        <ArmyDetail army={army} refill={refill} sending={false} choosing={surface === "levelup"} onLevelUp={noop} />
      ) : surface === "levelup" ? (
        <PointsLevelUp option={option} attributes={army.attributes} />
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-center gap-3">
            <HudPortrait icon={army.art} label={TROOPS} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex items-center gap-2">
                <StatusChips army={army} />
                <span className="ml-auto flex">{refill}</span>
              </span>
              <StaminaLine army={army} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {army.attributes.map((attribute) => (
              <AttributeTile key={attribute.key} attribute={attribute} onOpen={noop} />
            ))}
          </div>
          {option === "gems" && <GemsXp />}
          {option === "tiles" && <TrackXp />}
          {option === "highest" && <CountXp />}
        </div>
      )}
    </HudPanel>
  );
};

const XpNumber = () => (
  <span className="flex items-baseline gap-1">
    <span className="text-hud-display tabular-nums text-hud-gold">{formatExact(EARNED_XP)}</span>
    <span className="text-hud-strong text-hud-ink">{XP}</span>
  </span>
);

const LevelUpButton = () => (
  <HudButton kind="primary" size="sm" icon="upgrade">
    Level up
  </HudButton>
);

/** Gems: the XP, the points held as their gems, Level up; under them the bar to the next point, its gem at the end. */
const GemsXp = () => {
  const next = nextMilestone();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <XpNumber />
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1" aria-label="Points">
            {heldPoints().map((rank, index) => (
              <HudTier key={index} tier={rank} />
            ))}
          </span>
          <LevelUpButton />
        </span>
      </div>
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <HudMeter share={next.share} label={XP} />
        </span>
        <span className="flex items-center gap-1 text-hud-label tabular-nums text-hud-muted">
          {formatExact(next.at)}
          <span className="opacity-60">
            <HudTier tier={next.rank} />
          </span>
        </span>
      </span>
    </div>
  );
};

/** Tiles: the round's four points over the XP bar at their XP, lit while held, faded once spent or still ahead. */
const TrackXp = () => {
  const held = heldPoints();
  const round = Math.floor(EARNED_XP / ROUND_XP) * ROUND_XP;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <XpNumber />
        <LevelUpButton />
      </div>
      <div className="relative pt-7">
        {MILESTONES.map(({ at, rank }) => {
          const reached = round + at <= EARNED_XP;
          const isHeld = reached && held.includes(rank);
          return (
            <span
              key={at}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{
                left: `${(at / ROUND_XP) * 100}%`,
                transform: at === ROUND_XP ? "translateX(-100%)" : undefined,
              }}
            >
              <span className={cn(!isHeld && "opacity-35", reached && !isHeld && "grayscale")}>
                <HudTier tier={rank} />
              </span>
            </span>
          );
        })}
        <HudMeter share={(EARNED_XP - round) / ROUND_XP} label={XP} />
        <span className="mt-0.5 flex justify-between text-hud-label tabular-nums text-hud-muted">
          <span>{formatExact(round)}</span>
          <span>{formatExact(round + ROUND_XP)}</span>
        </span>
      </div>
    </div>
  );
};

/** Highest: the XP, the points as a count, Level up; the bar to the next point. */
const CountXp = () => {
  const next = nextMilestone();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <XpNumber />
        <span className="flex items-center gap-2">
          <HudChip icons={["upgrade"]} label="Points">
            {`${heldPoints().length} points`}
          </HudChip>
          <LevelUpButton />
        </span>
      </div>
      <HudMeter share={next.share} label={XP} />
    </div>
  );
};

/** The level-up: each side with its next rank, what it gives, the point it takes and the stamina it refills. */
const PointsLevelUp = ({ option, attributes }: { option: Option; attributes: AttributeView[] }) => {
  const held = heldPoints();
  const [chosen, setChosen] = useState(attributes[0]!.key);
  const pick = attributes.find(({ key }) => key === chosen)!;
  const pickPoint = pointFor(pick.level, held);
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <HudButton kind="quiet" size="sm" icon="arrow-left">
          {BACK}
        </HudButton>
        {option === "highest" ? (
          <HudChip icons={["upgrade"]} label="Points">{`${held.length} points`}</HudChip>
        ) : (
          <span className="flex items-center gap-1">
            {held.map((rank, index) => (
              <HudTier key={index} tier={rank} />
            ))}
          </span>
        )}
      </div>
      {attributes.map((attribute) => {
        const point = pointFor(attribute.level, held);
        return (
          <button
            key={attribute.key}
            type="button"
            aria-pressed={chosen === attribute.key}
            onClick={() => setChosen(attribute.key)}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2 py-2 text-left",
              chosen === attribute.key ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
            )}
          >
            <Icon name={attribute.mark} size={32} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5 text-hud-strong text-hud-ink">
                {attribute.name}
                {attribute.next && <HudTierStep from={attribute.level} to={attribute.next.tier} />}
              </span>
              <span className="text-hud-label tabular-nums text-hud-good">{attribute.next?.change}</span>
            </span>
            {point && <PointCost option={option} point={point} />}
          </button>
        );
      })}
      {pickPoint && pick.next && (
        <div className="flex items-center gap-2 border-t border-hud-divider pt-3">
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-hud-body text-hud-ink">
            {pick.name}
            <HudTierStep from={pick.level} to={pick.next.tier} />
          </span>
          <PointCost option={option} point={pickPoint} />
          <HudButton kind="primary">Level up</HudButton>
        </div>
      )}
    </div>
  );
};

/** What a level-up takes and gives back: its point's gem (gems, tiles) and the stamina it refills. */
const PointCost = ({ option, point }: { option: Option; point: Point }) => (
  <span className="flex shrink-0 items-center gap-1.5">
    {option !== "highest" && <HudTier tier={point} />}
    <span className="flex items-center gap-0.5 text-hud-strong tabular-nums text-hud-good">
      <Icon name="stamina" size={14} />
      {`+${REFILL[point]}`}
    </span>
  </span>
);

/* -------------------------------------------------------------- research */

/** Each two-sided row's sides, at their own rank next season: one pick of a side is one rank above Common. */
type SideRank = { key: string; icon: TreeNode["icon"]; name: string; rank: Tier; now: string; next?: string };
/** Next season's side prices by the rank reached, thousands of Essence and labor (reports/frontier-army-tree-1.md). */
const SIDE_PRICE: Record<number, Record<number, [number, number]>> = {
  [research.ROW_FARM]: { 2: [1, 1], 3: [4, 3], 4: [12, 8], 5: [30, 20] },
  [research.ROW_WORKSHOP]: { 2: [2, 2], 3: [8, 6], 4: [24, 16], 5: [60, 40] },
  [research.ROW_BARRACKS]: { 2: [4, 3], 3: [16, 9], 4: [48, 24], 5: [120, 60] },
};
/** Round 4, research from 0: a new first level (half the old first), then the old prices one rank up. */
const ZERO_PRICE: Record<number, Record<number, [number, number]>> = {
  [research.ROW_FARM]: { 1: [0.5, 0.5], 2: [1, 1], 3: [4, 3], 4: [12, 8], 5: [30, 20] },
  [research.ROW_WORKSHOP]: { 1: [1, 1], 2: [2, 2], 3: [8, 6], 4: [24, 16], 5: [60, 40] },
  [research.ROW_BARRACKS]: { 1: [2, 1.5], 2: [4, 3], 3: [16, 9], 4: [48, 24], 5: [120, 60] },
};
/** Round 4's side effects from 0, the same ceilings in five steps: output +20% a rank, storage +40%, Rations -0.2 wheat. */
const zeroEffect = (icon: string, rank: number) => {
  if (icon === "granary" || icon === "storehouse") return `+${rank * 40}%`;
  if (icon === "rations") return String(Math.round((2 - rank * 0.2) * 10) / 10);
  return `+${rank * 20}%`;
};
const isBuilt = (row: number) => (MID_REALM.standing[row] ?? 0) > 0;

/** Next season's Ethereal layers. */
const DEPTH_PRICE = [100_000, 250_000, 500_000];
/** The mid-game realm at castle level 2, on next season's Ethereal prices. */
const REALM = {
  ...MID_REALM,
  castleLevel: 2,
  price: (row: number, tier: number) =>
    row === research.ROW_DEPTH ? { essence: DEPTH_PRICE[tier - 1]!, labor: 0 } : MID_REALM.price(row, tier),
};

const sidesOf = (node: TreeNode): SideRank[] | undefined => {
  if (!node.sides || node.sides.length !== 2 || node.maxTier !== 4) return undefined;
  return node.sides.map((side, index) => {
    const picks = node.taken.filter((mark) => mark === side.icon).length;
    return {
      key: `${node.key}-${index}`,
      icon: side.icon,
      name: side.name,
      rank: (picks + 1) as Tier,
      now: side.now,
      next: picks < 4 ? side.next : undefined,
    };
  });
};

const sidePrice = (node: TreeNode, side: SideRank) => {
  const price = side.rank < 5 ? SIDE_PRICE[node.row]?.[side.rank + 1] : undefined;
  return price && { essence: price[0] * 1_000, labor: price[1] * 1_000 };
};

const HOLDINGS = { essence: REALM.essence, labor: REALM.labor };

const Research = ({ option }: { option: Option }) => {
  const nodes = readResearchTree(REALM);
  const branch = (key: TreeNode["branch"]) => nodes.filter((node) => node.branch === key);
  const [barracks, ...training] = branch("army");
  const picked = option === "tiles" ? `${barracks?.key}-0` : (barracks?.key ?? "");
  const tiles = (node: TreeNode) => <TreeTile key={node.key} node={node} option={option} picked={picked} />;
  return (
    <HudPanel
      title={RESEARCH}
      icon="research"
      collapsible={false}
      className="flex min-h-0 flex-col"
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="grid grid-cols-3 content-start gap-2 px-3 pb-2">
        {(["economy", "army", "castle"] as const).map((key) => (
          <BranchHead key={key} branch={key} />
        ))}
        <div className="flex flex-col gap-2">{branch("economy").map(tiles)}</div>
        <div className="flex flex-col gap-2">
          {barracks && tiles(barracks)}
          {barracks?.gate && (
            <Gate
              met={barracks.gate.met}
              // From 0, the two Barracks purchases that open training reach II.
              word={RESEARCH_TREE.gate(option === "zero" ? `${barracks.name} II` : barracks.gate.name)}
            />
          )}
          {training.map(tiles)}
        </div>
        <div className="flex flex-col">
          {branch("castle").map((node) => (
            <div key={node.key} className="flex flex-col pb-2">
              <NodeTile node={node} picked={false} onPick={noop} />
              {node.leadsTo.length > 0 && <span aria-hidden className="mx-auto -mb-2 h-2 w-0.5 bg-hud-line-strong" />}
            </div>
          ))}
        </div>
      </div>
      {barracks && <Choice node={barracks} option={option} />}
    </HudPanel>
  );
};

/** A tree tile by option: today and highest one gem; gems both sides' gems; tiles a tile per side. */
const TreeTile = ({ node, option, picked }: { node: TreeNode; option: Option; picked: string }) => {
  const sides = sidesOf(node);
  if (option === "zero" && node.maxTier === 4) return <ZeroTreeTile node={node} picked={node.key === picked} />;
  if (!sides || option === "today") return <NodeTile node={node} picked={node.key === picked} onPick={noop} />;
  if (option === "highest") {
    const highest = Math.max(...sides.map(({ rank }) => rank)) - 1;
    return <NodeTile node={{ ...node, tier: highest }} picked={node.key === picked} onPick={noop} />;
  }
  if (option === "tiles")
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1 text-hud-label text-hud-muted">
          <Icon name={node.icon} size={16} />
          {node.name}
        </span>
        {sides.map((side) => (
          <NodeTile
            key={side.key}
            node={{ ...node, key: side.key, icon: side.icon, name: side.name, tier: side.rank - 1 }}
            picked={side.key === picked}
            onPick={noop}
          />
        ))}
      </div>
    );
  const look = STATE_LOOK[node.state];
  return (
    <button
      type="button"
      aria-pressed={node.key === picked}
      className={cn(
        "relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center",
        look.frame,
        node.key === picked && "outline outline-2 outline-offset-1 outline-hud-accent",
      )}
    >
      <Icon name={node.icon} size={36} />
      <span className={cn("text-hud-label leading-tight", look.text)}>{node.name}</span>
      <span className="flex items-center gap-1.5">
        {sides.map((side) => (
          <span key={side.key} className="flex items-center gap-0.5">
            <Icon name={side.icon} size={18} />
            <HudTier tier={side.rank} />
          </span>
        ))}
      </span>
      {look.icon && (
        <span className="absolute right-1 top-1">
          <Icon name={look.icon} size={16} />
        </span>
      )}
    </button>
  );
};

/** Round 4: a ranked row's tile with its ranks from 0; a training building's is I once built. */
const ZeroTreeTile = ({ node, picked }: { node: TreeNode; picked: boolean }) => {
  const sides = sidesOf(node);
  const look = STATE_LOOK[node.state];
  const training = node.branch === "army" && !sides;
  const rank = training ? (isBuilt(node.row) ? 1 + node.tier : 0) : node.tier;
  return (
    <button
      type="button"
      aria-pressed={picked}
      className={cn(
        "relative flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-center",
        node.state === "locked" && rank > 0 ? "border-hud-divider" : look.frame,
        picked && "outline outline-2 outline-offset-1 outline-hud-accent",
      )}
    >
      <Icon name={node.icon} size={36} />
      <span className={cn("text-hud-label leading-tight", look.text)}>{node.name}</span>
      <span className="flex items-center gap-1.5">
        {sides ? (
          sides.map((side) => (
            <span key={side.key} className="flex items-center gap-0.5">
              <Icon name={side.icon} size={18} />
              <RankGem rank={side.rank - 1} />
            </span>
          ))
        ) : (
          <RankGem rank={rank} />
        )}
      </span>
      {look.icon && (
        <span className="absolute right-1 top-1">
          <Icon name={look.icon} size={16} />
        </span>
      )}
    </button>
  );
};

/** The picked row's choice at the panel's foot: Barracks, Drill picked. */
const Choice = ({ node, option }: { node: TreeNode; option: Option }) => {
  const sides = sidesOf(node)!;
  const drill = sides[0]!;
  const price = sidePrice(node, drill)!;
  const frame = (children: ReactNode) => (
    <div className="mx-2 mb-2 flex shrink-0 flex-col gap-2 rounded-lg border border-hud-line-strong bg-hud-surface p-3 shadow-2xl">
      {children}
    </div>
  );
  const foot = (verb: string) => (
    <div className="flex items-center gap-2">
      {option !== "gems" && <Price price={price} />}
      <span className="flex-1" />
      <HudButton kind="primary" disabled={price.essence > HOLDINGS.essence}>
        {RESEARCH_TREE.research(verb)}
      </HudButton>
    </div>
  );
  const close = <Icon name="close" size={18} />;
  if (option === "today") return null;
  if (option === "zero") {
    const zeroPrice = (side: SideRank) => {
      const at = ZERO_PRICE[node.row]?.[side.rank];
      return at && { essence: at[0] * 1_000, labor: at[1] * 1_000 };
    };
    const drillPrice = zeroPrice(drill)!;
    return frame(
      <>
        <div className="flex items-center gap-2">
          <Icon name={node.icon} size={36} />
          <span className="min-w-0 flex-1 text-hud-title text-hud-ink">{node.name}</span>
          {close}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sides.map((side, index) => (
            <span
              key={side.key}
              className={cn(
                "flex flex-col gap-1 rounded-md border px-2 py-1.5",
                index === 0 ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line",
              )}
            >
              <span className="flex items-center gap-1.5">
                <Icon name={side.icon} size={28} />
                <span className="truncate text-hud-strong text-hud-ink">{side.name}</span>
              </span>
              <RankStep from={side.rank - 1} to={side.rank} />
              <span className="truncate text-hud-label tabular-nums text-hud-good">
                {RESEARCH_TREE.step(zeroEffect(side.icon, side.rank - 1), zeroEffect(side.icon, side.rank))}
              </span>
              {zeroPrice(side) && <Price price={zeroPrice(side)!} />}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex-1" />
          <HudButton kind="primary" disabled={drillPrice.essence > HOLDINGS.essence}>
            {RESEARCH_TREE.research(drill.name)}
          </HudButton>
        </div>
      </>,
    );
  }
  if (option === "tiles")
    return frame(
      <>
        <div className="flex items-center gap-2">
          <Icon name={drill.icon} size={36} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-hud-title text-hud-ink">{`${node.name} · ${drill.name}`}</span>
            <HudTierStep from={drill.rank} to={(drill.rank + 1) as Tier} />
          </div>
          {close}
        </div>
        <span className="text-hud-body tabular-nums text-hud-good">{RESEARCH_TREE.step(drill.now, drill.next!)}</span>
        {foot(drill.name)}
      </>,
    );
  const highest = Math.max(...sides.map(({ rank }) => rank)) as Tier;
  return frame(
    <>
      <div className="flex items-center gap-2">
        <Icon name={node.icon} size={36} />
        <span className="min-w-0 flex-1 text-hud-title text-hud-ink">{node.name}</span>
        {option === "highest" && <HudTier tier={highest} />}
        {close}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {sides.map((side, index) => (
          <span
            key={side.key}
            className={cn(
              "flex flex-col gap-1 rounded-md border px-2 py-1.5",
              index === 0 ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line",
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon name={side.icon} size={28} />
              <span className="truncate text-hud-strong text-hud-ink">{side.name}</span>
            </span>
            {side.rank < 5 && <HudTierStep from={side.rank} to={(side.rank + 1) as Tier} />}
            <span className="truncate text-hud-label tabular-nums text-hud-good">
              {side.next ? RESEARCH_TREE.step(side.now, side.next) : side.now}
            </span>
            {option === "gems" && sidePrice(node, side) && <Price price={sidePrice(node, side)!} />}
          </span>
        ))}
      </div>
      {foot(drill.name)}
    </>,
  );
};

const Price = ({ price }: { price: { essence: number; labor: number } }) => (
  <span className="flex gap-1">
    {(["essence", "labor"] as const).map((kind) => (
      <span
        key={kind}
        className={cn(
          "flex items-center gap-0.5 rounded-full bg-hud-well px-1.5 text-hud-label tabular-nums",
          price[kind] <= HOLDINGS[kind] ? "text-hud-ink" : "text-hud-bad",
        )}
      >
        <Icon name={kind} size={14} />
        {formatAmount(price[kind])}
      </span>
    ))}
  </span>
);
