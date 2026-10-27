import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudMeter, HudPanel, HudPortrait, HudTier } from "@/ui/design-system/kit/hud-elements";
import { BACK, type Tier, TROOPS, XP } from "@/ui/design-system/kit/words";
import { type ArmyDetailFacts, type AttributeView, readArmyDetail } from "@/ui/features/frontier/army/army-detail";
import { AttributeTile, StaminaLine, StatusChips } from "@/ui/features/frontier/army/army-panel";
import { RefillChip } from "@/ui/features/frontier/army/refill";
import { formatExact } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

import { RankGem, RankStep } from "./rank-gem";

/**
 * Lab only, rounds 2 and 3 of the owner's pick (27 October): skill points on ladder A, and points spent on Stamina alone.
 * `?round=2|3&set=common|legendary&surface=card|levelup|points&pick=battle|stamina&stamina=40|110`.
 * - Round 2: a point is named for the rank it raises from (Common I raises a Common side); raising refills 20/40/60/80,
 *   Stamina alone twice that.
 * - Round 3: a point is named for the rank it gives (Uncommon II to Legendary V); raising refills 30/40/50/60, Stamina
 *   alone twice that. `set=common` adds a Common point that only gives stamina (40); `set=legendary` holds a Legendary
 *   point.
 */
type Pick = "battle" | "logistics" | "scouting" | "homecoming" | "stamina";
/** A side as Level up and the card read it; round 4's start at 0, so its rank is a number from 0 to 5. */
type SideView = Pick<AttributeView, "key" | "name" | "mark" | "now"> & {
  level: number;
  next?: { tier: Tier; change: string };
};
type Progress = { battle: number; logistics: number; scouting: number; homecoming: number };

interface PointRules {
  earned: number;
  held: Tier[];
  /** Points that only give stamina. */
  aloneOnly: Tier[];
  progress: Progress;
  raise: Partial<Record<Tier, number>>;
  alone: Partial<Record<Tier, number>>;
  /** Whether a point can raise a side at `level`. */
  fits: (point: Tier, level: number) => boolean;
  /** Round 4: the sides drawn from 0, in place of today's. */
  sides?: SideView[];
  /** The XP bar: from the last point to the next, and the next point's gem. */
  bar: { from: number; to: number; next: Tier };
}

const noop = () => undefined;
const ROUND_TWO = { 1: 20, 2: 40, 3: 60, 4: 80 } as const;
const ROUND_THREE = { 2: 30, 3: 40, 4: 50, 5: 60 } as const;
const doubled = (table: Partial<Record<Tier, number>>) =>
  Object.fromEntries(Object.entries(table).map(([rank, stamina]) => [rank, stamina * 2])) as Partial<
    Record<Tier, number>
  >;
/** Battle trained to Uncommon and raised to Rare with one point; 760 XP earned. */
const MID: Progress = { battle: 3, logistics: 1, scouting: 1, homecoming: 1 };
const givesRank = (point: Tier, level: number) => level < 5 && point >= level + 1;

const RULES: Record<string, PointRules> = {
  "2": {
    earned: 760,
    held: [1, 3],
    aloneOnly: [],
    progress: MID,
    raise: ROUND_TWO,
    alone: doubled(ROUND_TWO),
    fits: (point, level) => level < 5 && point >= level,
    bar: { from: 700, to: 1_500, next: 4 },
  },
  "3": {
    earned: 760,
    held: [2, 4],
    aloneOnly: [],
    progress: MID,
    raise: ROUND_THREE,
    alone: doubled(ROUND_THREE),
    fits: givesRank,
    bar: { from: 700, to: 1_500, next: 5 },
  },
  "3-common": {
    earned: 760,
    held: [1, 2, 4],
    aloneOnly: [1],
    progress: MID,
    raise: ROUND_THREE,
    alone: { 1: 40, ...doubled(ROUND_THREE) },
    fits: givesRank,
    bar: { from: 700, to: 1_500, next: 5 },
  },
  "3-legendary": {
    earned: 1_520,
    held: [5],
    aloneOnly: [],
    progress: { battle: 4, logistics: 2, scouting: 1, homecoming: 1 },
    raise: ROUND_THREE,
    alone: doubled(ROUND_THREE),
    fits: givesRank,
    bar: { from: 1_500, to: 1_600, next: 2 },
  },
};

