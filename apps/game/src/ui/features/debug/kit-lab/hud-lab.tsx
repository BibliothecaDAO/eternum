import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Notice } from "@/ui/design-system/kit/notice";
import {
  BARRACKS,
  CASTLE,
  FARM,
  HUT,
  OFFLINE,
  PAYOUTS_PAUSED,
  TRAINING_BUILDINGS,
  TRY_AGAIN,
  WITHDRAWALS_CLOSED,
  WORKSHOP,
  YOU,
} from "@/ui/design-system/kit/words";
import { ArmyStatusBar } from "@/ui/features/frontier/hud/action-bar";
import { ArmyToken, OpenSlot } from "@/ui/features/frontier/hud/army-token";
import type { DayClock } from "@/ui/features/frontier/hud/day-clock";
import { HudBands } from "@/ui/features/frontier/hud/hud-bands";
import { MenuSheet } from "@/ui/features/frontier/hud/menu-sheet";
import { ChatPage } from "@/ui/features/frontier/hud/chat-page";
import { OrderBar } from "@/ui/features/frontier/hud/order-bar";
import { DeployView } from "@/ui/features/frontier/deploy/deploy-view";
import { RuinChestMoment } from "@/ui/features/frontier/chest/ruin-chest-moment";
import { Sheet } from "@/ui/design-system/kit/sheet";
import type { FightResult } from "@/ui/features/frontier/sites/fight-result";
import { FightResultCard } from "@/ui/features/frontier/sites/fight-result-card";
import { TARGET_MARKS } from "@/ui/features/frontier/sites/site-marks";
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
import { SeasonWithdrawRow } from "@/ui/features/frontier/value/season-withdraw";
import { VisitFoot } from "@/ui/features/frontier/board/visit-foot";
import { useLayout } from "@/shell/frame/layout";
import { GuideCard } from "@/ui/features/frontier/guide/guide-card";
import { GuideLinesSheet } from "@/ui/features/frontier/guide/guide-lines-sheet";
import { type GuideFacts, GUIDE_STEPS } from "@/ui/features/frontier/guide/guide-script";
import { GuideThread } from "@/ui/features/frontier/guide/guide-thread";
import { useRef, useState } from "react";
import { RefillButton, RefillConfirm } from "@/ui/features/frontier/army/refill";
import { LordsPurse, PurseRow, RealmsChip } from "@/ui/features/frontier/value/lords-purse";
import { type HeldRealm, planRealmLabor } from "@/ui/features/frontier/value/realm-labor";
import { RealmsSheet } from "@/ui/features/frontier/value/realms-sheet";
import { type WithdrawStep, WithdrawSheet } from "@/ui/features/frontier/value/withdraw-sheet";

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
type LabChest = Parameters<typeof RuinChestMoment>[0];

const ARMY_CHIP = { art: "knight-t1" as const, troops: 5_000 };
const ATTACK_30 = { kind: "attack" as const, stamina: 30, onAttack: () => undefined };
/** A fight the army wins in so many attacks; the losses and the guard left are this attack's, as its result shows. */
const WIN = (exchanges: number, troopsLost: number, guardLeft = 0) => ({
  outcome: "wins" as const,
  exchanges,
  troopsLost,
  guardLeft,
});
const CAMP_CARD: LabSite = {
  site: "Camp",
  beast: undefined,
  army: ARMY_CHIP,
  guard: 1_100,
  fight: WIN(1, 180),
  pay: { icon: "labor", amount: 550 },
  xp: 82,
  verb: ATTACK_30,
};
const RUIN_CARD: LabSite = {
  site: "Ruin",
  beast: "Troll",
  army: ARMY_CHIP,
  guard: 3_400,
  fight: WIN(2, 1_250, 1_520),
  pay: null,
  chest: { tier: 3, lords: 128 },
  xp: 145,
  verb: ATTACK_30,
};

