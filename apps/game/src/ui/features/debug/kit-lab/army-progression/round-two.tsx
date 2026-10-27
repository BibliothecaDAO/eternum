import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudMeter, HudPanel, HudPortrait, HudTier, HudTierStep } from "@/ui/design-system/kit/hud-elements";
import { BACK, type Tier, TROOPS, XP } from "@/ui/design-system/kit/words";
import { type ArmyDetailFacts, type AttributeView, readArmyDetail } from "@/ui/features/frontier/army/army-detail";
import { AttributeTile, StaminaLine, StatusChips } from "@/ui/features/frontier/army/army-panel";
import { RefillChip } from "@/ui/features/frontier/army/refill";
import { formatExact } from "@bibliothecadao/types";
import { type ReactNode, useState } from "react";

/**
 * Lab only, round 2 of the owner's pick (27 October): ladder A and points cashed for stamina.
 * `?round=2&surface=card|levelup|points&pick=battle|stamina&stamina=40|110`.
 * A point is named for the rank it raises from, its gem that rank: a Common point (I) raises a Common side, an Uncommon
 * point (II) a Common or Uncommon side, and so on. Raising refills 20 / 40 / 60 / 80; cashing a point takes twice that.
 */
type Point = 1 | 2 | 3 | 4;
type Pick = "battle" | "logistics" | "scouting" | "homecoming" | "stamina";

const noop = () => undefined;
const ROUND_XP = 1_500;
const MILESTONES: { at: number; rank: Point }[] = [
  { at: 100, rank: 1 },
  { at: 300, rank: 2 },
  { at: 700, rank: 3 },
  { at: 1_500, rank: 4 },
];
const RAISE: Record<Point, number> = { 1: 20, 2: 40, 3: 60, 4: 80 };
const CASH: Record<Point, number> = { 1: 40, 2: 80, 3: 120, 4: 160 };

/** Army 2: Battle trained to Uncommon and raised to Rare with its Uncommon point; 760 XP earned. */
const EARNED_XP = 760;
const HELD: Point[] = [1, 3];
const factsAt = (stamina: number): ArmyDetailFacts => ({
  name: "Army 2",
  art: "knight-t1",
  troops: 1_240,
  xp: EARNED_XP,
  stamina: { current: stamina, max: 120, perExplore: 20 },
  secondsToFull: ((120 - stamina) / 30) * 3_600,
  revealYield: 120,
  progress: { battle: 3, logistics: 1, scouting: 1, homecoming: 1, scoutingKinds: [] },
  levelXp: [100, 200, 400, 800],
  revealXp: 2,
  shrineXp: 200,
  refillOnLevel: 30,
});

/** The lowest held point that fits a side at `level`: a point raises sides at its own rank or lower. */
const pointFor = (level: Tier, held: readonly Point[]) =>
  held.filter((rank) => rank >= level).sort((left, right) => left - right)[0];

export const RoundTwo = ({ surface, pick, stamina }: { surface: string; pick: Pick; stamina: number }) => {
  const facts = factsAt(stamina);
  const army = readArmyDetail(facts);
  const room = facts.stamina.max - facts.stamina.current;
  return (
    <HudPanel title={army.name} icon="troops" collapsible={false} bodyClassName="px-3 pb-3">
      {surface === "card" && <Card facts={facts} />}
      {surface === "levelup" && <LevelUp attributes={army.attributes} initial={pick} room={room} />}
      {surface === "points" && <PointFirst attributes={army.attributes} room={room} />}
    </HudPanel>
  );
};

