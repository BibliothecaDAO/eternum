import { Notice } from "@/ui/design-system/kit/notice";
import {
  BARRACKS,
  CASTLE,
  FARM,
  HUT,
  MAP,
  OFFLINE,
  TRAINING_BUILDINGS,
  TRY_AGAIN,
  WORKSHOP,
  YOU,
} from "@/ui/design-system/kit/words";
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
import { DayDoneCard } from "@/ui/features/frontier/rollover/day-done-card";
import { LastHourBubble } from "@/ui/features/frontier/rollover/last-hour";
import { BuildView } from "@/ui/features/frontier/build/build-view";
import { type AttributeKey, ArmySheet } from "@/ui/features/frontier/army/army-sheet";
import { BuildingsRow } from "@/ui/features/frontier/realm/buildings-row";
import { CastleView } from "@/ui/features/frontier/upgrade/castle-view";
import { TypeUpgradeSheet } from "@/ui/features/frontier/upgrade/type-upgrade-sheet";
import { TrainingGives } from "@/ui/features/frontier/upgrade/training-gives";
import { KindChoice } from "@/ui/features/frontier/army/army-sheet";
import { CastleNodeSheet, TreePage, type TreeRow } from "@/ui/features/frontier/research/tree-page";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { type ProductionLine, ProductionSheet } from "@/ui/features/frontier/production/production-sheet";
import { BuildingType, Direction } from "@bibliothecadao/types";
import { PlaceNav } from "@/ui/features/frontier/hud/place-nav";
import { StatusStrip, type StoreReading } from "@/ui/features/frontier/hud/status-strip";
import { useParams } from "react-router-dom";
import { TodaySheet } from "@/ui/features/frontier/log/today-sheet";
import { SeasonList, type SeasonListRow } from "@/ui/features/frontier/board/season-list";
import { SeasonDetailSheet } from "@/ui/features/frontier/board/season-detail";
import { SeasonOverCard } from "@/ui/features/frontier/board/season-over-card";
import { VisitFoot } from "@/ui/features/frontier/board/visit-foot";
import { SeasonPeekView } from "@/ui/features/frontier/board/season-peek";
import { useLayout } from "@/shell/frame/layout";
import { GuideCard } from "@/ui/features/frontier/guide/guide-card";
import { type GuideFacts, GUIDE_STEPS } from "@/ui/features/frontier/guide/guide-script";
import { GuideThread } from "@/ui/features/frontier/guide/guide-thread";
import { useRef } from "react";
import { RefillButton, RefillConfirm } from "@/ui/features/frontier/army/refill";

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

/** Day 13 at 22:30: an 8-hour day from 21:40 that ends in the night, at 05:40; tomorrow lasts 20h. */
const NIGHT: DayClock = {
  day: 13,
  endsAt: NOW + 15 * HOUR + 14 * 60,
  secondsLeft: 7 * HOUR + 10 * 60,
  tomorrowSeconds: 20 * HOUR,
  shareLeft: (7 * HOUR + 10 * 60) / (8 * HOUR),
  tone: "calm",
};
const LAST_HOUR: DayClock = { ...CLOCK, secondsLeft: 42 * 60, shareLeft: 42 / 960, tone: "ember" };
const DAY_DONE = {
  endedDay: 12,
  realmArt: "/images/realm-card/city.webp",
  clock: { ...NIGHT, secondsLeft: 7 * HOUR + 55 * 60 },
  totals: { reveals: 31, cleared: 3, chests: 1, essence: 6_400, labor: 1_150, lords: 128 },
  rank: { from: 14, to: 12 },
  armies: 3,
  troopsLost: 6_021,
  returned: { sent: 470, fitted: 470 },
  onContinue: () => undefined,
};

