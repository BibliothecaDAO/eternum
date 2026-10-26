import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { transferArmies, TRANSFER_TAPPED } from "@/ui/features/frontier/army/transfer-fixture";
import { TransferTroopsSheet, useSelectedTransfer } from "@/ui/features/frontier/army/transfer-troops";
import { useGame } from "@/hooks/context/game-context";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { HudNotice, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { OFFLINE, PAYOUTS_PAUSED, TRAINING_BUILDINGS, WITHDRAWALS_CLOSED, YOU } from "@/ui/design-system/kit/words";
import { ArmyList, ArmyRow } from "@/ui/features/frontier/hud/army-row";
import { ArmyToken, OpenSlot } from "@/ui/features/frontier/hud/army-token";
import type { DayClock } from "@/ui/features/frontier/hud/day-clock";
import { HudBands } from "@/ui/features/frontier/hud/hud-bands";
import { FrontierDesktop, FrontierPlaces } from "@/ui/features/frontier/hud/frontier-desktop";
import type { HudSurface } from "@/ui/features/frontier/hud/frontier-nav";
import { LabGame } from "./lab-game";
import { useHudMode } from "@/hooks/use-hud-mode";
import { MenuPage } from "@/ui/features/frontier/hud/menu-page";
import { ChatPage } from "@/ui/features/frontier/hud/chat-page";
import { OrderBar } from "@/ui/features/frontier/hud/order-bar";
import { DeployView } from "@/ui/features/frontier/deploy/deploy-view";
import { DEPLOY_RING } from "./deploy-section";
import { RuinChestMoment } from "@/ui/features/frontier/chest/ruin-chest-moment";
import type { FightResult } from "@/ui/features/frontier/sites/fight-result";
import { FightResultCard } from "@/ui/features/frontier/sites/fight-result-card";
import { TARGET_MARKS } from "@/ui/features/frontier/sites/site-marks";
import { SiteCardView } from "@/ui/features/frontier/sites/site-card-view";
import { DayDoneCard } from "@/ui/features/frontier/rollover/day-done-card";
import { DayEndScreen } from "@/ui/features/frontier/rollover/day-end-screen";
import { RESTING, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { BuildView } from "@/ui/features/frontier/build/build-view";
import { BuildingsRow } from "@/ui/features/frontier/realm/buildings-row";
import { CastleView } from "@/ui/features/frontier/upgrade/castle-view";
import { readArmyDetail } from "@/ui/features/frontier/army/army-detail";
import { ArmyDetail } from "@/ui/features/frontier/army/army-panel";
import { MID_REALM, VETERAN_ARMY } from "@/ui/features/frontier/research/progression-fixture";
import { ResearchPanel } from "@/ui/features/frontier/research/research-panel";
import { readResearchTree } from "@/ui/features/frontier/research/research-tree";
import { StoreCard, type StoreLine } from "@/ui/features/frontier/production/store-card";
import { BuildingType, Direction } from "@bibliothecadao/types";
import { PlaceNav } from "@/ui/features/frontier/hud/place-nav";
import { StatusStrip, type StoreReading } from "@/ui/features/frontier/hud/status-strip";
import { useParams } from "react-router-dom";
import { TodaySheet } from "@/ui/features/frontier/log/today-sheet";
import { ownerDayLog } from "./today-log-fixture";
import { SeasonList, type SeasonListRow } from "@/ui/features/frontier/board/season-list";
import { SeasonDetailSheet } from "@/ui/features/frontier/board/season-detail";
import { SeasonOverCard } from "@/ui/features/frontier/board/season-over-card";
import { SeasonWithdrawRow } from "@/ui/features/frontier/value/season-withdraw";
import { VisitFoot } from "@/ui/features/frontier/board/visit-foot";
import { useLayout } from "@/shell/frame/layout";
import { frontierCoachSteps } from "@/ui/features/frontier/next-up/frontier-coach";
import type { NextUpFacts } from "@/ui/features/frontier/next-up/next-up-facts";
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";
import { useEventFeedStore } from "@/ui/features/event-feed/event-feed-store";
import { RefillButton, RefillConfirm } from "@/ui/features/frontier/army/refill";
import { LordsPurse, PurseRow, RealmsChip } from "@/ui/features/frontier/value/lords-purse";
import { DayPill } from "@/ui/features/frontier/hud/day-pill";
import { RealmPanel } from "@/ui/features/frontier/hud/realm-panel";
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
/** The lab's explore cost, as its rules say it: a 150 bar is five explores. */
const LAB_EXPLORE = 30;

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

/** A city's deploy: 6,200 troops at home, 2 wheat a troop. */
type LabDeploy = {
  count: number;
  troopsAtHome: number;
  wheat: number;
};

const DEPLOY: LabDeploy = { count: 5_000, troopsAtHome: 6_200, wheat: 14_410 };

type LabSite = Omit<Parameters<typeof SiteCardView>[0], "onClose" | "onRealm">;
type LabChest = Parameters<typeof RuinChestMoment>[0];

const ARMY_CHIP = { art: "knight-t1" as const, troops: 5_000 };
const ATTACK_30 = { kind: "attack" as const, stamina: 30, onAttack: () => undefined };
/**
 * A fight the army wins in so many attacks: this attack's losses and the guard it leaves, as its result shows, and
 * the whole fight's (each attack costing as this one, the guard's every troop killed, 30 stamina an attack).
 */
const WIN = (exchanges: number, troopsLost: number, guard: number, guardLeft = 0) => ({
  outcome: "wins" as const,
  exchanges,
  troopsLost,
  guardLeft,
  whole: { troopsLost: troopsLost * exchanges, guardKilled: guard, stamina: 30 * exchanges },
});
/** A fight that ends with the army gone: every troop lost over the whole fight, and what it killed by then. */
const LOSE = (exchanges: number, troopsLost: number, guardLeft: number, army: number, guardKilled: number) => ({
  outcome: "loses" as const,
  exchanges,
  troopsLost,
  guardLeft,
  whole: { troopsLost: army, guardKilled, stamina: 30 * exchanges },
});
const CAMP_CARD: LabSite = {
  site: "Camp",
  beast: undefined,
  army: ARMY_CHIP,
  guard: 1_100,
  fight: WIN(1, 180, 1_100),
  pay: { icon: "labor", amount: 550 },
  xp: 82,
  verb: ATTACK_30,
};
const RUIN_CARD: LabSite = {
  site: "Ruin",
  beast: { name: "Troll", beast: "troll", combatClass: "Knight" },
  army: ARMY_CHIP,
  guard: 3_400,
  fight: WIN(2, 1_250, 3_400, 1_520),
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
const UNKNOWN_TOTALS = {
  reveals: undefined,
  cleared: undefined,
  chests: undefined,
  essence: undefined,
  labor: undefined,
  lords: undefined,
};
const DAY_DONE = {
  endedDay: 12,
  clock: { ...NIGHT, secondsLeft: 7 * HOUR + 55 * 60 },
  totals: { reveals: 31, cleared: 3, chests: 1, essence: 6_400, labor: 1_150, lords: 128 },
  history: "whole" as const,
  onRetry: () => undefined,
  rank: { from: 14, to: 12 },
  armies: 3,
  troopsLost: 6_021,
  returned: { sent: 470, fitted: 470 },
  onContinue: () => undefined,
};

type LabTile = Parameters<typeof BuildView>[0]["tiles"][number];
/** A building card for the lab: its painting and name, what it gives and takes, and where it stands. */
const tile = (
  key: string,
  icon: LabTile["icon"],
  name: string,
  gives: LabTile["gives"],
  takes: number,
  standing: LabTile["standing"],
): LabTile => ({ key, icon, name, tip: "", gives, takes, standing });
const price = (labor: number, short?: Extract<LabTile["standing"], { kind: "price" }>["short"]) =>
  ({ kind: "price", labor, short }) as const;
const TRAINS = { icon: "order-rage", value: "Common" } as const;

/**
 * A city's build sheet: eight buildings, the War hall and Hearth already standing, a fifth farm at 6,800 labor, the
 * Workshop 3h 10m from its 10,000.
 */
const BUILD_TILES: LabTile[] = [
  tile("farm", "farm", "Farm", { icon: "wheat", value: "+6.3/min" }, 1, price(6_800)),
  tile(
    "workshop",
    "workshop",
    "Workshop",
    { icon: "labor", value: "+0.83/min" },
    1,
    price(10_000, { of: "labor", wait: 3 * HOUR + 10 * 60 }),
  ),
  tile("barracks", "barracks", "Barracks", { icon: "troops", value: "+1.7/min" }, 3, price(6_800)),
  tile("hut", "workers-hut", "Hut", { icon: "person", value: "+6" }, 0, price(5_100)),
  tile("war", "war-hall", TRAINING_BUILDINGS[0], TRAINS, 2, { kind: "built" }),
  tile("supply", "supply-yard", TRAINING_BUILDINGS[1], { ...TRAINS, icon: "order-skill" }, 2, price(3_000)),
  tile("lodge", "scout-lodge", TRAINING_BUILDINGS[2], { ...TRAINS, icon: "order-detection" }, 2, price(3_000)),
  tile("hearth", "hearth", TRAINING_BUILDINGS[3], { ...TRAINS, icon: "order-enlightenment" }, 2, { kind: "built" }),
];
/** A fresh realm: the training buildings locked behind the Barracks at Rare. */
const EARLY_TILES: LabTile[] = [
  tile("farm", "farm", "Farm", { icon: "wheat", value: "+5/min" }, 1, price(800)),
  tile("workshop", "workshop", "Workshop", { icon: "labor", value: "+0.83/min" }, 1, price(2_000)),
  tile("barracks", "barracks", "Barracks", { icon: "troops", value: "+1.7/min" }, 3, price(800)),
  tile("hut", "workers-hut", "Hut", { icon: "person", value: "+6" }, 0, price(300)),
  tile("war", "war-hall", TRAINING_BUILDINGS[0], TRAINS, 2, { kind: "locked", gate: 3 }),
  tile("supply", "supply-yard", TRAINING_BUILDINGS[1], { ...TRAINS, icon: "order-skill" }, 2, {
    kind: "locked",
    gate: 3,
  }),
  tile("lodge", "scout-lodge", TRAINING_BUILDINGS[2], { ...TRAINS, icon: "order-detection" }, 2, {
    kind: "locked",
    gate: 3,
  }),
  tile("hearth", "hearth", TRAINING_BUILDINGS[3], { ...TRAINS, icon: "order-enlightenment" }, 2, {
    kind: "locked",
    gate: 3,
  }),
];
const CASTLE_SIDE = (level: number, limit: number) => ({
  level,
  art: realmMeaning(level),
  plots: [6, 18, 36, 60][level],
  slots: [3, 4, 5, 6][level],
  limit,
  deployCap: [3_000, 9_000, 25_000, 50_000][level],
});

/** The veteran army's panel; with `lords` its refill is offered, with `confirm` the refill's confirm is open. */
type LabArmySheet = { lords?: number; confirm?: boolean; stamina?: number };

/** A city's three stores: 18,000 a store, wheat lifted by Fields, troops by Drill. */
const line = (overrides: Partial<StoreLine> & Pick<StoreLine, "icon" | "spentAt">): StoreLine => ({
  perHour: undefined,
  held: undefined,
  limit: 18_000,
  tone: "calm",
  fullIn: undefined,
  noBuilding: false,
  ...overrides,
});
const STORE_LINES: StoreLine[] = [
  line({ icon: "wheat", spentAt: "deploy", perHour: 1_500, sides: ["fields"], held: 4_410, fullIn: 9 * HOUR + 4 * 60 }),
  line({ icon: "labor", spentAt: "realm", perHour: 500, held: 9_640, fullIn: 16 * HOUR + 44 * 60 }),
  line({ icon: "troops", spentAt: "deploy", perHour: 600, sides: ["drill"], held: 1_200, fullIn: 28 * HOUR }),
];

/** Today's lines, each written by the day log itself from the owner's 22 October stories (today-log-fixture.ts). */
let todayLog: ReturnType<typeof ownerDayLog> | undefined;
const readTodayLog = () => (todayLog ??= ownerDayLog(NOW - 24 * 60));

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
/** Each realm's rank (Settlement 0 to Empire 3) and deepest reach, the leaders the furthest on. */
const SEASON_REALMS = [
  [3, 3],
  [3, 2],
  [2, 2],
  [2, 1],
  [2, 1],
  [2, 0],
  [1, 1],
  [1, 0],
  [1, 1],
  [0, 0],
  [0, 0],
] as const;
const SEASON_ROWS: SeasonListRow[] = SEASON_NAMES.map((name, index) => ({
  key: name,
  rank: index + 1,
  order: index + 1,
  realm: { level: SEASON_REALMS[index][0], reach: SEASON_REALMS[index][1] },
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
  realm: { level: 1, reach: 1 },
  name: YOU,
  label: YOU,
  sitesCleared: 88,
  lords: 192,
  own: true,
};

/**
 * What Next up reads on the lab's realm: barracks built, troops at home, the preset's numbers. Each state adds its
 * armies, selection, hour and stores, and may say more (nextUp).
 */
const LAB_NEXT_UP_FACTS: NextUpFacts = {
  realm: true,
  barracks: true,
  troopsAtHome: 1_500,
  armies: 0,
  armySelected: false,
  armiesTired: false,
  guardInReach: false,
  camp: null,
  armyTierAffordable: false,
  castleAffordable: false,
  typeTierAffordable: null,
  lastHour: false,
  storeFull: null,
  populationFull: false,
  rules: { hutAdds: 6, stamina: { explore: 30, anHour: 30 }, xp: { reveal: 2 }, homecomingPercent: 3 },
};

/**
 * The fight card (the owner's pick, option A) on the owner's camp and two more: fight-short, a Troll camp it wins in
 * three attacks, 31 minutes from the stamina; fight-ready, one attack clears it now; fight-loses, the army is lost in
 * this attack.
 */
const OWNERS_CAMP: LabSite = {
  site: "Camp",
  beast: { name: "Troll", beast: "troll", combatClass: "Knight" },
  army: { art: "knight-t1", troops: 1_500 },
  guard: 1_300,
  fight: WIN(3, 180, 1_300, 740),
  pay: { icon: "wood", amount: 650 },
  xp: 90,
  verb: { kind: "short", stamina: { cost: 30, held: 14, wait: 31 * 60 } },
};
const FIGHT_STATES: Record<string, LabState> = Object.fromEntries(
  Object.entries({
    short: OWNERS_CAMP,
    ready: {
      ...OWNERS_CAMP,
      beast: undefined,
      army: { art: "knight-t1", troops: 5_000 },
      guard: 1_100,
      fight: WIN(1, 180, 1_100),
      pay: { icon: "labor", amount: 550 },
      xp: 82,
      verb: ATTACK_30,
    },
    loses: {
      ...OWNERS_CAMP,
      army: { art: "knight-t1", troops: 400 },
      fight: LOSE(1, 400, 1_150, 400, 150),
      verb: ATTACK_30,
    },
  } satisfies Record<string, LabSite>).map(([name, site]) => [
    `fight-${name}`,
    { clock: CLOCK, stores: STORES, armies: ARMIES, site },
  ]),
);

const STATES = {
  ...FIGHT_STATES,
  merge: { clock: CLOCK, stores: STORES, armies: ARMIES, merge: true },
  idle: { clock: CLOCK, stores: STORES, armies: ARMIES },
  // An army picked opens its panel, as the game opens it on a selection.
  selected: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, army: {} },
  full: { clock: CLOCK, stores: FULL_STORES, armies: ARMIES, realmDot: "ember" as const },
  offline: { clock: UNKNOWN_CLOCK, stores: UNKNOWN_STORES, armies: UNKNOWN_ARMIES, offline: true },
  menu: { clock: CLOCK, stores: STORES, armies: ARMIES, menu: true },
  chat: { clock: CLOCK, stores: STORES, armies: ARMIES, chat: true },
  empty: { clock: CLOCK, stores: STORES, armies: [] },
  explore: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, order: EXPLORE },
  move: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, order: MOVE },
  // QA's charge (qa-blitz-2 #5): 563 troops at 0.05 wheat a step take 28.15 wheat, which reads rounded.
  "explore-fraction": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    order: { ...EXPLORE, wheat: { cost: 28.15, held: 4_410, wait: undefined } },
  },
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
  "deploy-scout": { clock: CLOCK, stores: STORES, armies: ARMIES, deploy: { ...DEPLOY, count: 1 } },
  "deploy-wheat": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    deploy: { ...DEPLOY, count: 1_000, wheat: 2_000 },
  },
  "deploy-empty": {
    clock: CLOCK,
    stores: STORES,
    armies: [],
    deploy: { ...DEPLOY, count: 0, troopsAtHome: 0 },
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
  "site-beasts": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...CAMP_CARD, site: "Beasts", guard: 400, fight: WIN(1, 15, 400), pay: null, xp: 50 },
  },
  "site-ruin": { clock: CLOCK, stores: STORES, armies: ARMIES, site: RUIN_CARD },
  "site-ruin-lose": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 1_200 },
      fight: LOSE(3, 1_200, 2_300, 1_200, 1_100),
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
        { label: "Army 1", art: ARMY_CHIP.art, troops: 5_000, fight: WIN(2, 180, 1_100, 492), onPick: () => undefined },
        {
          label: "Army 2",
          art: ARMY_CHIP.art,
          troops: 100,
          fight: LOSE(1, 100, 1_034, 100, 66),
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
      targetId: 29,
      tile: { col: 0, row: 0 },
      site: "Camp",
      verdict: "victory",
      armyArt: ARMY_CHIP.art,
      army: { before: 1_498, after: 1_318 },
      guard: { before: 1_100, after: 0 },
      gained: { pay: { icon: "labor", amount: 550, storeFull: false }, xp: 22 },
    },
  },
  "fight-goes-on": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    fight: {
      targetId: 29,
      tile: { col: 0, row: 0 },
      site: "Beasts",
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
      targetId: 29,
      tile: { col: 0, row: 0 },
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
  // The player's history no longer reaches back to the ended day's start: dashes, and why.
  "day-done-short": {
    clock: NIGHT,
    stores: STORES,
    armies: [],
    dayDone: { ...DAY_DONE, totals: UNKNOWN_TOTALS, history: "short" as const },
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
  "army-refill": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { stamina: 20, lords: 1_240, confirm: true },
  },
  "army-refill-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { stamina: 20, lords: 40 },
  },
  "move-refill": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    refill: true,
    order: { ...EXPLORE, stamina: { cost: 30, held: 10, wait: 40 * 60 } },
  },
  // A store's card, opened from its ring (desktop) or its plate (phone): filling, full, and made by no building.
  stores: { clock: CLOCK, stores: STORES, armies: ARMIES, storeCard: STORE_LINES[0] },
  "stores-full": {
    clock: CLOCK,
    stores: FULL_STORES,
    armies: ARMIES,
    realmDot: "ember",
    storeCard: { ...STORE_LINES[1], held: 18_000, tone: "ember" },
  },
  "stores-empty": {
    clock: CLOCK,
    stores: STORES,
    armies: [],
    storeCard: line({ icon: "troops", spentAt: "deploy", perHour: 0, held: 1_500, limit: 6_000, noBuilding: true }),
  },
  research: { clock: CLOCK, stores: STORES, armies: ARMIES, research: true },
  // A refused order's notice, through the game's own notice store: on a desktop it stands in the rail under Next up.
  notice: { clock: CLOCK, stores: STORES, armies: ARMIES, notice: "Not enough stamina" },
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
  "next-up-deploy": { clock: CLOCK, stores: STORES, armies: [] },
  "next-up-barracks": { clock: CLOCK, stores: STORES, armies: [], nextUp: { barracks: false } },
  "next-up-rest": { clock: CLOCK, stores: STORES, armies: ARMIES, nextUp: { armiesTired: true } },
  "next-up-camp": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    nextUp: { camp: { x: 4, y: 9 }, guardInReach: true, armyTierAffordable: true },
  },
  "site-losing": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 1_200 },
      fight: LOSE(3, 1_200, 2_300, 1_200, 1_100),
    },
  },
  "value-hud": { clock: CLOCK, stores: STORES, armies: ARMIES, purse: { lords: 1_240, realms: 2_000 } },
  // The purse and Next up at once, as a signed-in player meets them: the layout check holds them apart.
  "purse-next-up": { clock: CLOCK, stores: STORES, armies: [], purse: { lords: 1_240, realms: 2_000 } },
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
  /** No wallet linked: the sheet says what Realms are for, then asks for the wallet (live-qa-night-1 P3-3). */
  "realms-no-wallet": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    realms: { wallet: null, realms: [], labor: 9_640, limit: 18_000 },
  },
} as const;