/**
 * The value screens' fiction: a realm holding 1,240 LORDS, a linked wallet, and three Realms in it. LAB_PRESET is the
 * numbers page's proposal for the presets the Realm holder's labor reads (1,000 labor a Realm a game day, five Realms an
 * account a day); the live screen reads them from the preset when Herald serves it.
 */
const LAB_PRESET = { realmLabor: 1_000, realmsADay: 5 };
const WALLET_ADDRESS = "0x04a1d2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f99f3c";
const REALMS_HELD: readonly HeldRealm[] = [
  { realmId: 1_088, name: "Stolsli", order: 9, claimedToday: true, inWallet: true },
  { realmId: 4_512, name: "Uw Rohi", order: 3, claimedToday: false, inWallet: true },
  { realmId: 6_077, name: "Mamaalan", order: 8, claimedToday: false, inWallet: true },
];
const SEVEN_REALMS: readonly HeldRealm[] = [
  ...REALMS_HELD,
  { realmId: 212, name: "Ilbarn", order: 1, claimedToday: false, inWallet: true },
  { realmId: 3_301, name: "Kelvos", order: 5, claimedToday: false, inWallet: true },
  { realmId: 5_990, name: "Orrin", order: 12, claimedToday: false, inWallet: true },
  { realmId: 7_421, name: "Tamsel", order: 14, claimedToday: false, inWallet: true },
];
type LabWithdraw = { held: number; wallet: string | null; refusal?: string; step: WithdrawStep; amount: number };
type LabRealms = { wallet: string | null; realms: readonly HeldRealm[]; labor: number; limit: number };
const WITHDRAW_500: LabWithdraw = { held: 1_240, wallet: WALLET_ADDRESS, step: { kind: "pick" }, amount: 500 };
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
  { key: "farm", icon: "farm", name: "Farm", tip: "", foot: { kind: "price", labor: 6_800, short: false } },
  { key: "workshop", icon: "workshop", name: "Workshop", tip: "", foot: { kind: "price", labor: 10_000, short: true } },
  { key: "barracks", icon: "barracks", name: "Barracks", tip: "", foot: { kind: "price", labor: 6_800, short: false } },
  { key: "hut", icon: "workers-hut", name: "Hut", tip: "", foot: { kind: "price", labor: 5_100, short: false } },
  { key: "war", icon: "war-hall", name: TRAINING_BUILDINGS[0], tip: "", foot: { kind: "built" } },
  {
    key: "supply",
    icon: "supply-yard",
    name: TRAINING_BUILDINGS[1],
    tip: "",
    foot: { kind: "price", labor: 3_000, short: false },
  },
  {
    key: "lodge",
    icon: "scout-lodge",
    name: TRAINING_BUILDINGS[2],
    tip: "",
    foot: { kind: "price", labor: 3_000, short: false },
  },
  { key: "hearth", icon: "hearth", name: TRAINING_BUILDINGS[3], tip: "", foot: { kind: "built" } },
];
const EARLY_TILES: Parameters<typeof BuildView>[0]["tiles"] = [
  { key: "farm", icon: "farm", name: "Farm", tip: "", foot: { kind: "price", labor: 800, short: false } },
  { key: "workshop", icon: "workshop", name: "Workshop", tip: "", foot: { kind: "price", labor: 2_000, short: false } },
  { key: "barracks", icon: "barracks", name: "Barracks", tip: "", foot: { kind: "price", labor: 800, short: false } },
  { key: "hut", icon: "workers-hut", name: "Hut", tip: "", foot: { kind: "price", labor: 300, short: false } },
  { key: "war", icon: "war-hall", name: TRAINING_BUILDINGS[0], tip: "", foot: { kind: "locked", gate: 3 } },
  { key: "supply", icon: "supply-yard", name: TRAINING_BUILDINGS[1], tip: "", foot: { kind: "locked", gate: 3 } },
  { key: "lodge", icon: "scout-lodge", name: TRAINING_BUILDINGS[2], tip: "", foot: { kind: "locked", gate: 3 } },
  { key: "hearth", icon: "hearth", name: TRAINING_BUILDINGS[3], tip: "", foot: { kind: "locked", gate: 3 } },
];
const CASTLE_SIDE = (level: number, limit: number) => ({
  level,
  art: realmMeaning(level),
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
  line({ icon: "wheat", spentAt: "deploy", perHour: 1_500, sides: ["fields"], held: 4_410, fullIn: 9 * HOUR + 4 * 60 }),
  line({ icon: "labor", spentAt: "realm", perHour: 500, held: 9_640, fullIn: 16 * HOUR + 44 * 60 }),
  line({ icon: "troops", spentAt: "deploy", perHour: 600, sides: ["drill"], held: 1_200, fullIn: 28 * HOUR }),
];

/** A city's tree: farm uncommon (Fields), workshop common, barracks rare (Drill twice), hut common, two training buildings. */
const TREE_ROWS: TreeRow[] = [
  {
    key: "farm",
    icon: "farm",
    name: FARM,
    tier: 2,
    sides: ["fields"],
    next: { essence: 4_000, labor: 3_000 },
    choice: true,
    tip: "",
  },
  {
    key: "workshop",
    icon: "workshop",
    name: WORKSHOP,
    tier: 1,
    sides: [],
    next: { essence: 2_000, labor: 2_000 },
    choice: true,
    tip: "",
  },
  {
    key: "barracks",
    icon: "barracks",
    name: BARRACKS,
    tier: 3,
    sides: ["drill", "drill"],
    next: { essence: 48_000, labor: 24_000 },
    choice: true,
    tip: "",
  },
  {
    key: "hut",
    icon: "workers-hut",
    name: HUT,
    tier: 1,
    sides: [],
    next: { essence: 500, labor: 500 },
    choice: false,
    tip: "",
  },
  {
    key: "war",
    icon: "war-hall",
    name: TRAINING_BUILDINGS[0],
    tier: 2,
    sides: [],
    next: { essence: 48_000, labor: 9_000 },
    choice: false,
    tip: "",
  },
  {
    key: "hearth",
    icon: "hearth",
    name: TRAINING_BUILDINGS[3],
    tier: 2,
    sides: [],
    next: { essence: 48_000, labor: 9_000 },
    choice: false,
    tip: "",
  },
];
const CASTLE_NODES = [
  { key: "shrine", icon: "shrine" as const, label: "Shrine", tip: "", essence: 2_000, state: "open" as const },
  { key: "well", icon: "well" as const, label: "Well", tip: "", essence: 6_000, state: "open" as const },
  { key: "d1", icon: "depth-1" as const, label: "I", tip: "", essence: 160_000, state: "open" as const },
  { key: "d2", icon: "depth-2" as const, label: "II", tip: "", essence: 400_000, state: "locked" as const },
  { key: "d3", icon: "depth-3" as const, label: "III", tip: "", essence: 900_000, state: "locked" as const },
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
  label: name,
  sitesCleared: SEASON_SITES[index],
  lords: SEASON_LORDS[index],
  own: false,
}));
/**
 * A million LORDS deposited for a 100-unit season: Day 12 spans five units and releases a twentieth of it. Yesterday's
 * rolls set today's share at 12 LORDS, under the ceiling of 16; a common chest holds two shares.
 */