/** A city's build sheet: eight buildings, the War hall and Hearth already standing, a fifth farm at 6,800 labor. */
const BUILD_TILES: Parameters<typeof BuildView>[0]["tiles"] = [
  { key: "farm", icon: "Fm", name: "Farm", foot: { kind: "price", labor: 6_800, short: false } },
  { key: "workshop", icon: "Wk", name: "Workshop", foot: { kind: "price", labor: 10_000, short: true } },
  { key: "barracks", icon: "Bs", name: "Barracks", foot: { kind: "price", labor: 6_800, short: false } },
  { key: "hut", icon: "Ht", name: "Hut", foot: { kind: "price", labor: 5_100, short: false } },
  { key: "war", icon: "Wa", name: TRAINING_BUILDINGS[0], foot: { kind: "built" } },
  { key: "supply", icon: "Sy", name: TRAINING_BUILDINGS[1], foot: { kind: "price", labor: 3_000, short: false } },
  { key: "lodge", icon: "Ld", name: TRAINING_BUILDINGS[2], foot: { kind: "price", labor: 3_000, short: false } },
  { key: "hearth", icon: "He", name: TRAINING_BUILDINGS[3], foot: { kind: "built" } },
];
const EARLY_TILES: Parameters<typeof BuildView>[0]["tiles"] = [
  { key: "farm", icon: "Fm", name: "Farm", foot: { kind: "price", labor: 800, short: false } },
  { key: "workshop", icon: "Wk", name: "Workshop", foot: { kind: "price", labor: 2_000, short: false } },
  { key: "barracks", icon: "Bs", name: "Barracks", foot: { kind: "price", labor: 800, short: false } },
  { key: "hut", icon: "Ht", name: "Hut", foot: { kind: "price", labor: 300, short: false } },
  { key: "war", icon: "Wa", name: TRAINING_BUILDINGS[0], foot: { kind: "locked", gate: 3 } },
  { key: "supply", icon: "Sy", name: TRAINING_BUILDINGS[1], foot: { kind: "locked", gate: 3 } },
  { key: "lodge", icon: "Ld", name: TRAINING_BUILDINGS[2], foot: { kind: "locked", gate: 3 } },
  { key: "hearth", icon: "He", name: TRAINING_BUILDINGS[3], foot: { kind: "locked", gate: 3 } },
];
const CASTLE_SIDE = (level: number, limit: number) => ({
  level,
  art: `/images/buildings/construction/${["castleZero", "castleOne", "castleTwo", "castleThree"][level]}.png`,
  plots: [6, 18, 36, 60][level],
  slots: [3, 4, 5, 6][level],
  limit,
  deployCap: [3_000, 9_000, 25_000, 50_000][level],
});

/** Army 1: 5,000 troops, 260 XP, Battle rare, Logistics and Scouting common, Homecoming rare (the realm trained two). */
type LabArmySheet = {
  chosen: AttributeKey;
  /** The realm's LORDS against the refill; with `confirm`, the refill's confirm is open. */
  lords?: number;
  confirm?: boolean;
  xp?: number;
  stamina?: number;
  max?: number;
  tiers?: readonly [1 | 2 | 3 | 4 | 5, 1 | 2 | 3 | 4 | 5, 1 | 2 | 3 | 4 | 5, 1 | 2 | 3 | 4 | 5];
};
const EFFECTS = {
  battle: ["+0%", "+10%", "+30%", "+60%", "+100%"],
  logistics: ["150", "170", "200", "240", "300"],
  scouting: ["+0%", "+10%", "+30%", "+60%", "+100%"],
  homecoming: ["0%", "3%", "9%", "18%", "30%"],
} as const;

/** A city's three stores: 18,000 a store, wheat lifted by Fields, troops by Drill. */
const line = (overrides: Partial<ProductionLine> & Pick<ProductionLine, "icon" | "spentAt">): ProductionLine => ({
  perHour: undefined,
  held: undefined,
  limit: 18_000,
  tone: "calm",
  fullIn: undefined,
  noBuilding: false,
  ...overrides,
});
const PRODUCTION_LINES: ProductionLine[] = [
  line({ icon: "Wh", spentAt: "deploy", perHour: 1_500, sides: ["Fi"], held: 4_410, fullIn: 9 * HOUR + 4 * 60 }),
  line({ icon: "La", spentAt: "realm", perHour: 500, held: 9_640, fullIn: 16 * HOUR + 44 * 60 }),
  line({ icon: "Tr", spentAt: "deploy", perHour: 600, sides: ["Dr"], held: 1_200, fullIn: 28 * HOUR }),
];