const Card = ({ facts }: { facts: ArmyDetailFacts }) => {
  const army = readArmyDetail(facts);
  const from = 700;
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
        {army.attributes.map((attribute) => (
          <AttributeTile key={attribute.key} attribute={attribute} onOpen={noop} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-baseline gap-1">
            <span className="text-hud-display tabular-nums text-hud-gold">{formatExact(EARNED_XP)}</span>
            <span className="text-hud-strong text-hud-ink">{XP}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              {HELD.map((rank) => (
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
            <HudMeter share={(EARNED_XP - from) / (ROUND_XP - from)} label={XP} />
          </span>
          <span className="flex items-center gap-1 text-hud-label tabular-nums text-hud-muted">
            {formatExact(ROUND_XP)}
            <span className="opacity-60">
              <HudTier tier={4} />
            </span>
          </span>
        </span>
      </div>
    </div>
  );
};

/** The stamina a point gives when cashed, capped by the room left in the bar. */
const cashOf = (point: Point, room: number) => Math.min(CASH[point], room);

const Gain = ({ point, stamina }: { point?: Point; stamina: number }) => (
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

const SideLine = ({ attribute }: { attribute: AttributeView }) => (
  <>
    <Icon name={attribute.mark} size={32} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-center gap-1.5 text-hud-strong text-hud-ink">
        {attribute.name}
        {attribute.next && <HudTierStep from={attribute.level} to={attribute.next.tier} />}
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
const LevelUp = ({ attributes, initial, room }: { attributes: AttributeView[]; initial: Pick; room: number }) => {
  const [chosen, setChosen] = useState<Pick>(initial);
  const lowest = Math.min(...HELD) as Point;
  const pick = attributes.find(({ key }) => key === chosen);
  const pickPoint = pick && pointFor(pick.level, HELD);
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <HudButton kind="quiet" size="sm" icon="arrow-left">
          {BACK}
        </HudButton>
        <span className="flex items-center gap-1">
          {HELD.map((rank) => (
            <HudTier key={rank} tier={rank} />
          ))}
        </span>
      </div>
      {attributes.map((attribute) => {
        const point = pointFor(attribute.level, HELD);
        return (
          <Row key={attribute.key} chosen={chosen === attribute.key} onChoose={() => setChosen(attribute.key)}>
            <SideLine attribute={attribute} />
            {point && <Gain point={point} stamina={RAISE[point]} />}
          </Row>
        );
      })}
      <Row chosen={chosen === "stamina"} onChoose={() => setChosen("stamina")}>
        <StaminaRowLine room={room} />
        <Gain point={lowest} stamina={cashOf(lowest, room)} />
      </Row>
      {chosen === "stamina" ? (
        <Foot
          label={<span className="flex items-center gap-1.5">Stamina</span>}
          gain={<Gain point={lowest} stamina={cashOf(lowest, room)} />}
          verb="Refill"
        />
      ) : (
        pick?.next &&
        pickPoint && (
          <Foot
            label={
              <>
                {pick.name}
                <HudTierStep from={pick.level} to={pick.next.tier} />
              </>
            }
            gain={<Gain point={pickPoint} stamina={RAISE[pickPoint]} />}
            verb="Level up"
          />
        )
      )}
    </div>
  );
};

/** Variant b: pick a held point first; the sides it fits light up, and Stamina takes its cash. */
const PointFirst = ({ attributes, room }: { attributes: AttributeView[]; room: number }) => {
  const [point, setPoint] = useState<Point>(1);
  const [chosen, setChosen] = useState<Pick>("stamina");
  const pick = attributes.find(({ key }) => key === chosen);
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-2">
        <HudButton kind="quiet" size="sm" icon="arrow-left">
          {BACK}
        </HudButton>
        <span className="flex-1" />
        {HELD.map((rank) => (
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
        const fits = attribute.level <= point && attribute.level < 5;
        return (
          <Row
            key={attribute.key}
            chosen={chosen === attribute.key}
            dim={!fits}
            onChoose={() => fits && setChosen(attribute.key)}
          >
            <SideLine attribute={attribute} />
            {fits && <Gain stamina={RAISE[point]} />}
          </Row>
        );
      })}
      <Row chosen={chosen === "stamina"} onChoose={() => setChosen("stamina")}>
        <StaminaRowLine room={room} />
        <Gain stamina={cashOf(point, room)} />
      </Row>
      {chosen === "stamina" ? (
        <Foot label="Stamina" gain={<Gain point={point} stamina={cashOf(point, room)} />} verb="Refill" />
      ) : (
        pick?.next && (
          <Foot
            label={
              <>
                {pick.name}
                <HudTierStep from={pick.level} to={pick.next.tier} />
              </>
            }
            gain={<Gain point={point} stamina={RAISE[point]} />}
            verb="Level up"
          />
        )
      )}
    </div>
  );
};