const SEASON_POOL_FIGURES = { lords: 1_000_000, today: 50_000, price: 12, ceiling: 16 };
const SEASON_COMMON_CHEST = { tier: 1 as const, lords: 24 };
const OWN_ROW: SeasonListRow = {
  key: "you",
  rank: 12,
  order: 12,
  name: YOU,
  label: YOU,
  sitesCleared: 88,
  lords: 192,
  own: true,
};

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
  populationFull: false,
  armySelected: false,
  guardInReach: false,
  xpEarned: false,
  researchOpen: false,
  lastHour: false,
  rules: {
    hutAdds: 6,
    stamina: { explore: 30, move: 10, attack: 30, anHour: 30 },
    xp: { reveal: 2, firstTier: 100 },
    homecomingPercent: 3,
  },
};

/** The lines the guide has said by the season's end, as the Menu's Guide lists them to read again. */
const LAB_GUIDE_SAID = Object.values(GUIDE_LINES).map((id) => {
  const step = GUIDE_STEPS.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`No guide step ${id}`);
  return { id, line: step.line(LAB_GUIDE_FACTS) };
});

const STATES = {
  idle: { clock: CLOCK, stores: STORES, armies: ARMIES },
  selected: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0 },
  full: { clock: CLOCK, stores: FULL_STORES, armies: ARMIES, realmDot: "ember" as const },
  offline: { clock: UNKNOWN_CLOCK, stores: UNKNOWN_STORES, armies: UNKNOWN_ARMIES, offline: true },
  menu: { clock: CLOCK, stores: STORES, armies: ARMIES, menu: true },
  chat: { clock: CLOCK, stores: STORES, armies: ARMIES, chat: true },
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
    site: { ...CAMP_CARD, pay: { icon: "labor", amount: 550, fits: 120 } },
  },
  "site-stragglers": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...CAMP_CARD, site: "Stragglers", guard: 400, fight: WIN(1, 15), pay: null, xp: 50 },
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
        { label: "Army 1", art: ARMY_CHIP.art, troops: 5_000, fight: WIN(2, 180, 492), onPick: () => undefined },
        {
          label: "Army 2",
          art: ARMY_CHIP.art,
          troops: 100,
          fight: { outcome: "loses", exchanges: 1, troopsLost: 100, guardLeft: 1_034 },
          onPick: () => undefined,
        },
        { label: "Army 3", art: ARMY_CHIP.art, troops: 600, fight: undefined, onPick: () => undefined },
      ],
    },
  },
  "site-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...CAMP_CARD, verb: { kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } } },
  },
  "fight-won": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    fight: {
      site: "Camp",
      verdict: "victory",
      armyArt: ARMY_CHIP.art,
      army: { before: 1_498, after: 1_318 },
      guard: { before: 1_100, after: 0 },
      gained: { pay: { icon: "labor", amount: 550 }, xp: 22 },
    },
  },
  "fight-goes-on": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    fight: {
      site: "Stragglers",
      verdict: "guard-holds",
      armyArt: ARMY_CHIP.art,
      army: { before: 500, after: 432 },
      guard: { before: 334, after: 150 },
      gained: null,
    },
  },
  "fight-army-lost": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    fight: {
      site: "Rift",
      verdict: "army-lost",
      armyArt: ARMY_CHIP.art,
      army: { before: 154, after: 0 },
      guard: { before: 1_100, after: 1_028 },
      gained: null,
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
      line({ icon: "wheat", spentAt: "deploy", perHour: 0, held: 4_500, limit: 6_000, noBuilding: true }),
      line({ icon: "labor", spentAt: "realm", perHour: 100, held: 2_000, limit: 6_000, fullIn: 40 * HOUR }),
      line({ icon: "troops", spentAt: "deploy", perHour: 0, held: 1_500, limit: 6_000, noBuilding: true }),
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
  "season-over-withdraw": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over", seasonLords: "open" },
  "season-over-closed": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over", seasonLords: "closed" },
  season: { clock: CLOCK, stores: STORES, armies: ARMIES, season: "list" },
  "season-detail": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "detail" },
  "season-pool-unpublished": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "unpublished" },
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
  "guide-lines": { clock: CLOCK, stores: STORES, armies: ARMIES, guideLines: true },
  "value-hud": { clock: CLOCK, stores: STORES, armies: ARMIES, purse: { lords: 1_240, realms: 2_000 } },
  "value-hud-claimed": { clock: CLOCK, stores: STORES, armies: ARMIES, purse: { lords: 1_240 } },
  "value-menu": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240, realms: 2_000 },
    menu: true,
    menuRealms: true,
  },
  withdraw: { clock: CLOCK, stores: STORES, armies: ARMIES, purse: { lords: 1_240 }, withdraw: WITHDRAW_500 },
  "withdraw-no-wallet": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    withdraw: { ...WITHDRAW_500, wallet: null },
  },
  "withdraw-sending": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 740 },
    withdraw: { ...WITHDRAW_500, held: 740, step: { kind: "sending", amount: 500 } },
  },
  "withdraw-paid": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 740 },
    withdraw: {
      ...WITHDRAW_500,
      held: 740,
      step: { kind: "paid", amount: 500, transactionUrl: "https://voyager.online/tx/0x7f3a21" },
    },
  },
  "withdraw-paused": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    withdraw: { ...WITHDRAW_500, refusal: PAYOUTS_PAUSED },
  },
  "withdraw-closed": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    withdraw: { ...WITHDRAW_500, refusal: WITHDRAWALS_CLOSED },
  },
  "withdraw-waiting": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 740 },
    withdraw: { ...WITHDRAW_500, held: 740, step: { kind: "waiting", amount: 500 } },
  },
  realms: {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240, realms: 2_000 },
    realms: { wallet: WALLET_ADDRESS, realms: REALMS_HELD, labor: 9_640, limit: 18_000 },
  },
  "realms-claimed": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    realms: {
      wallet: WALLET_ADDRESS,
      realms: REALMS_HELD.map((realm) => ({ ...realm, claimedToday: true })),
      labor: 9_640,
      limit: 18_000,
    },
  },
  "realms-full": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240, realms: 2_000 },
    realms: { wallet: WALLET_ADDRESS, realms: REALMS_HELD, labor: 17_600, limit: 18_000 },
  },
  "realms-cap": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240, realms: 4_000 },
    realms: { wallet: WALLET_ADDRESS, realms: SEVEN_REALMS, labor: 9_640, limit: 18_000 },
  },
  // The second Realm was refused by a claim: the wallet no longer holds it.
  "realms-sold": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240, realms: 1_000 },
    realms: {
      wallet: WALLET_ADDRESS,
      realms: REALMS_HELD.map((realm) => (realm.realmId === 4_512 ? { ...realm, inWallet: false } : realm)),
      labor: 9_640,
      limit: 18_000,
    },
  },
  "realms-none": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    realms: { wallet: WALLET_ADDRESS, realms: [], labor: 9_640, limit: 18_000 },
  },
} as const;