/** A city's tree: farm uncommon (Fields), workshop common, barracks rare (Drill twice), hut common, two training buildings. */
const TREE_ROWS: TreeRow[] = [
  { key: "farm", icon: "Fm", name: FARM, tier: 2, sides: ["Fi"], next: { essence: 4_000, labor: 3_000 }, choice: true },
  {
    key: "workshop",
    icon: "Wk",
    name: WORKSHOP,
    tier: 1,
    sides: [],
    next: { essence: 2_000, labor: 2_000 },
    choice: true,
  },
  {
    key: "barracks",
    icon: "Bs",
    name: BARRACKS,
    tier: 3,
    sides: ["Dr", "Dr"],
    next: { essence: 48_000, labor: 24_000 },
    choice: true,
  },
  { key: "hut", icon: "Ht", name: HUT, tier: 1, sides: [], next: { essence: 500, labor: 500 }, choice: false },
  {
    key: "war",
    icon: "Wa",
    name: TRAINING_BUILDINGS[0],
    tier: 2,
    sides: [],
    next: { essence: 48_000, labor: 9_000 },
    choice: false,
  },
  {
    key: "hearth",
    icon: "He",
    name: TRAINING_BUILDINGS[3],
    tier: 2,
    sides: [],
    next: { essence: 48_000, labor: 9_000 },
    choice: false,
  },
];
const CASTLE_NODES = [
  { key: "shrine", icon: "Sh" as const, label: "Shrine", essence: 2_000, state: "open" as const },
  { key: "well", icon: "Wl" as const, label: "Well", essence: 6_000, state: "open" as const },
  { key: "d1", icon: "E1" as const, label: "I", essence: 160_000, state: "open" as const },
  { key: "d2", icon: "E2" as const, label: "II", essence: 400_000, state: "locked" as const },
  { key: "d3", icon: "E3" as const, label: "III", essence: 900_000, state: "locked" as const },
];

const TODAY_LOG = [
  { id: "a", at: NOW - 24 * 60, text: "Army 1 cleared a camp" },
  { id: "b", at: NOW - 46 * 60, text: "Army 2 cleared stragglers" },
  { id: "c", at: NOW - 55 * 60, text: "Army 1 cleared a rift" },
];

const SEASON_NAMES = [
  "Ysabeau",
  "Aldric",
  "Corwin",
  "Maelis",
  "Tybalt",
  "Oriane",
  "Garrick",
  "Linnea",
  "Bertrand",
  "Sylvaine",
  "Osric",
];
const SEASON_SITES = [148, 132, 127, 121, 116, 110, 104, 99, 95, 92, 90];
const SEASON_LORDS = [704, 640, 576, 512, 448, 416, 384, 352, 320, 288, 256];
const SEASON_ROWS: SeasonListRow[] = SEASON_NAMES.map((name, index) => ({
  key: name,
  rank: index + 1,
  order: index + 1,
  name,
  sitesCleared: SEASON_SITES[index],
  lords: SEASON_LORDS[index],
  own: false,
}));
const OWN_ROW: SeasonListRow = { key: "you", rank: 12, order: 12, name: YOU, sitesCleared: 88, lords: 192, own: true };

/** The guide's lab lines, by the step they show. */
const GUIDE_LINES = {
  reveal: "first-reveal",
  deploy: "deploy",
  realm: "build-barracks",
  rest: "rest",
  fight: "losing-fight",
  season: "season-over",
} as const;

