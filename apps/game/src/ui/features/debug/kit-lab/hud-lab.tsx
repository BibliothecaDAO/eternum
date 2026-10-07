import { Notice } from "@/ui/design-system/kit/notice";
import { OFFLINE, TRY_AGAIN } from "@/ui/design-system/kit/words";
import { ArmyStatusBar } from "@/ui/features/frontier/hud/action-bar";
import { ArmyToken, OpenSlot } from "@/ui/features/frontier/hud/army-token";
import type { DayClock } from "@/ui/features/frontier/hud/day-clock";
import { HudBands } from "@/ui/features/frontier/hud/hud-bands";
import { MenuSheet } from "@/ui/features/frontier/hud/menu-sheet";
import { OrderBar } from "@/ui/features/frontier/hud/order-bar";
import { DeployView } from "@/ui/features/frontier/deploy/deploy-view";
import { RuinChestMoment } from "@/ui/features/frontier/chest/ruin-chest-moment";
import { SiteClearCard } from "@/ui/features/frontier/sites/site-clear-card";
import { SiteCardView } from "@/ui/features/frontier/sites/site-card-view";
import { Direction } from "@bibliothecadao/types";
import { PlaceNav } from "@/ui/features/frontier/hud/place-nav";
import { StatusStrip, type StoreReading } from "@/ui/features/frontier/hud/status-strip";
import { useParams } from "react-router-dom";

const HOUR = 3_600;
const NOW = new Date(2026, 9, 7, 14, 26).getTime() / 1000;

/** The handoff's fiction: Day 12 at 14:26, today ends at 21:40 (7h 14m left), tomorrow lasts 12h. */
const CLOCK: DayClock = {
  day: 12,
  endsAt: NOW + 7 * HOUR + 14 * 60,
  secondsLeft: 7 * HOUR + 14 * 60,
  tomorrowSeconds: 12 * HOUR,
  shareLeft: (7 * HOUR + 14 * 60) / (16 * HOUR),
  tone: "calm",
};

const UNKNOWN_CLOCK: DayClock = {
  day: undefined,
  endsAt: undefined,
  secondsLeft: undefined,
  tomorrowSeconds: undefined,
  shareLeft: undefined,
  tone: "calm",
};

const store = (
  kind: StoreReading["kind"],
  amount: number | undefined,
  limit?: number,
  tone: StoreReading["tone"] = "calm",
) => ({
  kind,
  amount,
  limit,
  tone,
  flyTarget: `lab-${kind}`,
});

/** A city: 18,000 a store; Essence has no limit. */
const STORES = [
  store("essence", 18_250),
  store("labor", 9_640, 18_000),
  store("wheat", 4_410, 18_000),
  store("troops", 1_200, 18_000),
];
const FULL_STORES = [
  store("essence", 18_250),
  store("labor", 18_000, 18_000, "ember"),
  store("wheat", 17_580, 18_000, "amber"),
  store("troops", 1_200, 18_000),
];
const UNKNOWN_STORES = [
  store("essence", undefined),
  store("labor", undefined, 0),
  store("wheat", undefined, 0),
  store("troops", undefined, 0),
];

type LabArmy = { troops?: number; xp?: number; stamina?: number; tier?: boolean };
const ARMIES: LabArmy[] = [
  { troops: 5_000, xp: 260, stamina: 90, tier: true },
  { troops: 1, xp: 40, stamina: 150 },
  { troops: 1_200, xp: 120, stamina: 21, tier: true },
];
const UNKNOWN_ARMIES: LabArmy[] = [{}, {}, {}];

/** Army 1 (5,000 troops, 90 stamina) explores a new tile, or moves three tiles over known ground. */
const EXPLORE: LabOrder = {
  kind: "explore",
  tiles: 1,
  stamina: { cost: 30, held: 90, wait: undefined },
  wheat: { cost: 100, held: 4_410, wait: undefined },
};
const MOVE: LabOrder = {
  kind: "move",
  tiles: 3,
  stamina: { cost: 30, held: 90, wait: undefined },
  wheat: { cost: 300, held: 4_410, wait: undefined },
};