type LabState = {
  /** The order bar offers Refill for its short stamina. */
  refill?: boolean;
  guide?: keyof typeof GUIDE_LINES;
  results?: "today" | "today-earlier" | "today-failed" | "over" | "over-strong";
  /** The realm's LORDS on the season-over card: still to withdraw, or past the season's close. */
  seasonLords?: "open" | "closed";
  season?: "list" | "detail" | "unpublished" | "loading" | "failed";
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
  fight?: FightResult;
  chest?: LabChest;
  deploy?: LabDeploy;
  clock: DayClock;
  stores: readonly StoreReading[];
  armies: readonly LabArmy[];
  selected?: number;
  realmDot?: "ember";
  offline?: boolean;
  menu?: boolean;
  /** The Menu's Guide sheet: its switch on, and the lines said so far. */
  guideLines?: boolean;
  /** Chat open: a page on a phone, docked on desktop. Its controls are there to be measured for touch. */
  chat?: boolean;
  /** The LORDS count under the strip, what a chest just added, and the labor the player's Realms have waiting. */
  purse?: { lords: number; gain?: number; realms?: number };
  menuRealms?: boolean;
  withdraw?: LabWithdraw;
  realms?: LabRealms;
};

const SLOTS = 4;
const noop = () => undefined;

/**
 * Dev only: the Map HUD's states on the lab fixtures, at /lab/kit/hud/<state> (idle, selected, full, offline, menu,
 * empty, explore, move, wheat-short, stamina-short): the components the live HUD draws, on the handoff's fiction.
 * /lab/kit/hud/line-<step> speaks any of the guide's lines at the foot.
 */