const LAB_GUIDE_FACTS: GuideFacts = {
  realm: true,
  barracks: false,
  troopsAtHome: 1_500,
  armies: 0,
  armyActed: false,
  armyTierAffordable: false,
  camp: null,
  siteCleared: false,
  stragglers: false,
  castleAffordable: false,
  onMap: true,
  typeTierAffordable: null,
  armiesTired: false,
  ruin: false,
  chestPaid: false,
  armyBeyondSpire: false,
  losingFight: true,
  storeFull: null,
  seasonOver: true,
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
  "last-hour": { clock: LAST_HOUR, stores: STORES, armies: ARMIES, lastHour: true },
  "day-done": { clock: NIGHT, stores: STORES, armies: [], dayDone: DAY_DONE },
  "day-done-full": {
    clock: NIGHT,
    stores: STORES,
    armies: [],
    dayDone: { ...DAY_DONE, returned: { sent: 470, fitted: 200 } },
  },
  night: {
    clock: NIGHT,
    stores: [
      store("essence", 24_650),
      store("labor", 10_790, 18_000),
      store("wheat", 15_560, 18_000),
      store("troops", 7_400, 18_000),
    ],
    armies: [],
  },
  build: { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "build" },
  "build-early": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "build-early" },
  castle: { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "castle" },
  "castle-short": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "castle-short" },
  "realm-full": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "full" },
  "army-cheap": { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, army: { chosen: "logistics" } },
  "army-dear": { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, army: { chosen: "battle" } },
  "army-nearly-full": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { chosen: "logistics", stamina: 140 },
  },
  "army-scout": { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, army: { chosen: "scouting" } },
  "army-legendary": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { chosen: "battle", xp: 520, stamina: 240, max: 240, tiers: [5, 4, 3, 4] },
  },
  "army-refill": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { chosen: "logistics", stamina: 20, lords: 1_240, confirm: true },
  },
  "army-refill-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { chosen: "logistics", stamina: 20, lords: 40 },
  },
  "move-refill": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    refill: true,
    order: { ...EXPLORE, stamina: { cost: 30, held: 10, wait: 40 * 60 } },
  },
  production: { clock: CLOCK, stores: STORES, armies: ARMIES, production: PRODUCTION_LINES },
  "production-full": {
    clock: CLOCK,
    stores: FULL_STORES,
    armies: ARMIES,
    realmDot: "ember",
    production: [
      { ...PRODUCTION_LINES[0], held: 17_580, tone: "amber", fullIn: 18 * 60 },
      { ...PRODUCTION_LINES[1], held: 18_000, tone: "ember" },
      PRODUCTION_LINES[2],
    ],
  },
  "production-empty": {
    clock: CLOCK,
    stores: STORES,
    armies: [],
    production: [
      line({ icon: "Wh", spentAt: "deploy", perHour: 0, held: 4_500, limit: 6_000, noBuilding: true }),
      line({ icon: "La", spentAt: "realm", perHour: 100, held: 2_000, limit: 6_000, fullIn: 40 * HOUR }),
      line({ icon: "Tr", spentAt: "deploy", perHour: 0, held: 1_500, limit: 6_000, noBuilding: true }),
    ],
  },
  research: { clock: CLOCK, stores: STORES, armies: ARMIES, tree: "page" },
  "tree-farm": { clock: CLOCK, stores: STORES, armies: ARMIES, tree: "farm" },
  "tree-barracks": { clock: CLOCK, stores: STORES, armies: ARMIES, tree: "barracks" },
  "tree-hut": { clock: CLOCK, stores: STORES, armies: ARMIES, tree: "hut" },
  "tree-shrine": { clock: CLOCK, stores: STORES, armies: ARMIES, tree: "shrine" },
  "train-battle": { clock: CLOCK, stores: STORES, armies: ARMIES, training: "battle" },
  "train-hearth": { clock: CLOCK, stores: STORES, armies: ARMIES, training: "hearth" },
  "train-scouts": { clock: CLOCK, stores: STORES, armies: ARMIES, training: "scouts" },
  "train-short": { clock: CLOCK, stores: STORES, armies: ARMIES, training: "short" },
  today: { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today" },
  "today-earlier": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today-earlier" },
  "today-failed": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today-failed" },
  "season-over": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over" },
  "season-over-strong": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over-strong" },
  season: { clock: CLOCK, stores: STORES, armies: ARMIES, season: "list" },
  "season-detail": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "detail" },
  "season-loading": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "loading" },
  "season-failed": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "failed" },
  visiting: { clock: CLOCK, stores: STORES, armies: ARMIES, visiting: true },
  guide: { clock: CLOCK, stores: STORES, armies: ARMIES, guide: "reveal" },
  "guide-deploy": { clock: CLOCK, stores: STORES, armies: [], guide: "deploy" },
  "guide-realm": { clock: CLOCK, stores: STORES, armies: [], guide: "realm" },
  "guide-rest": { clock: CLOCK, stores: STORES, armies: ARMIES, guide: "rest" },
  "guide-fight": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    guide: "fight",
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 1_200 },
      fight: { outcome: "loses", exchanges: 3, troopsLost: 1_200, guardLeft: 2_300 },
    },
  },
  "guide-season": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over", guide: "season" },
} as const;