const ROUND_FOUR = { 1: 20, 2: 30, 3: 40, 4: 50, 5: 60 } as const;
/** Round 4's Army 2: Battle trained to Common by the War hall and raised to Uncommon; 400 XP on the 50 / 150 / 350 / 750 / 1,550 ladder. */
const ZERO_SIDES: SideView[] = [
  {
    key: "battle",
    name: "Battle",
    mark: "order-rage",
    level: 2,
    now: "+25% damage",
    next: { tier: 3, change: "+25% → +45% damage" },
  },
  {
    key: "logistics",
    name: "Logistics",
    mark: "order-skill",
    level: 0,
    now: "120 max stamina",
    next: { tier: 1, change: "120 → 140 max stamina" },
  },
  {
    key: "scouting",
    name: "Scouting",
    mark: "order-detection",
    level: 0,
    now: "0% discovery",
    next: { tier: 1, change: "+10% on the kind you pick" },
  },
  {
    key: "homecoming",
    name: "Homecoming",
    mark: "order-enlightenment",
    level: 0,
    now: "0% come home",
    next: { tier: 1, change: "0% → 3% come home" },
  },
];
RULES["4"] = {
  earned: 400,
  held: [1, 3],
  aloneOnly: [],
  progress: { battle: 1, logistics: 1, scouting: 1, homecoming: 1 },
  raise: ROUND_FOUR,
  alone: doubled(ROUND_FOUR),
  fits: givesRank,
  bar: { from: 350, to: 750, next: 4 },
  sides: ZERO_SIDES,
};

const factsAt = (rules: PointRules, stamina: number): ArmyDetailFacts => ({
  name: "Army 2",
  art: "knight-t1",
  troops: 1_240,
  xp: rules.earned,
  stamina: { current: stamina, max: 120, perExplore: 20 },
  secondsToFull: ((120 - stamina) / 30) * 3_600,
  revealYield: 120,
  progress: { ...rules.progress, scoutingKinds: [] },
  levelXp: [100, 200, 400, 800],
  revealXp: 2,
  shrineXp: 200,
  refillOnLevel: 30,
});

/** The lowest held point that can raise a side at `level`. */
const pointFor = (rules: PointRules, level: number) =>
  rules.held
    .filter((rank) => !rules.aloneOnly.includes(rank) && rules.fits(rank, level))
    .sort((left, right) => left - right)[0];

export const SkillPoints = ({
  set,
  surface,
  pick,
  stamina,
}: {
  set: string;
  surface: string;
  pick: Pick;
  stamina: number;
}) => {
  const rules = RULES[set] ?? RULES["3"]!;
  const facts = factsAt(rules, stamina);
  const army = readArmyDetail(facts);
  const room = facts.stamina.max - facts.stamina.current;
  return (
    <HudPanel title={army.name} icon="troops" collapsible={false} bodyClassName="px-3 pb-3">
      {surface === "card" && <Card rules={rules} facts={facts} />}
      {surface === "levelup" && (
        <LevelUp rules={rules} attributes={rules.sides ?? army.attributes} initial={pick} room={room} />
      )}
      {surface === "points" && <PointFirst rules={rules} attributes={rules.sides ?? army.attributes} room={room} />}
    </HudPanel>
  );
};