const STATES = {
  idle: { clock: CLOCK, stores: STORES, armies: ARMIES },
  selected: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0 },
  full: { clock: CLOCK, stores: FULL_STORES, armies: ARMIES, realmDot: "ember" as const },
  offline: { clock: UNKNOWN_CLOCK, stores: UNKNOWN_STORES, armies: UNKNOWN_ARMIES, offline: true },
  menu: { clock: CLOCK, stores: STORES, armies: ARMIES, menu: true },
  empty: { clock: CLOCK, stores: STORES, armies: [] },
  explore: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, order: EXPLORE },
  move: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, order: MOVE },
  "wheat-short": {
    clock: CLOCK,
    stores: [
      store("essence", 18_250),
      store("labor", 9_640, 18_000),
      store("wheat", 40, 18_000),
      store("troops", 1_200, 18_000),
    ],
    armies: ARMIES,
    selected: 0,
    order: { ...EXPLORE, wheat: { cost: 100, held: 40, wait: 4 * 60 } },
  },
  "stamina-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    order: { ...EXPLORE, stamina: { cost: 30, held: 10, wait: 40 * 60 } },
  },
  deploy: { clock: CLOCK, stores: STORES, armies: ARMIES, deploy: DEPLOY },
  "deploy-scout": { clock: CLOCK, stores: STORES, armies: ARMIES, deploy: { ...DEPLOY, count: 1, tiles: 99 } },
  "deploy-wheat": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    deploy: { ...DEPLOY, count: 1_000, wheatStop: 1_000, wheat: 2_000, tiles: 0 },
  },
  "deploy-empty": {
    clock: CLOCK,
    stores: STORES,
    armies: [],
    deploy: { ...DEPLOY, count: 0, troopsAtHome: 0, troopsMax: 0 },
  },
  "site-camp": { clock: CLOCK, stores: STORES, armies: ARMIES, site: CAMP_CARD },
  "site-full": {
    clock: CLOCK,
    stores: [
      store("essence", 18_250),
      store("labor", 17_880, 18_000, "amber"),
      store("wheat", 4_410, 18_000),
      store("troops", 1_200, 18_000),
    ],
    armies: ARMIES,
    site: { ...CAMP_CARD, pay: { icon: "La", amount: 550, fits: 120 } },
  },
  "site-stragglers": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...CAMP_CARD, site: "stragglers", guard: 400, fight: WIN(1, 15), pay: null, xp: 50 },
  },
  "site-ruin": { clock: CLOCK, stores: STORES, armies: ARMIES, site: RUIN_CARD },
  "site-ruin-lose": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 1_200 },
      fight: { outcome: "loses", exchanges: 3, troopsLost: 1_200, guardLeft: 2_300 },
    },
  },
  "site-far": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...CAMP_CARD,
      verb: {
        kind: "move",
        prices: [
          { of: "stamina", amount: 20 },
          { of: "wheat", amount: 200 },
        ],
        onMove: () => undefined,
      },
    },
  },
  "site-pick": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...CAMP_CARD,
      army: null,
      verb: null,
      choices: [
        { label: "Army 1", art: ARMY_CHIP.art, troops: 5_000, wins: true, onPick: () => undefined },
        { label: "Army 2", art: ARMY_CHIP.art, troops: 1, wins: false, onPick: () => undefined },
        { label: "Army 3", art: ARMY_CHIP.art, troops: 1, wins: false, onPick: () => undefined },
      ],
    },
  },
  "site-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...CAMP_CARD, verb: { kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } } },
  },
  "clear-camp": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    clear: { site: "Camp", paid: { icon: "La", amount: 550 }, xp: 22, troopsLost: 180, onClose: () => undefined },
  },
  "clear-cut": {
    clock: CLOCK,
    stores: [
      store("essence", 18_250),
      store("labor", 18_000, 18_000, "ember"),
      store("wheat", 4_410, 18_000),
      store("troops", 1_200, 18_000),
    ],
    armies: ARMIES,
    realmDot: "ember",
    clear: {
      site: "Camp",
      paid: { icon: "La", amount: 120, full: 550 },
      xp: 22,
      troopsLost: 180,
      onClose: () => undefined,
    },
  },
  "clear-ruin": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    chest: { tier: 3, lords: 128, xp: 145, troopsLost: 1_250, onClose: () => undefined },
  },
  "clear-ruin-legendary": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    chest: { tier: 5, lords: 640, xp: 145, troopsLost: 1_250, onClose: () => undefined },
  },
} as const;

type LabOrder = {
  kind: "explore" | "move";
  tiles: number;
  stamina: { cost: number; held: number | undefined; wait: number | undefined };
  wheat: { cost: number; held: number | undefined; wait: number | undefined };
};

/** A city's deploy: 6,200 troops at home, 2 wheat a troop, the realm trained Battle and Homecoming to uncommon. */
type LabDeploy = {
  count: number;
  troopsAtHome: number;
  troopsMax: number;
  wheatStop?: number;
  wheat: number;
  tiles: number;
};

const DEPLOY: LabDeploy = { count: 5_000, troopsAtHome: 6_200, troopsMax: 6_200, wheat: 14_410, tiles: 44 };

type LabSite = Omit<Parameters<typeof SiteCardView>[0], "onClose" | "onRealm">;
type LabClear = Parameters<typeof SiteClearCard>[0];
type LabChest = Parameters<typeof RuinChestMoment>[0];

const ARMY_CHIP = { art: "/images/armies/knightT1.png", troops: 5_000 };
const ATTACK_30 = { kind: "attack" as const, stamina: 30, sending: false, onAttack: () => undefined };
const WIN = (exchanges: number, troopsLost: number) => ({
  outcome: "wins" as const,
  exchanges,
  troopsLost,
  guardLeft: 0,
});
const CAMP_CARD: LabSite = {
  site: "camp",
  beast: undefined,
  army: ARMY_CHIP,
  guard: 1_100,
  fight: WIN(1, 180),
  pay: { icon: "La", amount: 550 },
  xp: 82,
  verb: ATTACK_30,
};
const RUIN_CARD: LabSite = {
  site: "ruin",
  beast: "Troll",
  army: ARMY_CHIP,
  guard: 3_400,
  fight: WIN(2, 1_250),
  pay: null,
  chest: { tier: 3, lords: 128 },
  xp: 145,
  verb: ATTACK_30,
};