type LabState = {
  /** The order bar offers Refill for its short stamina. */
  refill?: boolean;
  guide?: keyof typeof GUIDE_LINES;
  results?: "today" | "today-earlier" | "today-failed" | "over" | "over-strong";
  season?: "list" | "detail" | "loading" | "failed";
  visiting?: boolean;
  training?: "battle" | "hearth" | "scouts" | "short";
  tree?: "page" | "farm" | "barracks" | "hut" | "shrine";
  production?: readonly ProductionLine[];
  army?: LabArmySheet;
  realmView?: "build" | "build-early" | "castle" | "castle-short" | "full";
  dayDone?: Parameters<typeof DayDoneCard>[0];
  lastHour?: boolean;
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
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
      />
      <HudBands
        strip={<StatusStrip clock={lab.clock} stores={[...lab.stores]} />}
        page={
          lab.tree ? (
            <TreePage
              essence={18_250}
              labor={9_640}
              rows={TREE_ROWS}
              castle={CASTLE_NODES}
              chosen={lab.tree === "page" || lab.tree === "shrine" ? undefined : lab.tree}
              onRow={noop}
              onCastle={noop}
            />
          ) : lab.season ? (
            <SeasonList
              rank={12}
              chest={{ tier: 1, lords: 32 }}
              rows={SEASON_ROWS}
              pinned={OWN_ROW}
              state={lab.season === "loading" || lab.season === "failed" ? lab.season : "ready"}
              onRetry={noop}
              onOpen={noop}
              onBack={noop}
            />
          ) : undefined
        }
        stage={lab.lastHour && <LastHourBubble troopsOut={6_021} returned={470} tiersToBuy={2} />}
        guide={lab.guide && lab.guide !== "fight" && lab.guide !== "season" && <LabGuide guide={lab.guide} />}
        notices={
          <>
            {lab.offline && <Notice icon="Of" line={OFFLINE} verb={TRY_AGAIN} onVerb={noop} ember />}
            {lab.clear && <SiteClearCard {...lab.clear} />}
          </>
        }
        action={
          <>
            {lab.realmView === "full" && (
              <BuildingsRow
                counts={{
                  [BuildingType.ResourceWheat]: 18,
                  [BuildingType.ResourceKnightT1]: 18,
                  [BuildingType.ResourceLabor]: 8,
                  [BuildingType.WorkersHut]: 8,
                }}
                onOpen={noop}
              />
            )}
            {lab.order && (
              <OrderBar
                {...lab.order}
                revealYield={500}
                xp={2}
                refill={lab.refill ? <RefillButton price={140} held={1_240} onRefill={noop} /> : undefined}
                onCancel={noop}
                onGo={noop}
              />
            )}
            {selected && !lab.order && (
              <ArmyStatusBar stamina={selected.stamina} secondsToFull={2 * HOUR} revealYield={500} />
            )}
            {lab.visiting && <VisitFoot label="Aldric" order={2} name="Aldric" arriving={false} onLeave={noop} />}
          </>
        }
        dock={!lab.order && <LabDock lab={lab} />}
        nav={
          !lab.visiting && (
            <PlaceNav
              place={lab.menu || lab.season ? "menu" : lab.tree ? "research" : lab.realmView ? "realm" : "map"}
              onGo={noop}
              realmDot={lab.realmDot}
              researchDot={!lab.offline}
              unread={lab.offline ? 0 : 3}
            />
          )
        }
        peek={<SeasonPeekView rows={[...SEASON_ROWS.slice(0, 5), OWN_ROW]} onOpen={noop} />}
      >
        {lab.deploy && <LabDeploySheet deploy={lab.deploy} />}
        {lab.results && <LabResults results={lab.results} guided={lab.guide === "season"} />}
        {lab.season === "detail" && (
          <SeasonDetailSheet
            label="Aldric"
            detail={{
              rank: 2,
              order: 2,
              name: "Aldric",
              sites: { total: 132, camps: 70, rifts: 43, ruins: 9, stragglers: 10 },
              chests: 9,
              lords: 640,
              reach: 0,
              essence: 212_000,
              labor: 96_000,
            }}
            onVisit={noop}
            onClose={noop}
          />
        )}
        {lab.dayDone && <DayDoneCard {...lab.dayDone} />}
        {lab.army && <LabArmy army={lab.army} />}
        {lab.tree && lab.tree !== "page" && <LabTreeSheet tree={lab.tree} />}
        {lab.training && <LabTraining training={lab.training} />}
        {lab.production && <ProductionSheet lines={lab.production} onSpend={noop} onBuild={noop} onClose={noop} />}
        {(lab.realmView === "build" || lab.realmView === "build-early") && (
          <BuildView
            tiles={lab.realmView === "build" ? BUILD_TILES : EARLY_TILES}
            chosen={lab.realmView === "build" ? 0 : 2}
            onChoose={noop}
            gains={
              lab.realmView === "build"
                ? [
                    { icon: "Wh", value: "+375/h", label: "produces" },
                    { icon: "Pp", value: "1", label: "population" },
                  ]
                : [
                    { icon: "Tr", value: "+100/h", label: "produces" },
                    { icon: "Pp", value: "3", label: "population" },
                  ]
            }
            prices={[{ of: "labor", amount: lab.realmView === "build" ? 6_800 : 800 }]}
            short={undefined}
            sending={false}
            onBuild={noop}
            onMap={noop}
            onClose={noop}
          />
        )}
        {(lab.realmView === "castle" || lab.realmView === "castle-short") && (
          <CastleView
            now={CASTLE_SIDE(1, 18_000)}
            next={CASTLE_SIDE(2, 50_000)}
            prices={[{ of: "labor", amount: 15_000 }]}
            short={
              lab.realmView === "castle-short"
                ? { kind: "short", icon: "La", held: 9_640, need: 15_000, wait: 10 * HOUR + 44 * 60 }
                : undefined
            }
            sending={false}
            onUpgrade={noop}
            onMap={noop}
            onClose={noop}
          />
        )}
        {lab.site && (
          <SiteCardView
            {...lab.site}
            guide={lab.guide === "fight" ? <LabGuide guide="fight" /> : undefined}
            onRealm={noop}
            onClose={noop}
          />
        )}
        {lab.chest && <RuinChestMoment {...lab.chest} />}
        {lab.menu && (
          <MenuSheet
            rank="#12"
            onToday={noop}
            onSeason={noop}
            onProduction={noop}
            guide={{ on: true, onToggle: noop }}
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

/** The army sheet on the fiction: tier prices 100, 200, 400, 800 XP; a purchase refills up to 30. */
const LabArmy = ({ army }: { army: LabArmySheet }) => {
  const [battle, logistics, scouting, homecoming] = army.tiers ?? [3, 1, 1, 3];
  if (army.confirm)
    return (
      <RefillConfirm
        stamina={{ current: army.stamina ?? 90, max: army.max ?? 150 }}
        held={army.lords}
        sending={false}
        onRefill={noop}
        onCancel={noop}
      />
    );
  return (
    <ArmySheet
      name="Army 1"
      art="/images/armies/knightT1.png"
      troops={army.tiers ? 60_000 : 5_000}
      xp={army.xp ?? 260}
      stamina={{ current: army.stamina ?? 90, max: army.max ?? 150, secondsToFull: 2 * HOUR }}
      refill={
        army.lords === undefined ? undefined : (
          <RefillButton price={(army.max ?? 150) - (army.stamina ?? 90)} held={army.lords} onRefill={noop} />
        )
      }
      attributes={{
        battle: { tier: battle },
        logistics: { tier: logistics },
        scouting: { tier: scouting, kinds: army.tiers ? ["rift", "rift"] : [] },
        homecoming: { tier: homecoming },
      }}
      tierPrices={{ 2: 100, 3: 200, 4: 400, 5: 800 }}
      effects={EFFECTS}
      refillOnBuy={30}
      chosen={army.chosen}
      onChoose={noop}
      kindRates={{ camp: ["4%", "4.4%"], rift: ["4%", "4.4%"], stragglers: ["6%", "6.6%"] }}
      kind="rift"
      onKind={noop}
      sending={false}
      onUpgrade={noop}
      onClose={noop}
    />
  );
};

/** The tree's sheets on the fiction: a farm's two sides, barracks above the labor limit, a hut, the shrine row. */
const LabTreeSheet = ({ tree }: { tree: "farm" | "barracks" | "hut" | "shrine" }) => {
  if (tree === "shrine")
    return (
      <CastleNodeSheet
        node={CASTLE_NODES[0]}
        gives={<Chip icons={["Sh"]} label="XP" value="+200" unit="XP" />}
        sending={false}
        onResearch={noop}
        onClose={noop}
      />
    );
  if (tree === "hut")
    return (
      <TypeUpgradeSheet
        icon="Ht"
        name={HUT}
        tier={1}
        gives={
          <span className="flex justify-center">
            <Chip icons={["Pp"]} label="population" value="30 → 36" />
          </span>
        }
        prices={[
          { of: "essence", amount: 500 },
          { of: "labor", amount: 500 },
        ]}
        sending={false}
        onUpgrade={noop}
        onClose={noop}
      />
    );
  const farm = tree === "farm";
  return (
    <TypeUpgradeSheet
      icon={farm ? "Fm" : "Bs"}
      name={farm ? FARM : BARRACKS}
      tier={farm ? 2 : 3}
      sides={
        farm
          ? [
              { icon: "Fi", name: "Fields", gain: { icon: "Wh", label: "wheat", value: "1,500 → 1,800/h" } },
              { icon: "Gr", name: "Granary", gain: { icon: "Sg", label: "limit", value: "18K → 27K" } },
            ]
          : [
              { icon: "Dr", name: "Drill", gain: { icon: "Tr", label: "troops", value: "600 → 700/h" } },
              { icon: "Ra", name: "Rations", gain: { icon: "Wh", label: "wheat", value: "2 → 1.75" } },
            ]
      }
      lifted={1}
      onLift={noop}
      prices={[
        { of: "essence", amount: farm ? 4_000 : 48_000 },
        { of: "labor", amount: farm ? 3_000 : 24_000 },
      ]}
      short={
        farm
          ? undefined
          : {
              reason: { kind: "short", icon: "Sg", held: 24_000, need: 18_000 },
              step: <Button role="primary" icon="Cs" word={CASTLE} className="w-[120px]" onClick={noop} />,
            }
      }
      sending={false}
      onUpgrade={noop}
      onClose={noop}
    />
  );
};

/** A training building's sheet on the fiction: the War hall to rare, the Hearth to rare, the Scouts' lodge's kind. */
const LabTraining = ({ training }: { training: "battle" | "hearth" | "scouts" | "short" }) => {
  const hearth = training === "hearth";
  const scouts = training === "scouts";
  return (
    <TypeUpgradeSheet
      icon={hearth ? "He" : scouts ? "Ld" : "Wa"}
      name={TRAINING_BUILDINGS[hearth ? 3 : scouts ? 2 : 0]}
      tier={scouts ? 1 : 2}
      gives={
        <TrainingGives
          mark={hearth ? "Su" : scouts ? "Sc" : "Ba"}
          attribute={hearth ? "Homecoming" : scouts ? "Scouting" : "Battle"}
          effect={hearth ? "3% → 9%" : scouts ? "+10%" : "+10% → +30%"}
          xpSaved={scouts ? 100 : 300}
          tier={scouts ? 1 : 2}
          armyArt="/images/armies/knightT1.png"
          kinds={
            scouts ? (
              <KindChoice
                rates={{ camp: ["4%", "4.4%"], rift: ["4%", "4.4%"], stragglers: ["6%", "6.6%"] }}
                lifted="rift"
                onKind={noop}
              />
            ) : undefined
          }
        />
      }
      prices={[
        { of: "essence", amount: scouts ? 12_000 : 48_000 },
        { of: "labor", amount: scouts ? 3_000 : 9_000 },
      ]}
      short={
        training === "short"
          ? {
              reason: { kind: "short", icon: "Es", held: 18_250, need: 48_000 },
              step: <Button role="primary" icon="Mp" word={MAP} className="w-[104px]" onClick={noop} />,
            }
          : undefined
      }
      sending={false}
      onUpgrade={noop}
      onClose={noop}
    />
  );
};

/** A guide line on the lab fixtures, with its thread to the control it names. */
const LabGuide = ({ guide }: { guide: keyof typeof GUIDE_LINES }) => {
  const card = useRef<HTMLElement>(null);
  const step = GUIDE_STEPS.find(({ id }) => id === GUIDE_LINES[guide]);
  if (!step) throw new Error(`No guide step ${GUIDE_LINES[guide]}`);
  return (
    <>
      <GuideCard
        ref={card}
        mark={step.mark}
        line={step.line(LAB_GUIDE_FACTS)}
        onShowMe={step.place ? noop : undefined}
        onNext={noop}
      />
      {step.target && <GuideThread from={card} target={step.target} />}
    </>
  );
};

/** The dock on the lab's armies: a row of tokens, or desktop's column of full cards. */
const LabDock = ({ lab }: { lab: LabState }) => {
  const wide = useLayout() === "desktop";
  return (
    <nav
      aria-label="Armies"
      className={wide ? "pointer-events-auto flex flex-col gap-1.5" : "pointer-events-auto flex gap-1.5"}
    >
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
          guided={index === 0}
          wide={
            wide
              ? {
                  secondsToFull: index === 1 ? undefined : 2 * HOUR,
                  returnsHome: army.troops && Math.floor(army.troops * 0.09),
                }
              : undefined
          }
          onPick={noop}
        />
      ))}
      {Array.from({ length: lab.visiting ? 0 : SLOTS - lab.armies.length }, (_, index) => (
        <OpenSlot
          key={index}
          label="Deploy"
          pulse={index === 0 && lab.armies.length === 0}
          guided={index === 0}
          wide={wide}
          onDeploy={noop}
        />
      ))}
    </nav>
  );
};