const Card = ({ rules, facts }: { rules: PointRules; facts: ArmyDetailFacts }) => {
  const army = readArmyDetail(facts);
  const { from, to, next } = rules.bar;
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-3">
        <HudPortrait icon={army.art} label={TROOPS} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center gap-2">
            <StatusChips army={army} />
            <span className="ml-auto flex">
              <RefillChip price={80} held={600} onRefill={noop} />
            </span>
          </span>
          <StaminaLine army={army} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {rules.sides
          ? rules.sides.map((side) => <ZeroTile key={side.key} side={side} />)
          : army.attributes.map((attribute) => (
              <AttributeTile key={attribute.key} attribute={attribute} onOpen={noop} />
            ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-baseline gap-1">
            <span className="text-hud-display tabular-nums text-hud-gold">{formatExact(rules.earned)}</span>
            <span className="text-hud-strong text-hud-ink">{XP}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              {rules.held.map((rank) => (
                <HudTier key={rank} tier={rank} />
              ))}
            </span>
            <HudButton kind="primary" size="sm" icon="upgrade">
              Level up
            </HudButton>
          </span>
        </div>
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <HudMeter share={(rules.earned - from) / (to - from)} label={XP} />
          </span>
          <span className="flex items-center gap-1 text-hud-label tabular-nums text-hud-muted">
            {formatExact(to)}
            <span className="opacity-60">
              <HudTier tier={next} />
            </span>
          </span>
        </span>
      </div>
    </div>
  );
};

/** The stamina a point gives alone, capped by the room left in the bar. */
const aloneOf = (rules: PointRules, point: Tier, room: number) => Math.min(rules.alone[point] ?? 0, room);

const Gain = ({ point, stamina }: { point?: Tier; stamina: number }) => (
  <span className="flex shrink-0 items-center gap-1.5">
    {point && <HudTier tier={point} />}
    <span className="flex items-center gap-0.5 text-hud-strong tabular-nums text-hud-good">
      <Icon name="stamina" size={14} />
      {`+${stamina}`}
    </span>
  </span>
);

const Row = ({
  chosen,
  onChoose,
  dim = false,
  children,
}: {
  chosen: boolean;
  onChoose: () => void;
  dim?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={chosen}
    onClick={onChoose}
    className={cn(
      "flex items-center gap-2 rounded-md border px-2 py-2 text-left",
      chosen ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line hover:bg-hud-hover",
      dim && "opacity-40",
    )}
  >
    {children}
  </button>
);

/** Round 4's side tile: as the card's, its gem an empty socket at 0. */
const ZeroTile = ({ side }: { side: SideView }) => (
  <span className="flex min-w-0 flex-col items-center gap-1 rounded-md border border-hud-line bg-hud-well px-1 py-2">
    <Icon name={side.mark} size={40} />
    <span className="text-hud-label text-hud-ink">{side.name}</span>
    <RankGem rank={side.level} />
    <span className="text-center text-hud-label tabular-nums text-hud-good">{side.now}</span>
  </span>
);

const SideLine = ({ attribute }: { attribute: SideView }) => (
  <>
    <Icon name={attribute.mark} size={32} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-center gap-1.5 text-hud-strong text-hud-ink">
        {attribute.name}
        {attribute.next && <RankStep from={attribute.level} to={attribute.next.tier} />}
      </span>
      <span className="text-hud-label tabular-nums text-hud-good">{attribute.next?.change}</span>
    </span>
  </>
);

const StaminaRowLine = ({ room }: { room: number }) => (
  <>
    <span className="flex h-8 w-8 items-center justify-center">
      <Icon name="stamina" size={28} />
    </span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-hud-strong text-hud-ink">Stamina</span>
      <span className="text-hud-label tabular-nums text-hud-muted">{`${formatExact(120 - room)}/120`}</span>
    </span>
  </>
);

const Foot = ({ label, gain, verb }: { label: ReactNode; gain: ReactNode; verb: string }) => (
  <div className="flex items-center gap-2 border-t border-hud-divider pt-3">
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-hud-body text-hud-ink">{label}</span>
    {gain}
    <HudButton kind="primary">{verb}</HudButton>
  </div>
);

/** Variant a: the four sides, then Stamina, which cashes the lowest point held. */
const LevelUp = ({
  rules,
  attributes,
  initial,
  room,
}: {
  rules: PointRules;
  attributes: SideView[];
  initial: Pick;
  room: number;
}) => {
  const [chosen, setChosen] = useState<Pick>(initial);
  const lowest = Math.min(...rules.held) as Tier;
  const pick = attributes.find(({ key }) => key === chosen);
  const pickPoint = pick && pointFor(rules, pick.level);
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <HudButton kind="quiet" size="sm" icon="arrow-left">
          {BACK}
        </HudButton>
        <span className="flex items-center gap-1">
          {rules.held.map((rank) => (
            <HudTier key={rank} tier={rank} />
          ))}
        </span>
      </div>
      {attributes.map((attribute) => {
        const point = pointFor(rules, attribute.level);
        return (
          <Row key={attribute.key} chosen={chosen === attribute.key} onChoose={() => setChosen(attribute.key)}>
            <SideLine attribute={attribute} />
            {point && <Gain point={point} stamina={rules.raise[point] ?? 0} />}
          </Row>
        );
      })}
      <Row chosen={chosen === "stamina"} onChoose={() => setChosen("stamina")}>
        <StaminaRowLine room={room} />
        <Gain point={lowest} stamina={aloneOf(rules, lowest, room)} />
      </Row>
      {chosen === "stamina" ? (
        <Foot
          label={<span className="flex items-center gap-1.5">Stamina</span>}
          gain={<Gain point={lowest} stamina={aloneOf(rules, lowest, room)} />}
          verb="Refill"
        />
      ) : (
        pick?.next &&
        pickPoint && (
          <Foot
            label={
              <>
                {pick.name}
                <RankStep from={pick.level} to={pick.next.tier} />
              </>
            }
            gain={<Gain point={pickPoint} stamina={rules.raise[pickPoint] ?? 0} />}
            verb="Level up"
          />
        )
      )}
    </div>
  );
};

/** Variant b: pick a held point first; the sides it fits light up, and Stamina takes its cash. */
const PointFirst = ({ rules, attributes, room }: { rules: PointRules; attributes: SideView[]; room: number }) => {
  const [point, setPoint] = useState<Tier>(rules.held[0]!);
  const [chosen, setChosen] = useState<Pick>("stamina");
  const pick = attributes.find(({ key }) => key === chosen);
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-2">
        <HudButton kind="quiet" size="sm" icon="arrow-left">
          {BACK}
        </HudButton>
        <span className="flex-1" />
        {rules.held.map((rank) => (
          <button
            key={rank}
            type="button"
            aria-pressed={point === rank}
            onClick={() => setPoint(rank)}
            className={cn(
              "rounded-md border p-1",
              point === rank ? "border-hud-line-strong bg-hud-chosen" : "border-hud-line",
            )}
          >
            <HudTier tier={rank} />
          </button>
        ))}
      </div>
      {attributes.map((attribute) => {
        const fits = !rules.aloneOnly.includes(point) && rules.fits(point, attribute.level);
        return (
          <Row
            key={attribute.key}
            chosen={chosen === attribute.key}
            dim={!fits}
            onChoose={() => fits && setChosen(attribute.key)}
          >
            <SideLine attribute={attribute} />
            {fits && <Gain stamina={rules.raise[point] ?? 0} />}
          </Row>
        );
      })}
      <Row chosen={chosen === "stamina"} onChoose={() => setChosen("stamina")}>
        <StaminaRowLine room={room} />
        <Gain stamina={aloneOf(rules, point, room)} />
      </Row>
      {chosen === "stamina" ? (
        <Foot label="Stamina" gain={<Gain point={point} stamina={aloneOf(rules, point, room)} />} verb="Refill" />
      ) : (
        pick?.next && (
          <Foot
            label={
              <>
                {pick.name}
                <RankStep from={pick.level} to={pick.next.tier} />
              </>
            }
            gain={<Gain point={point} stamina={rules.raise[point] ?? 0} />}
            verb="Level up"
          />
        )
      )}
    </div>
  );
};