type LabState = {
  merge?: boolean;
  /** The order bar offers Refill for its short stamina. */
  refill?: boolean;
  /** What Next up reads beyond the state's armies, selection, hour and stores. */
  nextUp?: Partial<NextUpFacts>;
  results?: "today" | "today-earlier" | "today-failed" | "over" | "over-strong";
  /** The realm's LORDS on the season-over card: still to withdraw, or past the season's close. */
  seasonLords?: "open" | "closed";
  season?: "list" | "detail" | "unpublished" | "loading" | "failed";
  visiting?: boolean;
  /** A notice the client raises (a refused order), as the game's notice store holds it. */
  notice?: string;
  /** Research's page: the tree on the realm some days in. */
  research?: boolean;
  /** The card a store's ring or plate opened. */
  storeCard?: StoreLine;
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
 * Next up reads each state (next-up-deploy, next-up-barracks, next-up-rest, next-up-camp say more).
 */
export const HudLab = () => {
  const { state = "idle" } = useParams();
  const lab: LabState = STATES[state as keyof typeof STATES] ?? STATES.idle;
  const desktop = useLayout() === "desktop";
  // The game wears Frontier's age (world.tsx's useHudMode); the lab draws it the same.
  useHudMode("frontier");
  useLabNotice(lab.notice);
  const chatPane = useRef<HTMLElement>(null);
  const chat = lab.chat && <ChatPage gameZoneId="lab-game" signedIn onSignIn={noop} pane={chatPane} />;
  if (lab.merge)
    return (
      <div data-lab="frontier-merge" className="ui min-h-screen bg-hud-surface flex items-center justify-center p-3">
        <div className="w-full max-w-md">
          <LabMerge />
        </div>
      </div>
    );
  return (
    <>
      <div
        aria-hidden
        data-lab="frontier"
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
      />
      <LabBands
        desktop={desktop}
        lab={lab}
        strip={
          <>
            <StatusStrip clock={lab.clock} stores={[...lab.stores]} />
            {!desktop && lab.storeCard && <StoreCard line={lab.storeCard} onSpend={noop} onBuild={noop} />}
          </>
        }
        purse={
          lab.purse && (
            <PurseRow>
              {lab.purse.realms !== undefined && <RealmsChip labor={lab.purse.realms} onOpen={noop} />}
              <LordsPurse lords={lab.purse.lords} gain={lab.purse.gain} onOpen={noop} />
            </PurseRow>
          )
        }
        page={
          chat && !desktop ? (
            chat
          ) : lab.research ? (
            <LabResearch />
          ) : lab.menu ? (
            <MenuPage
              rank="#12"
              onToday={noop}
              onSeason={noop}
              realms={lab.menuRealms ? { waiting: true, onOpen: noop } : undefined}
              onSettings={noop}
              onExit={noop}
              onClose={noop}
            />
          ) : lab.season ? (
            // A realm's detail stands in the list's place, as FrontierSeason shows it.
            lab.season === "detail" ? (
              <SeasonDetailSheet
                label="Aldric"
                detail={{
                  rank: 2,
                  order: 2,

                  sites: { total: 132, camps: 70, rifts: 43, ruins: 9, beasts: 10 },
                  chests: 9,
                  lords: 640,
                  reach: 0,
                  essence: 212_000,
                  labor: 96_000,
                }}
                onVisit={noop}
                onClose={noop}
              />
            ) : (
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
            )
          ) : undefined
        }
        nextUp={!lab.visiting && <NextUpView steps={labNextUpSteps(lab, desktop)} compact={!desktop} />}
        notices={lab.offline && <HudNotice tone="bad" line={OFFLINE} retry={noop} />}
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
            {lab.order && !desktop && (
              <OrderBar
                {...lab.order}
                revealYield={500}
                xp={2}
                refill={lab.refill ? <RefillButton price={140} held={1_240} onRefill={noop} /> : undefined}
                onCancel={noop}
                onGo={noop}
              />
            )}
            {lab.visiting && <VisitFoot label="Aldric" order={2} name="Aldric" arriving={false} onLeave={noop} />}
          </>
        }
        dock={(desktop || !lab.order) && <LabDock lab={lab} />}
        nav={
          !lab.visiting && (
            <PlaceNav
              place={
                lab.chat && !desktop
                  ? "chat"
                  : lab.menu || lab.season
                    ? "menu"
                    : lab.research
                      ? "research"
                      : lab.realmView
                        ? "realm"
                        : null
              }
              onGo={noop}
              realmDot={lab.realmDot}
              researchDot={!lab.offline}
              events={lab.offline ? 0 : 2}
              unread={lab.offline ? 0 : 3}
            />
          )
        }
      >
        {lab.deploy && <LabDeploySheet deploy={lab.deploy} />}
        {lab.results && <LabResults results={lab.results} seasonLords={lab.seasonLords} />}
        {lab.dayDone && <LabDaySummary card={lab.dayDone} />}
        {lab.army && <LabArmy army={lab.army} />}
        {(lab.realmView === "build" || lab.realmView === "build-early") && (
          <BuildView
            population={lab.realmView === "build" ? LAB_POPULATION : { used: 0, total: 6 }}
            tiles={lab.realmView === "build" ? BUILD_TILES : EARLY_TILES}
            chosen={lab.realmView === "build" ? 0 : 2}
            onChoose={noop}
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
        {lab.site && <SiteCardView {...lab.site} onRealm={noop} onClose={noop} />}
        {lab.fight && (
          <HudSheet label={TARGET_MARKS[lab.fight.site].word} onClose={noop}>
            <FightResultCard result={lab.fight} onClose={noop} />
          </HudSheet>
        )}
        {lab.chest && <RuinChestMoment {...lab.chest} />}
        {lab.withdraw && <LabWithdrawSheet withdraw={lab.withdraw} />}
        {lab.realms && <LabRealmsSheet realms={lab.realms} />}
      </LabBands>
    </>
  );
};

/** The state's notice raised in the game's notice store while it shows, and put away when it goes. */
const useLabNotice = (notice: string | undefined) => {
  useEffect(() => {
    if (!notice) return;
    toast.error(notice);
    return () => useEventFeedStore.getState().dismiss();
  }, [notice]);
};

/** Deploy on the fiction, live: 2 wheat a troop, 0.02 a troop a tile. */
const LabDeploySheet = ({ deploy }: { deploy: LabDeploy }) => {
  const [count, setCount] = useState(deploy.count);
  const [chosen, setChosen] = useState<Direction | null>(Direction.EAST);
  const most = Math.min(deploy.troopsAtHome, Math.floor(deploy.wheat / 2));
  const wheatLeft = deploy.wheat - count * 2;
  return (
    <DeployView
      art={deploy.troopsAtHome === 0 ? undefined : ("knight-t1" as const)}
      troopsAtHome={deploy.troopsAtHome}
      count={count}
      amount={{ most, held: most < deploy.troopsAtHome ? most : deploy.troopsAtHome }}
      onCount={setCount}
      // The next army fills a slot whose army was released today with 40 stamina left.
      start={{ slot: 2, number: 3, inherited: true, start: { current: 40, max: 150, perExplore: LAB_EXPLORE } }}
      wheatCost={count * 2}
      march={count > 0 ? Math.floor(wheatLeft / (count * 0.02)) : 0}
      ring={{ center: { col: 10, row: 10 }, tiles: DEPLOY_RING, chosen, onPick: setChosen }}
      canDeploy={count > 0}
      sending={false}
      onDeploy={noop}
      wheatShort={undefined}
      onBuild={noop}
      onClose={noop}
    />
  );
};

/** The veteran army's panel on the fiction, with its refill where the realm's LORDS are given, or the refill's confirm. */
const LabArmy = ({ army }: { army: LabArmySheet }) => {
  const stamina = { current: army.stamina ?? 96, max: 170 };
  if (army.confirm)
    return <RefillConfirm stamina={stamina} held={army.lords} sending={false} onRefill={noop} onCancel={noop} />;
  return (
    <HudSheet label={VETERAN_ARMY.name} onClose={noop}>
      <ArmyDetail
        army={readArmyDetail({ ...VETERAN_ARMY, stamina })}
        refill={
          army.lords === undefined ? undefined : (
            <RefillButton price={stamina.max - stamina.current} held={army.lords} onRefill={noop} />
          )
        }
        sending={false}
        onLevelUp={noop}
      />
    </HudSheet>
  );
};

/** Research's page on the realm some days in: the game's tree, the picked node under it. */
const LabResearch = () => {
  const nodes = readResearchTree(MID_REALM);
  const [picked, setPicked] = useState(nodes[0]!.key);
  return (
    <ResearchPanel
      nodes={nodes}
      essence={MID_REALM.essence}
      labor={MID_REALM.labor}
      picked={picked}
      onPick={setPicked}
      sending={new Set()}
      fixFor={() => undefined}
      onResearch={noop}
    />
  );
};

/** Next up on the lab's realm at a state: the coach's steps, their buttons doing nothing. */
const labNextUpSteps = (lab: LabState, desktop: boolean): NextStep[] =>
  frontierCoachSteps(
    {
      ...LAB_NEXT_UP_FACTS,
      armies: lab.armies.length,
      armySelected: lab.selected !== undefined,
      lastHour: lab.lastHour === true,
      storeFull: lab.stores.find((store) => store.tone === "ember")?.kind ?? null,
      ...lab.nextUp,
    },
    { pointer: desktop ? "mouse" : "touch", where: "map", tips: true },
  ).map((step) => ({
    key: step.key,
    kind: "order",
    line: step.line,
    verb: step.verb,
    busy: false,
    run: step.verb ? noop : null,
  }));

/**
 * The HUD's slots in the lab as the game composes them: on a phone today's bands; on a desktop the HUD every mode
 * shares (FrontierDesktop) on the lab's game, its top bar, rail and minimap the game's own, Frontier's panels the lab's.
 */
const LabBands = ({ desktop, lab, ...slots }: ComponentProps<typeof HudBands> & { desktop: boolean; lab: LabState }) =>
  desktop ? (
    <LabGame preset={FRONTIER_PRESET}>
      {() => (
        <FrontierDesktop
          season={{ rank: "#12", onOpen: noop }}
          clock={<DayPill clock={lab.clock} />}
          realm={
            <RealmPanel
              name={LAB_REALM_NAME}
              level={1}
              highest={3}
              population={LAB_POPULATION}
              stores={[...lab.stores]}
              onHome={noop}
              {...(!lab.visiting && {
                lords: lab.purse?.lords ?? LAB_LORDS,
                labor: lab.purse?.realms,
                storeCards: lab.storeCard && {
                  kinds: ["wheat", "labor", "troops"],
                  open: lab.storeCard.icon,
                  onToggle: noop,
                  card: <StoreCard line={lab.storeCard} onSpend={noop} onBuild={noop} />,
                },
                onWithdraw: noop,
                onRealms: noop,
              })}
            />
          }
          armies={slots.dock}
          nextUp={slots.nextUp}
          page={slots.page}
          foot={
            <>
              {slots.notices}
              {slots.action}
            </>
          }
          places={
            !lab.visiting && (
              <FrontierPlaces
                surface={labSurface(lab)}
                home={labSurface(lab) === null}
                onSurface={noop}
                onHome={noop}
                research={!lab.offline}
              />
            )
          }
        >
          {slots.children}
        </FrontierDesktop>
      )}
    </LabGame>
  ) : (
    <HudBands {...slots} />
  );

/** Frontier's preset, so the lab's game plays as a Frontier game. */
const FRONTIER_PRESET = 5;

/** The lab realm's name and its LORDS where a state names none, as the desktop's realm panel reads them. */
const LAB_REALM_NAME = "Duskbite";
const LAB_LORDS = 320;
/** The fixture realm's population: what its buildings take of what its castle and Huts give. */
const LAB_POPULATION = { used: 9, total: 18 };

/** The place a lab state has open, as the desktop's round places light it. */
const labSurface = (lab: LabState): HudSurface | null =>
  lab.season
    ? "season"
    : lab.research
      ? "research"
      : lab.results === "today" || lab.results === "today-earlier" || lab.results === "today-failed"
        ? "today"
        : null;

/**
 * The armies on the lab, as ArmyDock draws them: a phone's row of tokens with an open slot for each army still to
 * deploy, or a desktop's list of rows with one Deploy (the header counts the slots).
 */
const LabDock = ({ lab }: { lab: LabState }) => {
  const open = lab.visiting ? 0 : SLOTS - lab.armies.length;
  const armyArt = (army: LabArmy) => (army.troops === undefined ? undefined : ("knight-t1" as const));
  const stamina = (army: LabArmy) =>
    army.stamina === undefined ? undefined : { current: army.stamina, max: 150, perExplore: LAB_EXPLORE };
  // In the last hour each army shows what its Homecoming (Uncommon: 9%) sends home.
  const returnsHome = (army: LabArmy) =>
    lab.lastHour && army.troops !== undefined ? Math.floor(army.troops * 0.09) : undefined;
  if (useLayout() === "desktop")
    return (
      <ArmyList used={lab.armies.length} allowed={lab.armies.length + open}>
        {lab.armies.map((army, index) => (
          <ArmyRow
            key={index}
            label={`Army ${index + 1}`}
            number={index + 1}
            art={armyArt(army)}
            troops={army.troops}
            returnsHome={returnsHome(army)}
            stamina={stamina(army)}
            xp={army.xp}
            canBuyTier={army.tier === true}
            selected={lab.selected === index}
            onPick={lab.visiting ? undefined : noop}
          />
        ))}
        {open > 0 && <OpenSlot label="Deploy" pulse={lab.armies.length === 0} wide onDeploy={noop} />}
      </ArmyList>
    );
  return (
    <nav aria-label="Armies" className="pointer-events-auto flex gap-1.5">
      {lab.armies.map((army, index) => (
        <ArmyToken
          key={index}
          label={`Army ${index + 1}`}
          art={armyArt(army)}
          xp={army.xp}
          stamina={stamina(army)}
          troops={army.troops}
          returnsHome={returnsHome(army)}
          canBuyTier={army.tier === true}
          selected={lab.selected === index}
          onPick={noop}
        />
      ))}
      {Array.from({ length: open }, (_, index) => (
        <OpenSlot key={index} label="Deploy" pulse={index === 0 && lab.armies.length === 0} onDeploy={noop} />
      ))}
    </nav>
  );
};

const LabResults = ({
  results,
  seasonLords,
}: {
  results: NonNullable<LabState["results"]>;
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
      onSeason={noop}
      onExit={noop}
    />
  ) : (
    <TodaySheet
      day={results === "today-earlier" ? 11 : 12}
      today={results !== "today-earlier"}
      totals={{ reveals: 19, cleared: 2, chests: 0, essence: 4_150, labor: 550, lords: 0 }}
      armiesToUpgrade={2}
      lines={readTodayLog()}
      history={results === "today-failed" ? "failed" : "whole"}
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

/** The day's summary where the game draws it: over the map at the day's end, in its summary phase. */
function LabDaySummary({ card }: { card: Parameters<typeof DayDoneCard>[0] }) {
  useEffect(() => {
    useDayEndStore.setState({ phase: "summary", arrival: "live", summary: "shown" });
    return () => useDayEndStore.setState(RESTING);
  }, []);
  return <DayEndScreen summary={<DayDoneCard {...card} />} />;
}

/** The same transfer selection as the map, on two adjacent armies; this lab never sends a transaction. */
const LabMerge = () => {
  const [store] = useState(() => transferArmies());
  useEffect(() => {
    useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: TRANSFER_TAPPED });
    return () => useUIStore.getState().selectOnMap(null);
  }, []);
  return (
    <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: "0x111" } as never}>
      <LabMergeCard />
    </GameProvider>
  );
};
const LabMergeCard = () => {
  const {
    setup: { store },
  } = useGame();
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  const pair = useSelectedTransfer(realm);
  return (
    pair && <TransferTroopsSheet realm={realm} pair={pair} onClose={() => useUIStore.getState().selectOnMap(null)} />
  );
};