type LabState = {
  order?: LabOrder;
  site?: LabSite;
  clear?: LabClear;
  chest?: LabChest;
  deploy?: LabDeploy;
  clock: DayClock;
  stores: readonly StoreReading[];
  armies: readonly LabArmy[];
  selected?: number;
  realmDot?: "ember";
  offline?: boolean;
  menu?: boolean;
};

const SLOTS = 4;
const noop = () => undefined;

/**
 * Dev only: the Map HUD's states on the lab fixtures, at /lab/kit/hud/<state> (idle, selected, full, offline, menu,
 * empty, explore, move, wheat-short, stamina-short): the components the live HUD draws, on the handoff's fiction.
 */
export const HudLab = () => {
  const { state = "idle" } = useParams();
  const lab: LabState = STATES[state as keyof typeof STATES] ?? STATES.idle;
  const selected = lab.selected === undefined ? undefined : lab.armies[lab.selected];
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,var(--frontier-line),var(--frontier-void))]"
      />
      <HudBands
        top={<StatusStrip clock={lab.clock} stores={[...lab.stores]} />}
        foot={
          <>
            {lab.offline && <Notice icon="Of" line={OFFLINE} verb={TRY_AGAIN} onVerb={noop} ember />}
            {lab.clear && <SiteClearCard {...lab.clear} />}
            {lab.order && <OrderBar {...lab.order} revealYield={500} xp={2} onCancel={noop} onGo={noop} />}
            {selected && !lab.order && (
              <ArmyStatusBar stamina={selected.stamina} secondsToFull={2 * HOUR} revealYield={500} />
            )}
            {!lab.order && (
              <nav aria-label="Armies" className="pointer-events-auto flex gap-1.5">
                {lab.armies.map((army, index) => (
                  <ArmyToken
                    key={index}
                    label={`Army ${index + 1}`}
                    art={army.troops === undefined ? undefined : "/images/armies/knightT1.png"}
                    xp={army.xp}
                    stamina={army.stamina === undefined ? undefined : { current: army.stamina, max: 150 }}
                    troops={army.troops}
                    canBuyTier={army.tier === true}
                    selected={lab.selected === index}
                    onPick={noop}
                  />
                ))}
                {Array.from({ length: SLOTS - lab.armies.length }, (_, index) => (
                  <OpenSlot key={index} label="Deploy" pulse={index === 0 && lab.armies.length === 0} onDeploy={noop} />
                ))}
              </nav>
            )}
            <PlaceNav
              place={lab.menu ? "menu" : "map"}
              onGo={noop}
              realmDot={lab.realmDot}
              researchDot={!lab.offline}
              unread={lab.offline ? 0 : 3}
            />
          </>
        }
      >
        {lab.deploy && <LabDeploySheet deploy={lab.deploy} />}
        {lab.site && <SiteCardView {...lab.site} onRealm={noop} onClose={noop} />}
        {lab.chest && <RuinChestMoment {...lab.chest} />}
        {lab.menu && (
          <MenuSheet
            rank="#12"
            onToday={noop}
            onSeason={noop}
            onGuide={noop}
            onSettings={noop}
            onExit={noop}
            onClose={noop}
          />
        )}
      </HudBands>
    </>
  );
};

const RING = [
  Direction.EAST,
  Direction.NORTH_EAST,
  Direction.NORTH_WEST,
  Direction.WEST,
  Direction.SOUTH_WEST,
  Direction.SOUTH_EAST,
].map((direction) => ({ direction, open: true, explored: true }));

/** Deploy on the fiction: 2 wheat a troop, 0.02 a troop a tile, a full new army at 150 stamina. */
const LabDeploySheet = ({ deploy }: { deploy: LabDeploy }) => {
  const cost = deploy.count * 2;
  return (
    <DeployView
      slots={{ used: deploy.troopsAtHome === 0 ? 0 : 1, allowed: 4 }}
      art={deploy.troopsAtHome === 0 ? undefined : "/images/armies/knightT1.png"}
      troopsAtHome={deploy.troopsAtHome}
      count={deploy.count}
      troopsMax={deploy.troopsMax}
      wheatStop={deploy.wheatStop}
      onCount={noop}
      equation={{ wheatCost: cost, wheatLeft: Math.max(0, deploy.wheat - cost), tiles: deploy.tiles }}
      revealYield={500}
      startingStamina={150}
      startingTiers={[2, 1, 1, 2]}
      clock={CLOCK}
      ring={{ tiles: RING, chosen: Direction.EAST, onPick: noop }}
      canDeploy={deploy.count > 0}
      sending={false}
      onDeploy={noop}
      wheatShort={undefined}
      onBuild={noop}
      onClose={noop}
    />
  );
};