export const HudLab = () => {
  const { state = "idle" } = useParams();
  const line = state.startsWith("line-") ? state.slice("line-".length) : undefined;
  const lab: LabState = line ? STATES.idle : (STATES[state as keyof typeof STATES] ?? STATES.idle);
  const footLine =
    line ?? (lab.guide && lab.guide !== "fight" && lab.guide !== "season" ? GUIDE_LINES[lab.guide] : undefined);
  const selected = lab.selected === undefined ? undefined : lab.armies[lab.selected];
  const desktop = useLayout() === "desktop";
  const chatPane = useRef<HTMLElement>(null);
  const chat = lab.chat && <ChatPage gameZoneId="lab-game" signedIn onSignIn={noop} pane={chatPane} />;
  return (
    <>
      <div
        aria-hidden
        data-lab="frontier"
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
      />
      <HudBands
        strip={
          <>
            <StatusStrip clock={lab.clock} stores={[...lab.stores]} />
            {lab.purse && (
              <PurseRow>
                {lab.purse.realms !== undefined && <RealmsChip labor={lab.purse.realms} onOpen={noop} />}
                <LordsPurse lords={lab.purse.lords} gain={lab.purse.gain} onOpen={noop} />
              </PurseRow>
            )}
          </>
        }
        page={
          chat && !desktop ? (
            chat
          ) : lab.tree ? (
            // A row's sheet opens from the page, as FrontierResearch opens it, so it takes the page's place.
            <>
              <TreePage
                essence={18_250}
                labor={9_640}
                rows={TREE_ROWS}
                castle={CASTLE_NODES}
                chosen={lab.tree === "page" || lab.tree === "shrine" ? undefined : lab.tree}
                onRow={noop}
                onCastle={noop}
              />
              {lab.tree !== "page" && <LabTreeSheet tree={lab.tree} />}
            </>
          ) : lab.season ? (
            <>
              <SeasonList
                rank={12}
                chest={lab.season === "unpublished" ? undefined : SEASON_COMMON_CHEST}
                pool={lab.season === "unpublished" ? null : SEASON_POOL_FIGURES}
                rows={SEASON_ROWS}
                pinned={OWN_ROW}
                state={lab.season === "loading" || lab.season === "failed" ? lab.season : "ready"}
                onRetry={noop}
                onOpen={noop}
                onBack={noop}
              />
              {lab.season === "detail" && (
                <SeasonDetailSheet
                  label="Aldric"
                  detail={{
                    rank: 2,
                    order: 2,

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
            </>
          ) : undefined
        }
        stage={lab.lastHour && <LastHourBubble troopsOut={6_021} returned={470} tiersToBuy={2} />}
        guide={footLine && <LabGuide stepId={footLine} />}
        notices={lab.offline && <Notice icon="network-off" line={OFFLINE} verb={TRY_AGAIN} onVerb={noop} ember />}
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
              place={
                lab.chat && !desktop
                  ? "chat"
                  : lab.menu || lab.season
                    ? "menu"
                    : lab.tree
                      ? "research"
                      : lab.realmView
                        ? "realm"
                        : "map"
              }
              onGo={noop}
              realmDot={lab.realmDot}
              researchDot={!lab.offline}
              unread={lab.offline ? 0 : 3}
            />
          )
        }
        chat={desktop && chat}
      >
        {lab.deploy && <LabDeploySheet deploy={lab.deploy} />}
        {lab.results && (
          <LabResults results={lab.results} guided={lab.guide === "season"} seasonLords={lab.seasonLords} />
        )}
        {lab.dayDone && <DayDoneCard {...lab.dayDone} />}
        {lab.army && <LabArmy army={lab.army} />}
        {lab.training && <LabTraining training={lab.training} />}
        {lab.production && <ProductionSheet lines={lab.production} onSpend={noop} onBuild={noop} onClose={noop} />}
        {(lab.realmView === "build" || lab.realmView === "build-early") && (
          <BuildView
            population={lab.realmView === "build" ? { free: 3, total: 12 } : { free: 6, total: 6 }}
            tiles={lab.realmView === "build" ? BUILD_TILES : EARLY_TILES}
            chosen={lab.realmView === "build" ? 0 : 2}
            onChoose={noop}
            gains={
              lab.realmView === "build"
                ? [
                    { icon: "wheat", value: "+375/h", label: "produces" },
                    { icon: "person", value: "1", label: "population" },
                  ]
                : [
                    { icon: "troops", value: "+100/h", label: "produces" },
                    { icon: "person", value: "3", label: "population" },
                  ]
            }
            prices={[{ of: "labor", amount: lab.realmView === "build" ? 6_800 : 800 }]}
            refusal={undefined}
            sending={false}
            onBuild={noop}
            onClose={noop}
          />
        )}
        {(lab.realmView === "castle" || lab.realmView === "castle-short") && (
          <CastleView
            now={CASTLE_SIDE(1, 18_000)}
            next={CASTLE_SIDE(2, 50_000)}
            makes={[
              { icons: ["labor"], label: "labor the castle makes an hour", value: "+101/h" },
              { icons: ["labor", "resources"], label: "labor held of its store's limit", value: "9,640 / 18,000" },
            ]}
            prices={[{ of: "labor", amount: 15_000 }]}
            refusal={
              lab.realmView === "castle-short"
                ? {
                    reason: { kind: "short", of: "labor", held: 9_640, need: 15_000, wait: 10 * HOUR + 44 * 60 },
                    fix: { icon: "map", word: "Explore for labor", onFix: noop },
                  }
                : undefined
            }
            sending={false}
            onUpgrade={noop}
            onClose={noop}
          />
        )}
        {lab.site && (
          <SiteCardView
            {...lab.site}
            guide={lab.guide === "fight" ? <LabGuide stepId={GUIDE_LINES.fight} /> : undefined}
            onRealm={noop}
            onClose={noop}
          />
        )}
        {lab.fight && (
          <Sheet label={TARGET_MARKS[lab.fight.site].word} onClose={noop}>
            <FightResultCard result={lab.fight} onClose={noop} />
          </Sheet>
        )}
        {lab.chest && <RuinChestMoment {...lab.chest} />}
        {lab.withdraw && <LabWithdrawSheet withdraw={lab.withdraw} />}
        {lab.realms && <LabRealmsSheet realms={lab.realms} />}
        {lab.guideLines && <GuideLinesSheet on lines={LAB_GUIDE_SAID} onToggle={noop} onClose={noop} />}
        {lab.menu && (
          <MenuSheet
            rank="#12"
            onToday={noop}
            onSeason={noop}
            onProduction={noop}
            realms={lab.menuRealms ? { waiting: true, onOpen: noop } : undefined}
            guide={{ on: true, onOpen: noop }}
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
      art={deploy.troopsAtHome === 0 ? undefined : ("knight-t1" as const)}
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
      art="knight-t1"
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
        gives={<Chip icons={["shrine"]} label="XP" value="+200" unit="XP" />}
        sending={false}
        onResearch={noop}
        onClose={noop}
      />
    );
  if (tree === "hut")
    return (
      <TypeUpgradeSheet
        icon="workers-hut"
        name={HUT}
        tier={1}
        gives={
          <span className="flex justify-center">
            <Chip icons={["person"]} label="population" value="30 → 36" />
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
      icon={farm ? "farm" : "barracks"}
      name={farm ? FARM : BARRACKS}
      tier={farm ? 2 : 3}
      sides={
        farm
          ? [
              { icon: "fields", name: "Fields", gain: { icon: "wheat", label: "wheat", value: "1,500 → 1,800/h" } },
              { icon: "granary", name: "Granary", gain: { icon: "resources", label: "limit", value: "18K → 27K" } },
            ]
          : [
              { icon: "drill", name: "Drill", gain: { icon: "troops", label: "troops", value: "600 → 700/h" } },
              { icon: "rations", name: "Rations", gain: { icon: "wheat", label: "wheat", value: "2 → 1.75" } },
            ]
      }
      lifted={1}
      onLift={noop}
      prices={[
        { of: "essence", amount: farm ? 4_000 : 48_000 },
        { of: "labor", amount: farm ? 3_000 : 24_000 },
      ]}
      refusal={
        farm
          ? undefined
          : {
              reason: { kind: "short", of: "labor", counted: "limit", held: 18_000, need: 24_000 },
              fix: { icon: "realm", word: CASTLE, onFix: noop },
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
      icon={hearth ? "hearth" : scouts ? "scout-lodge" : "war-hall"}
      name={TRAINING_BUILDINGS[hearth ? 3 : scouts ? 2 : 0]}
      tier={scouts ? 1 : 2}
      gives={
        <TrainingGives
          mark={hearth ? "order-enlightenment" : scouts ? "order-detection" : "order-rage"}
          attribute={hearth ? "Homecoming" : scouts ? "Scouting" : "Battle"}
          effect={hearth ? "3% → 9%" : scouts ? "+10%" : "+10% → +30%"}
          xpSaved={scouts ? 100 : 300}
          tier={scouts ? 1 : 2}
          armyArt="knight-t1"
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
      refusal={
        training === "short"
          ? {
              reason: { kind: "short", of: "essence", held: 18_250, need: 48_000 },
              fix: { icon: "map", word: "Explore for Essence", onFix: noop },
            }
          : undefined
      }
      sending={false}
      onUpgrade={noop}
      onClose={noop}
    />
  );
};

/** A guide line on the lab fixtures, by its step, with its thread to the control it names. */
const LabGuide = ({ stepId }: { stepId: string }) => {
  const card = useRef<HTMLElement>(null);
  const step = GUIDE_STEPS.find(({ id }) => id === stepId);
  if (!step) throw new Error(`No guide step ${stepId}`);
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
          art={army.troops === undefined ? undefined : ("knight-t1" as const)}
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

const LabResults = ({
  results,
  guided,
  seasonLords,
}: {
  results: NonNullable<LabState["results"]>;
  guided: boolean;
  seasonLords: LabState["seasonLords"];
}) =>
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
      withdraw={
        seasonLords && (
          <SeasonWithdrawRow
            lords={1_240}
            closesAt={NOW + (seasonLords === "open" ? 6 * 24 * HOUR + 23 * HOUR : -HOUR)}
            now={NOW}
            onOpen={noop}
          />
        )
      }
      guide={guided ? <LabGuide stepId={GUIDE_LINES.season} /> : undefined}
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

/** Withdraw on the fiction: the amount moves with the slider and All. */
const LabWithdrawSheet = ({ withdraw }: { withdraw: LabWithdraw }) => {
  const [amount, setAmount] = useState(withdraw.amount);
  return (
    <WithdrawSheet
      held={withdraw.held}
      wallet={withdraw.wallet}
      refusal={withdraw.refusal ?? null}
      step={withdraw.step}
      amount={amount}
      onAmount={setAmount}
      onWithdraw={noop}
      onLinkWallet={noop}
      onClose={noop}
    />
  );
};

/** Realms on the fiction, planned with the lab's presets against the labor store. */
const LabRealmsSheet = ({ realms }: { realms: LabRealms }) => (
  <RealmsSheet
    wallet={realms.wallet}
    plan={planRealmLabor({
      realms: realms.realms,
      perRealm: LAB_PRESET.realmLabor,
      cap: LAB_PRESET.realmsADay,
      labor: { held: realms.labor, limit: realms.limit },
    })}
    perRealm={LAB_PRESET.realmLabor}
    cap={LAB_PRESET.realmsADay}
    labor={realms.labor}
    secondsLeft={CLOCK.secondsLeft}
    sending={false}
    adding={false}
    onClaim={noop}
    onAdd={noop}
    onRealm={noop}
    onLinkWallet={noop}
    onClose={noop}
  />
);