const LabResults = ({ results, guided }: { results: NonNullable<LabState["results"]>; guided: boolean }) =>
  results === "over" || results === "over-strong" ? (
    <SeasonOverCard
      ending={results === "over" ? "lifted" : "strong"}
      place={12}
      field={1_000}
      podium={[
        { key: "1", rank: 1, name: "Ysabeau", sitesCleared: 448 },
        { key: "2", rank: 2, name: "Aldric", sitesCleared: 412 },
        { key: "3", rank: 3, name: "Corwin", sitesCleared: 397 },
      ]}
      totals={{ sitesCleared: 288, chests: 61, lords: 2_003, reach: 2, essence: 2_100_000, labor: 1_400_000 }}
      guide={guided ? <LabGuide guide="season" /> : undefined}
      onSeason={noop}
      onExit={noop}
    />
  ) : (
    <TodaySheet
      day={results === "today-earlier" ? 11 : 12}
      today={results !== "today-earlier"}
      totals={{ reveals: 19, cleared: 2, chests: 0, essence: 4_150, labor: 550, lords: 0 }}
      armiesToUpgrade={2}
      lines={TODAY_LOG}
      failed={results === "today-failed"}
      onRetry={noop}
      onEarlier={noop}
      onLater={results === "today-earlier" ? noop : undefined}
      onArmies={noop}
      onClose={noop}
    />
  );
