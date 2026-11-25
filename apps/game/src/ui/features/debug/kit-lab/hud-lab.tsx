import type { EtherealLayer } from "@bibliothecadao/eternum";
import { buildingOpensAtLevel, buildStoryEventPresentation } from "@bibliothecadao/eternum";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";

import { BuildingType, FRONTIER_TROOP_NAMES, rankName, TroopType, type AspectId } from "@bibliothecadao/types";
import type { AlertsPopupAsk } from "@/shell/profile/alerts-ask";
import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { transferTrainedArmies, TRANSFER_TAPPED } from "@/ui/features/frontier/army/transfer-fixture";
import { TransferTroopsSheet, useSelectedTransfer } from "@/ui/features/frontier/army/transfer-troops";
import { useGame } from "@/hooks/context/game-context";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { homeIcon } from "@/ui/design-system/home-icons";
import { HudIconButton, HudSheet, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { ARMY_MANAGEMENT, EVENTS_WORDS, LINK_WALLET_FOR_LORDS, priceRaised, YOU } from "@/ui/design-system/kit/words";
import { readArmySlots } from "@/ui/features/frontier/hud/army-dock";
import { armyName } from "@/ui/features/frontier/hud/dock-armies";
import { ArmyCard, ArmySlotsCard, LockedSlotLine, OpenSlotCard } from "@/ui/features/frontier/hud/army-row";
import { ArmyToken, OpenSlot } from "@/ui/features/frontier/hud/army-token";
import type { DayClock } from "@/ui/features/frontier/hud/day-clock";
import { HudBands } from "@/ui/features/frontier/hud/hud-bands";
import { FrontierDesktop, FrontierPlaces } from "@/ui/features/frontier/hud/frontier-desktop";
import { PhoneTabBar, type HudSurface } from "@/ui/features/frontier/hud/frontier-nav";
import { TopBarView } from "@/ui/features/frontier/hud/phone-top-bar";
import { RealmCard } from "@/ui/features/frontier/hud/realm-card";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { PLAYER } from "./fixture-game";
import { LabGame, useLabPlayer } from "./lab-game";
import { useHudMode } from "@/hooks/use-hud-mode";
import { HOW_TO_PLAY_BY_MODE } from "@/shell/community";
import { MenuPage } from "@/ui/features/frontier/hud/menu-page";
import { installLabRoom } from "./chat-lab";
import { ChatPage } from "@/ui/features/frontier/hud/chat-page";
import { FrontierFeedLine } from "@/ui/features/frontier/hud/frontier-feed";
import { GLOBAL_ROOM } from "@/ui/features/social/realtime-chat/model/chat-rooms";
import { OrderBar } from "@/ui/features/frontier/hud/order-bar";
import { PickedArmy, type PickedArmyView } from "@/ui/features/frontier/hud/picked-army";
import { DeployView } from "@/ui/features/frontier/deploy/deploy-view";
import { SiteCardView } from "@/ui/features/frontier/sites/site-card-view";
import { AlertsPopupCard } from "@/ui/features/frontier/alerts-popup";
import { DayDoneCard } from "@/ui/features/frontier/rollover/day-done-card";
import type { SharedDay } from "@/shell/share/day-card";
import { DayShareSheet } from "@/ui/features/frontier/rollover/day-share-sheet";
import { DayEndScreen } from "@/ui/features/frontier/rollover/day-end-screen";
import { RESTING, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { BuildView } from "@/ui/features/frontier/build/build-view";
import { buildGroupOf } from "@/ui/features/frontier/build/build-options";
import { CastleResearch, CastleView } from "@/ui/features/frontier/upgrade/castle-view";
import { ArmyDetail } from "@/ui/features/frontier/army/army-panel";
import { MID_REALM, VETERAN_ARMY } from "@/ui/features/frontier/research/progression-fixture";
import { ResearchPanel } from "@/ui/features/frontier/research/research-panel";
import { BuildingCardView, type CardMakes } from "@/ui/features/frontier/building/building-card";
import { buildingIcon, buildingName } from "@/ui/features/frontier/build/building-names";
import { nativeResearchConstants as research, nativeStructureConstants } from "@bibliothecadao/eternum/game-client";
import { type RealmResearchFacts, readResearchTree } from "@/ui/features/frontier/research/research-tree";
import { StoreCard, type StoreLine } from "@/ui/features/frontier/production/store-card";
import { FRONTIER_STORES, STORE_KINDS } from "@/ui/features/frontier/stores";
import { type StoreReading } from "@/ui/features/frontier/hud/status-strip";
import { useParams, useSearchParams } from "react-router-dom";
import { type SlotStart, wheatStopsAt } from "@/ui/features/frontier/deploy/deploy-plan";
import { slotStart } from "@/ui/features/frontier/deploy/slot-start";
import { TodaySheet } from "@/ui/features/frontier/log/today-sheet";
import { SeasonList, type SeasonListRow, type SeasonPodiumPlace } from "@/ui/features/frontier/board/season-list";
import { seasonPodium } from "@/ui/features/frontier/board/season-pool";
import { SeasonDetailSheet } from "@/ui/features/frontier/board/season-detail";
import { SeasonOverRecap } from "@/shell/season-tab/season-over";
import { ARCHIVED_SEASONS, archivedSeason } from "@/shell/season-tab/archive/archive";
import { SeasonPayoutRow } from "@/ui/features/frontier/value/season-payout";
import { linkWalletLine } from "@/ui/features/frontier/value/link-wallet";
import { VisitFoot } from "@/ui/features/frontier/board/visit-foot";
import { useHudLayout } from "@/hooks/helpers/use-compact-hud";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { NewsHeadlineBanner } from "@/ui/features/news-headlines/news-headline-banner";
import { OPENING_MOMENTS, type OpeningMoment } from "@/ui/features/frontier/opening/opening";
import { OPENING_RULES } from "@/ui/features/frontier/opening/opening-fixtures";
import { AspectEmissaryDock } from "@/ui/features/frontier/tutorial/aspect-emissary-dock";
import { toast } from "@/ui/features/event-feed/notify";
import { useEventFeedStore } from "@/ui/features/event-feed/event-feed-store";
import { fragmentsToFill, RefillButton, RefillConfirm, RefillPrice } from "@/ui/features/frontier/army/refill";
import { OathSockets } from "@/ui/features/frontier/army/oath-slots";
import { ShopCodeField, ShopView } from "@/ui/features/frontier/shop/shop-sheet";
import { labQuestRulesFact } from "@/lab/game/quest-scenario";
import { DayPill } from "@/ui/features/frontier/hud/day-pill";
import { DailyQuestChip } from "@/ui/features/frontier/hud/daily-quest-chip";
import type { MapLayers } from "@/ui/features/frontier/hud/map-layers";
import { PlaceSwitch, placeLines } from "@/ui/features/frontier/hud/surface-deep-switch";
import { WithdrawSheet } from "@/ui/features/frontier/value/withdraw-sheet";
import { staminaShortfall } from "@/ui/design-system/kit/reasons";

const HOUR = 3_600;
const NOW = new Date(2026, 9, 7, 14, 26).getTime() / 1000;
/** The lab's season, ended an hour ago, its claim window a week from its end. */
const LAB_SEASON_END = NOW - 3_600;
const LAB_CLAIM_DEADLINE = LAB_SEASON_END + 7 * 86_400;

/** The handoff's fiction: Day 12 at 14:26, today ends at 21:40 (7h 14m left), tomorrow lasts 12h. */
const CLOCK = {
  day: 12,
  endsAt: NOW + 7 * HOUR + 14 * 60,
  secondsLeft: 7 * HOUR + 14 * 60,
  tomorrowSeconds: 12 * HOUR,
  shareLeft: (7 * HOUR + 14 * 60) / (16 * HOUR),
  tone: "calm",
} satisfies DayClock;

/** The season the fiction's Day 12 stands in: its last day the 14th, ending two days after today at 21:40. */
const SEASON_LAST_DAY = 14;
const SEASON_ENDS_AT = CLOCK.endsAt! + 2 * 24 * HOUR;

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
  perHour?: number,
) => ({
  kind,
  amount,
  limit,
  perHour,
  tone,
  flyTarget: `lab-${kind}`,
});

/** A city: 18,000 a store; Essence has no limit. */
const STORES = [
  store("essence", 18_250),
  store("labor", 9_640, 18_000, "calm", 720),
  store("wheat", 4_410, 18_000, "calm", 1_200),
  store("troops", 1_200, 18_000, "calm", 180),
];
/** The realm's Essence short of its Workshops' next tier (8,000), as the top bar and the Workshop's card both read it. */
const SHORT_ESSENCE = 6_800;
const SHORT_ESSENCE_STORES = [store("essence", SHORT_ESSENCE), ...STORES.slice(1)];
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

type LabArmy = { troops?: number; stamina?: number; ethereal?: EtherealLayer };
const ARMIES: LabArmy[] = [
  { troops: 5_000, stamina: 90 },
  { troops: 1, stamina: 150 },
  { troops: 1_200, stamina: 21 },
];
const UNKNOWN_ARMIES: LabArmy[] = [{}, {}, {}];
/** The same armies through the spire: Army 2 in Ethereal II, Army 3 in Ethereal I, Army 1 on the surface. */
const ETHEREAL_ARMIES: LabArmy[] = [ARMIES[0]!, { ...ARMIES[1]!, ethereal: 2 }, { ...ARMIES[2]!, ethereal: 1 }];
/** The lab's explore cost, as its rules say it: a 150 bar is five explores. */
const LAB_EXPLORE = 30;

/** Army 1 (5,000 troops, 90 stamina) explores a new tile, or moves three tiles over known ground. */
const EXPLORE: LabOrder = {
  kind: "explore",
  stamina: { cost: 30, held: 90, wait: undefined },
  wheat: { cost: 100, held: 4_410, wait: undefined },
};
const MOVE: LabOrder = {
  kind: "move",
  stamina: { cost: 30, held: 90, wait: undefined },
  wheat: { cost: 300, held: 4_410, wait: undefined },
};

type LabOrder = {
  kind: "explore" | "move";
  stamina: { cost: number; held: number | undefined; wait: number | undefined };
  wheat: { cost: number; held: number | undefined; wait: number | undefined };
};

/** A deploy order on the state's realm: the troops it asks for, 2 wheat a troop, against the troops and wheat its stores hold. */
type LabDeploy = {
  count: number;
};

const DEPLOY: LabDeploy = { count: 1_000 };

type LabSite = Omit<Parameters<typeof SiteCardView>[0], "onClose" | "onRealm">;

const ARMY_CHIP = { art: "knight-t1" as const, troops: 5_000 };
const ATTACK_30 = { kind: "attack" as const, stamina: 30, onAttack: () => undefined };
/** This attack: the army's losses and the guard it leaves, as its result shows (none left clears the site). */
const FIGHT = (troopsLost: number, guardLeft = 0) => ({ troopsLost, guardLeft });
const CAMP_CARD: LabSite = {
  site: "Camp",
  beast: undefined,
  army: ARMY_CHIP,
  guard: 1_100,
  fight: FIGHT(180),
  pay: { icon: "labor", amount: 550 },
  opensPost: true,
  verb: ATTACK_30,
};
const RUIN_CARD: LabSite = {
  site: "Ruin",
  beast: { name: "Troll", beast: "troll", combatClass: "Knight" },
  army: ARMY_CHIP,
  guard: 3_400,
  fight: FIGHT(1_250, 1_520),
  pay: null,
  verb: ATTACK_30,
};

const WALLET_ADDRESS = "0x04a1d2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f99f3c";
type LabWithdraw = { held: number; amount: number };
const WITHDRAW_500: LabWithdraw = { held: 1_240, amount: 500 };
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
const FINAL_MINUTES: DayClock = { ...CLOCK, secondsLeft: 9 * 60, shareLeft: 9 / 960, tone: "ember" };
const DAY_DONE = {
  endedDay: 12,
  clock: { ...NIGHT, secondsLeft: 7 * HOUR + 55 * 60 },
  gains: { essence: 6_400, labor: 1_150, glory: 1_180 },
  history: "whole" as const,
  stories: [],
  onRetry: () => undefined,
  onShare: () => undefined,
  onContinue: () => undefined,
};

/**
 * The same day 12 as its share card tells it: the day's fights and finds in order (a ruin, two rifts, an army lost, a
 * guard that held, the beasts, a troll camp and a wild chest), its totals and its rank, on the lab's own game.
 */
const DAY_SHARE: SharedDay = {
  player: WALLET_ADDRESS,
  game: { chainId: "0x1", gameId: 1 },
  day: DAY_DONE.endedDay,
  totals: { reveals: 31, cleared: 3, essence: DAY_DONE.gains.essence, labor: DAY_DONE.gains.labor },
  rank: { from: 14, to: 12 },
  trail: ["Ruin", "Rift", "Rift", "army-lost", "guard-holds", "Beasts", "Camp"],
  best: { kind: "clear", site: "Ruin", guard: 3_400, paid: null },
  realm: { name: "Temtinos", order: 5 },
};
/**
 * A thin day, the owner's day 1 on dev's Frontier game 3 (10 November 2026): 38 reveals and one site, a Rift whose guard
 * of 666 fell, paying 4,800 Essence; no rank yet on a season's first day.
 */
const THIN_DAY_SHARE: SharedDay = {
  player: WALLET_ADDRESS,
  game: { chainId: "0x1", gameId: 1 },
  day: 1,
  totals: { reveals: 38, cleared: 1, essence: 5_700, labor: 1_400 },
  rank: null,
  trail: ["guard-holds", "Rift"],
  best: { kind: "clear", site: "Rift", guard: 666, paid: { resource: "essence", amount: 4_800 } },
  realm: { name: "Temtinos", order: 5 },
};

type LabTile = Parameters<typeof BuildView>[0]["tiles"][number];
const tile = (
  category: BuildingType,
  icon: LabTile["icon"],
  name: string,
  gives: LabTile["gives"],
  standing: LabTile["standing"],
): LabTile => ({
  key: String(category),
  group: buildGroupOf(category),
  opensAt: buildingOpensAtLevel(category),
  icon,
  name,
  does: "",
  gives,
  standing,
});
const price = (labor: number, short?: Extract<LabTile["standing"], { kind: "price" }>["short"], raised?: string) =>
  ({ kind: "price", prices: [{ of: "labor", amount: labor, short: short?.of === "labor" }], short, raised }) as const;

const trainingPrice: LabTile["standing"] = {
  kind: "price",
  prices: [
    { of: "essence", amount: 6_000, short: false },
    { of: "labor", amount: 1_500, short: false },
  ],
};
/** A training building's price with the Essence short and the Labor held: only the Essence line is red. */
const SHORT_TILE_PRICES = [
  { of: "essence", amount: 6_000 },
  { of: "labor", amount: 1_500 },
] as const;
const essenceShortPrice: LabTile["standing"] = {
  kind: "price",
  prices: SHORT_TILE_PRICES.map((price) => ({ ...price, short: price.of === "essence" })),
  short: { of: "essence", wait: undefined },
};
const BUILD_SHORT_ESSENCE = 2_400;
const BUILD_SHORT_STORES = STORES.map((held) =>
  held.kind === "essence" ? store("essence", BUILD_SHORT_ESSENCE) : held,
);
const LAB_BUILD_REFUSAL = {
  reason: { kind: "short", of: "essence", held: BUILD_SHORT_ESSENCE, need: SHORT_TILE_PRICES[0].amount },
} as const;
const BUILD_TILES: LabTile[] = [
  tile(BuildingType.ResourceWheat, "farm", "Farm", { icon: "wheat", value: "+6.3/min" }, price(6_800)),
  tile(
    BuildingType.ResourceLabor,
    "workshop",
    "Workshop",
    { icon: "labor", value: "+0.83/min" },

    price(34_000, { of: "labor", wait: 16 * HOUR }, priceRaised("1")),
  ),
  tile(BuildingType.ResourceKnightT1, "barracks", "Barracks", { icon: "troops", value: "+13/min" }, price(6_800)),
  tile(
    BuildingType.SupplyYard,
    "supply-yard",
    buildingName(BuildingType.SupplyYard),
    { icon: "order-skill" },
    trainingPrice,
  ),
];
const SHORT_TILES: LabTile[] = BUILD_TILES.map((card) =>
  card.group === "unique" ? { ...card, standing: essenceShortPrice } : card,
);
const EARLY_TILES: LabTile[] = [
  tile(BuildingType.ResourceWheat, "farm", "Farm", { icon: "wheat", value: "+5/min" }, price(800)),
  tile(BuildingType.ResourceLabor, "workshop", "Workshop", { icon: "labor", value: "+0.83/min" }, price(2_000)),
  tile(BuildingType.ResourceKnightT1, "barracks", "Barracks", { icon: "troops", value: "+1.7/min" }, price(800)),
  tile(
    BuildingType.SupplyYard,
    "supply-yard",
    buildingName(BuildingType.SupplyYard),
    { icon: "order-skill" },
    trainingPrice,
  ),
];
const CASTLE_SIDE = (level: number, wheatStore: number) => ({
  level,
  art: realmMeaning(level),
  plots: [6, 18, 36, 60][level],
  slots: [3, 4, 5, 6][level],
  wheatStore,
  laborStore: nativeStructureConstants.LABOR_STORES[level],
  maxArmySize: [3_000, 9_000, 25_000, 50_000][level],
});

type LabArmySheet = {
  fragments?: number;
  confirm?: boolean;
  stamina?: number;
  ethereal?: EtherealLayer;
};

const WHEAT_LINE: StoreLine = {
  kind: "wheat",
  perHour: 1_500,
  tier: 5,
  held: 4_410,
  limit: 18_000,
  tone: "calm",
  fullIn: 9 * HOUR + 4 * 60,
  noBuilding: false,
  makers: ["9 Farms · +25/min"],
};

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
/** Each realm's rank (Settlement 0 to Empire 3) and depth, the leaders the furthest on. */
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
  realm: { level: SEASON_REALMS[index][0], depth: SEASON_REALMS[index][1] },
  name,
  label: name,
  sitesCleared: SEASON_SITES[index],
  lords: SEASON_LORDS[index],
  own: false,
}));
const labPodium = (): SeasonPodiumPlace[] => {
  const entries = SEASON_NAMES.map((name, index) => ({
    address: name,
    sites_cleared: {
      total: SEASON_SITES[index],
      camps: 0,
      rifts: 0,
      ruins: 0,
      beasts: 0,
    },
  }));
  const prize = { pool: "300", top_n: 3, count: null, awards: [] };
  return seasonPodium({ prize, entries })!.map(({ place, lords, holder }) => ({
    place,
    lords,
    holder: typeof holder === "string" ? holder : { name: holder.address },
  }));
};
/** The player's row, twelfth, then the rest of an 87-realm season: the board holds every place. */
const OWN_ROW: SeasonListRow = {
  key: "you",
  rank: 12,
  order: 12,
  realm: { level: 1, depth: 1 },
  name: YOU,
  label: YOU,
  sitesCleared: 88,
  lords: 192,
  own: true,
};
const SEASON_FIELD: SeasonListRow[] = Array.from({ length: 75 }, (_, index) => {
  const rank = index + 13;
  return {
    key: `lord-${rank}`,
    rank,
    order: (rank % 16) + 1,
    realm: { level: 0, depth: 0 },
    name: `Lord ${rank}`,
    label: `Lord ${rank}`,
    sitesCleared: Math.max(0, 87 - index),
    lords: 0,
    own: false,
  };
});
const SEASON_BOARD = [...SEASON_ROWS, OWN_ROW, ...SEASON_FIELD];
/** The same season with the player first: the eleven named realms a place lower each. */
const SEASON_BOARD_YOU_FIRST = [
  { ...OWN_ROW, rank: 1 },
  ...SEASON_ROWS.map((row) => ({ ...row, rank: row.rank + 1 })),
  ...SEASON_FIELD,
];

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
  fight: FIGHT(180, 740),
  pay: { icon: "wood", amount: 650 },
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
      fight: FIGHT(180),
      pay: { icon: "labor", amount: 550 },
      verb: ATTACK_30,
    },
    loses: {
      ...OWNERS_CAMP,
      army: { art: "knight-t1", troops: 400 },
      fight: FIGHT(400, 1_150),
      verb: ATTACK_30,
    },
  } satisfies Record<string, LabSite>).map(([name, site]) => [
    `fight-${name}`,
    { clock: CLOCK, stores: STORES, armies: ARMIES, site },
  ]),
);

const LAB_FRAGMENTS = 340;

const STATES = {
  ...FIGHT_STATES,
  merge: { clock: CLOCK, stores: STORES, armies: ARMIES, merge: true },
  idle: { clock: CLOCK, stores: STORES, armies: ARMIES },
  // The alerts popup over the map on entering (owner's pick A of reports/push-popup-1.md), and on an iPhone's browser.
  "alerts-popup": { clock: CLOCK, stores: STORES, armies: ARMIES, alertsPopup: "remind" },
  "alerts-popup-install": { clock: CLOCK, stores: STORES, armies: ARMIES, alertsPopup: "install" },
  "armies-open": { clock: CLOCK, stores: STORES, armies: ARMIES.slice(0, 2) },
  "armies-ethereal": { clock: CLOCK, stores: STORES, armies: ETHEREAL_ARMIES },
  "selected-ethereal": { clock: CLOCK, stores: STORES, armies: ETHEREAL_ARMIES, selected: 1, army: { ethereal: 2 } },
  "deploy-slots": { clock: CLOCK, stores: STORES, armies: [], slots: 3, deploy: DEPLOY },
  // An army picked opens its panel, as the game opens it on a selection.
  selected: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, army: {} },
  // A phone's picked army, its card not opened: the row in the dock's place.
  picked: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 1, picked: "owner" },
  full: { clock: CLOCK, stores: FULL_STORES, armies: ARMIES },
  offline: { clock: UNKNOWN_CLOCK, stores: UNKNOWN_STORES, armies: UNKNOWN_ARMIES, offline: true },
  "offline-tutorial": { clock: CLOCK, stores: STORES, armies: ARMIES, offline: true, tutorial: OPENING_MOMENTS[0] },
  menu: { clock: CLOCK, stores: STORES, armies: ARMIES, menu: true },
  chat: { clock: CLOCK, stores: STORES, armies: ARMIES, chat: true },
  empty: { clock: CLOCK, stores: STORES, armies: [] },
  "empire-dock": { clock: CLOCK, stores: STORES, armies: ARMIES, slots: 6 },
  explore: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, order: EXPLORE },
  move: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, order: MOVE },
  deploy: { clock: CLOCK, stores: STORES, armies: ARMIES, deploy: DEPLOY },
  "site-camp": { clock: CLOCK, stores: STORES, armies: ARMIES, site: CAMP_CARD },
  feed: { clock: CLOCK, stores: STORES, armies: ARMIES, feed: true },
  "site-ruin": { clock: CLOCK, stores: STORES, armies: ARMIES, site: RUIN_CARD },
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
  // The owner's desktop card on prod (10-27, "this panel doesnt match at all our new battle panels"): Shadeglow's troll
  // camp, 7.1K knights out of reach of its guard of 1.3K, paying 650 labor and 90 XP. Far as it is, the card forecasts
  // the attack (owner, 31 October 2026: "I should still have the projection even if I'm too far I think").
  "site-shadeglow": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...CAMP_CARD,
      name: "Shadeglow",
      beast: { name: "Troll", beast: "troll", combatClass: "Knight" },
      army: { ...ARMY_CHIP, troops: 7_100 },
      guard: 1_300,
      fight: FIGHT(140),
      pay: { icon: "labor", amount: 650 },
      verb: { kind: "far" },
    },
  },
  // The army's last attack here refused, with no forecast: the same sides, the refusal on the line.
  "site-refused": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...CAMP_CARD,
      fight: { refused: true },
      verb: { ...ATTACK_30, refused: "The army is on battle cooldown" },
    },
  },
  // No army selected: what the site is and pays, its guard beside them (owner, 28 October 2026: "agree with no picker").
  "site-armyless": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...CAMP_CARD, army: null, fight: undefined, verb: null },
  },
  "site-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...CAMP_CARD, verb: { kind: "short", stamina: { cost: 30, held: 10, wait: 40 * 60 } } },
  },
  // After a fight both sides survive: the site's own card with both sides as the attack left them (500 → 432
  // troops, a guard of 334 → 150), and Attack again.
  "fight-goes-on": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...CAMP_CARD,
      site: "Beasts",
      army: { art: ARMY_CHIP.art, troops: 432 },
      guard: 150,
      fight: FIGHT(40),
      pay: null,
    },
  },
  "last-hour": { clock: LAST_HOUR, stores: STORES, armies: ARMIES, lastHour: true },
  // The day's last ten minutes: the day end's line turns red.
  "last-minutes": { clock: FINAL_MINUTES, stores: STORES, armies: ARMIES, lastHour: true },
  "day-done": { clock: NIGHT, stores: STORES, armies: [], dayDone: DAY_DONE },
  "day-share": { clock: NIGHT, stores: STORES, armies: [], dayShare: DAY_SHARE },
  // A thin day, the owner's day 1 on dev: one site, no chest, no rank yet.
  "day-share-thin": { clock: NIGHT, stores: STORES, armies: [], dayShare: THIN_DAY_SHARE },
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
  "build-short": { clock: CLOCK, stores: BUILD_SHORT_STORES, armies: ARMIES, realmView: "build-short" },
  castle: { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "castle" },
  "castle-short": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "castle-short" },
  "building-farm": { clock: CLOCK, stores: STORES, armies: ARMIES, building: "farm" },
  "building-workshop-short": {
    clock: CLOCK,
    stores: SHORT_ESSENCE_STORES,
    armies: ARMIES,
    building: "workshop-short",
  },
  "building-barracks": { clock: CLOCK, stores: STORES, armies: ARMIES, building: "barracks" },
  "building-conscription-camp": { clock: CLOCK, stores: STORES, armies: ARMIES, building: "conscription-camp" },
  "building-rations-depot": { clock: CLOCK, stores: STORES, armies: ARMIES, building: "rations-depot" },
  "building-scouts-lodge": { clock: CLOCK, stores: STORES, armies: ARMIES, building: "scouts-lodge" },
  "army-refill": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { stamina: 20, fragments: LAB_FRAGMENTS, confirm: true },
  },
  "army-refill-ready": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { stamina: 20, fragments: LAB_FRAGMENTS },
  },
  "army-refill-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { stamina: 20, fragments: 0 },
  },
  shop: { clock: CLOCK, stores: STORES, armies: ARMIES, shop: { fragments: LAB_FRAGMENTS, held: false } },
  "shop-ready": { clock: CLOCK, stores: STORES, armies: ARMIES, shop: { fragments: 1_250, held: false } },
  "shop-held": { clock: CLOCK, stores: STORES, armies: ARMIES, shop: { fragments: LAB_FRAGMENTS, held: true } },
  "move-refill": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    refill: LAB_FRAGMENTS,
    order: { ...EXPLORE, stamina: { cost: 30, held: 10, wait: 40 * 60 } },
  },
  stores: { clock: CLOCK, stores: STORES, armies: ARMIES, storeCard: WHEAT_LINE },
  research: { clock: CLOCK, stores: STORES, armies: ARMIES, research: MID_REALM },
  "research-short": { clock: CLOCK, stores: STORES, armies: ARMIES, research: { ...MID_REALM, essence: 717 } },
  // A refused order's notice, through the game's own notice store: on a desktop it stands at the rail's top.
  notice: { clock: CLOCK, stores: STORES, armies: ARMIES, notice: staminaShortfall(10, 30) },
  today: { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today" },
  // Today in the day's last hour, opened from the day end's line.
  "today-last-hour": { clock: LAST_HOUR, stores: STORES, armies: ARMIES, lastHour: true, results: "today" },
  "season-over": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over" },
  "season-over-strong": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over-strong" },
  "season-over-payout": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "over", seasonLords: true },
  "season-over-payout-no-wallet": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    results: "over",
    seasonLords: true,
    noWallet: true,
  },
  season: { clock: CLOCK, stores: STORES, armies: ARMIES, season: "list" },
  "season-detail": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "detail" },
  "season-detail-first": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "detail", seasonFirst: true },
  visiting: { clock: CLOCK, stores: STORES, armies: ARMIES, visiting: true },
  // The owner's phone card on prod (10-27): Runereach's guard of 3,500 against 4,291 knights, an Uncommon chest of 100
  // LORDS, and the stamina short of an attack.
  "site-runereach": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 4_291 },
      guard: 3_500,
      fight: FIGHT(816, 1_650),
      verb: { kind: "short", stamina: { cost: 30, held: 26, wait: 7 * 60 + 38 } },
    },
  },
  // Seven-digit armies on both sides: the fight's figures still fit a 360 px phone.
  "site-large": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 1_284_500 },
      guard: 987_650,
      fight: FIGHT(216_400, 612_300),
    },
  },
  // Twelve-digit sides that lose one troop each: short, both would read alike ("123B → 123B"), so they stay exact and
  // are set smaller to fit.
  "site-alike": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 123_456_789_123 },
      guard: 98_765_432_100,
      fight: FIGHT(1, 98_765_432_099),
    },
  },
  "value-hud": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
  },
  "value-menu": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    menu: true,
  },
  withdraw: { clock: CLOCK, stores: STORES, armies: ARMIES, purse: { lords: 1_240 }, withdraw: WITHDRAW_500 },
} as const;

type LabState = {
  merge?: boolean;
  refill?: number;
  results?: "today" | "over" | "over-strong";
  /** The realm's LORDS waiting for automatic payout. */
  seasonLords?: boolean;
  /** The account has no linked wallet to receive its LORDS: the purse marked, Withdraw and the season's card say so. */
  noWallet?: boolean;
  season?: "list" | "detail";
  /** The player first on the season's board, right under its column names. */
  seasonFirst?: boolean;
  visiting?: boolean;
  /** A notice the client raises (a refused order), as the game's notice store holds it. */
  notice?: string;
  /** Research's page: the tree on the realm some days in. */
  research?: RealmResearchFacts;
  /** The card a store's ring or plate opened. */
  storeCard?: StoreLine;
  army?: LabArmySheet;
  shop?: { fragments: number; held: boolean };
  picked?: "owner";
  realmView?: "build" | "build-early" | "build-short" | "castle" | "castle-short";
  /** A building tapped on the realm's board: its own card. */
  building?: keyof typeof LAB_BUILDINGS;
  dayDone?: Parameters<typeof DayDoneCard>[0];
  /** The day's card to share, as Share your day opens it. */
  dayShare?: SharedDay;
  /** The alerts popup as this device or an iPhone's browser sees it. */
  alertsPopup?: AlertsPopupAsk["kind"];
  lastHour?: boolean;
  order?: LabOrder;
  site?: LabSite;
  /** The Feed's lines for ranked stories beside plain ones, to read their alignment. */
  feed?: boolean;
  deploy?: LabDeploy;
  /** The realm's army slots, where a state draws other than the lab's four. */
  slots?: number;
  clock: DayClock;
  stores: readonly StoreReading[];
  armies: readonly LabArmy[];
  selected?: number;
  offline?: boolean;
  tutorial?: OpeningMoment;
  menu?: boolean;
  /** Chat open: a page on a phone, docked on desktop. Its controls are there to be measured for touch. */
  chat?: boolean;
  purse?: { lords: number; gain?: number };
  withdraw?: LabWithdraw;
};

/** Every state the HUD lab draws, by the name in its address: the HUD room lists them. */
export const HUD_LAB_STATES = Object.keys(STATES);

const SLOTS = 4;
const noop = () => undefined;

export const HudLab = () => {
  const { state = "idle" } = useParams();
  const lab: LabState = STATES[state as keyof typeof STATES] ?? STATES.idle;
  const desktop = useHudLayout() === "desktop";
  // The game wears Frontier's age (world.tsx's useHudMode); the lab draws it the same.
  useHudMode("frontier");
  useLabNotice(lab.notice);
  // The phone's chat page reads the chat lab's room (`?view=messages`, `?view=conversation`), as /lab/kit/chat does.
  const [view] = useSearchParams();
  useState(() => lab.chat && installLabRoom(view.get("view")));
  // The season's detail closes back to its list, and a row opens it again, as FrontierSeason plays it.
  const [detailShut, setDetailShut] = useState(false);
  const chatPane = useRef<HTMLElement>(null);
  const chat = lab.chat && <ChatPage rooms={[GLOBAL_ROOM]} signedIn onSignIn={noop} pane={chatPane} onClose={noop} />;
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
          <TopBarView
            stocks={{ stores: [...lab.stores], realmName: LAB_REALM_NAME, onOpenRealm: noop }}
            clock={<DayPill clock={lab.clock} compact />}
            placeSwitch={<LabPlaceSwitch lab={lab} />}
            quest={<LabDailyQuest />}
            notice={
              lab.tutorial && (
                <AspectEmissaryDock
                  moment={lab.tutorial}
                  rules={OPENING_RULES}
                  layout="phone"
                  status="showing"
                  onDismiss={noop}
                  onSkipAll={noop}
                />
              )
            }
            realmCard={lab.storeCard && <LabRealmCard lab={lab} />}
          />
        }
        page={
          chat && !desktop ? (
            chat
          ) : lab.research ? (
            <LabResearch realm={lab.research} />
          ) : lab.menu ? (
            <MenuPage
              onFeed={noop}
              onShop={noop}
              events={lab.offline ? 0 : 2}
              onToday={noop}
              onSettings={noop}
              guide={HOW_TO_PLAY_BY_MODE.frontier}
              onExit={noop}
              onClose={noop}
            />
          ) : lab.season ? (
            // A realm's detail stands in the list's place, as FrontierSeason shows it.
            lab.season === "detail" && !detailShut ? (
              <SeasonDetailSheet
                label="Aldric"
                detail={{
                  rank: 2,
                  order: 2,

                  sites: { total: 132, camps: 70, rifts: 43, ruins: 9, beasts: 10 },
                  chests: 9,
                  lords: 640,
                  depth: 0,
                  essence: 212_000,
                  labor: 96_000,
                }}
                onVisit={noop}
                onClose={() => setDetailShut(true)}
              />
            ) : (
              <SeasonList
                rank={lab.seasonFirst ? 1 : 12}
                podium={labPodium()}
                rows={lab.seasonFirst ? SEASON_BOARD_YOU_FIRST : SEASON_BOARD}
                state="ready"
                onRetry={noop}
                onOpen={() => setDetailShut(false)}
                onClose={noop}
                ends={{ at: SEASON_ENDS_AT, day: CLOCK.day, lastDay: SEASON_LAST_DAY }}
              />
            )
          ) : undefined
        }
        action={
          <>
            {lab.order && !desktop && (
              <OrderBar
                {...lab.order}
                refill={lab.refill === undefined ? undefined : <RefillButton held={lab.refill} onRefill={noop} />}
                onCancel={noop}
                onGo={noop}
              />
            )}
            {!desktop && !lab.order && lab.selected !== undefined && <LabPicked lab={lab} />}
            {lab.visiting && <VisitFoot label="Aldric" order={2} name="Aldric" arriving={false} onLeave={noop} />}
          </>
        }
        dock={(desktop || !lab.order) && <LabDock lab={lab} />}
        nav={!lab.visiting && <PhoneTabBar {...labPlaces(lab)} />}
      >
        {lab.deploy && <LabDeploySheet deploy={lab.deploy} stores={lab.stores} open={labOpenSlots(lab)} />}
        {lab.results && (
          <LabResults results={lab.results} clock={lab.clock} seasonLords={lab.seasonLords} noWallet={lab.noWallet} />
        )}
        {lab.dayDone && <LabDaySummary card={lab.dayDone} />}
        {lab.dayShare && <DayShareSheet shared={lab.dayShare} onClose={noop} />}
        {lab.alertsPopup && <AlertsPopupCard ask={{ kind: lab.alertsPopup, act: noop, notNow: noop }} />}
        {lab.army && <LabArmy army={lab.army} />}
        {lab.shop && (
          <ShopView
            fragments={lab.shop.fragments}
            pass={lab.shop.held ? { held: true } : { held: false, buying: false, onBuy: noop }}
            questBonus={50}
            bonusHeld={null}
            bar={180}
            code={<ShopCodeField />}
            onGetFragments={noop}
            onClose={noop}
          />
        )}
        {(lab.realmView === "build" || lab.realmView === "build-early" || lab.realmView === "build-short") && (
          <BuildView
            tiles={
              lab.realmView === "build-early"
                ? EARLY_TILES
                : lab.realmView === "build-short"
                  ? SHORT_TILES
                  : BUILD_TILES
            }
            chosen={lab.realmView === "build" ? 0 : lab.realmView === "build-short" ? 3 : 2}
            onChoose={noop}
            prices={
              lab.realmView === "build-short"
                ? SHORT_TILE_PRICES
                : [{ of: "labor", amount: lab.realmView === "build" ? 6_800 : 800 }]
            }
            refusal={lab.realmView === "build-short" ? LAB_BUILD_REFUSAL : undefined}
            sending={false}
            onBuild={noop}
            onClose={noop}
          />
        )}
        {(lab.realmView === "castle" || lab.realmView === "castle-short") && (
          <CastleView
            now={CASTLE_SIDE(1, 18_000)}
            laborRate="+1.7/min"
            research={<LabCastleResearch />}
            upgrade={{
              next: CASTLE_SIDE(2, 50_000),
              prices: [{ of: "labor", amount: 15_000 }],
              refusal:
                lab.realmView === "castle-short"
                  ? { reason: { kind: "short", of: "labor", held: 9_640, need: 15_000, wait: 10 * HOUR + 44 * 60 } }
                  : undefined,
              sending: false,
              onUpgrade: noop,
            }}
            onClose={noop}
          />
        )}
        {lab.building && <LabBuildingCard building={lab.building} />}
        {lab.site && <SiteCardView {...lab.site} onRealm={noop} onClose={noop} />}
        {lab.feed && <LabFeed />}
        {lab.withdraw && <LabWithdrawSheet withdraw={lab.withdraw} />}
      </LabBands>
      {/* The game's one tooltip, as world.tsx mounts it, so a hover line shows here too. */}
      <Tooltip />
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

/** Deploy on the fiction, live: 2 wheat a troop, the realm's open slots, the first chosen until another is pressed. */
const LabDeploySheet = ({
  deploy,
  stores,
  open,
}: {
  deploy: LabDeploy;
  stores: readonly StoreReading[];
  open: SlotStart[];
}) => {
  const [slot, setSlot] = useState<number | null>(null);
  const start = slot === null ? open[0] : open.find((entry) => entry.slot === slot);
  const [count, setCount] = useState(deploy.count);
  const troopsAtHome = stores.find((each) => each.kind === "troops")?.amount ?? 0;
  const wheat = stores.find((each) => each.kind === "wheat")?.amount ?? 0;
  const wheatMax = Math.floor(wheat / 2);
  const most = Math.min(troopsAtHome, wheatMax);
  const wheatStop = wheatStopsAt({ troopsMax: troopsAtHome, wheatMax, max: most }, count);
  return (
    <DeployView
      troopSelection={{
        choices:
          troopsAtHome > 0
            ? [
                {
                  category: TroopType.Knight,
                  name: FRONTIER_TROOP_NAMES[TroopType.Knight].many,
                  art: "knight-t1",
                  atHome: troopsAtHome,
                },
              ]
            : [],
        selected: troopsAtHome > 0 ? TroopType.Knight : undefined,
        onPick: noop,
      }}
      art={troopsAtHome === 0 ? undefined : ("knight-t1" as const)}
      troopsAtHome={troopsAtHome}
      count={count}
      amount={{ most, max: most }}
      onCount={setCount}
      start={start}
      slots={{ open, onPick: setSlot }}
      troopsWait={undefined}
      wheatCost={count * 2}
      tile="open"
      canDeploy={count > 0 && start !== undefined}
      sending={false}
      onDeploy={noop}
      wheatLimit={wheatStop && { ...wheatStop, held: wheat, perTroop: 2, wait: undefined }}
      onGoToRealm={noop}
      onClose={noop}
    />
  );
};

/** A phone's picked army on the fiction, as the action row draws it in the dock's place. */
const LabPicked = ({ lab }: { lab: LabState }) => {
  const { army, fragments } = labPickedArmy(lab);
  return (
    <PickedArmy
      army={army}
      oaths={<OathSockets oaths={[]} slots={2} />}
      refill={<RefillPrice price={fragmentsToFill(army.stamina!)} held={fragments} onRefill={noop} />}
      onDetails={noop}
      onClose={noop}
    />
  );
};

const labPickedArmy = (lab: LabState): { army: PickedArmyView; fragments: number } => {
  const index = lab.selected ?? 0;
  const base = {
    explorerId: index + 1,
    number: index + 1,
    art: "knight-t1" as const,
    ethereal: lab.armies[index]?.ethereal,
  };
  if (lab.picked) {
    const army = {
      ...base,
      label: armyName(TroopType.Knight, 1_342),
      stamina: { current: 14, max: 140, perExplore: 20 },
      secondsToFull: 4 * HOUR + 11 * 60,
    };
    return { army, fragments: 0 };
  }
  const army = lab.armies[index];
  const current = army.stamina ?? 0;
  return {
    army: {
      ...base,
      label: armyName(TroopType.Knight, army.troops ?? 0),
      stamina: { current, max: 150, perExplore: LAB_EXPLORE },
      secondsToFull: (150 - current) * 60,
    },
    fragments: LAB_FRAGMENTS,
  };
};

const LabArmy = ({ army }: { army: LabArmySheet }) => {
  const base = VETERAN_ARMY;
  const stamina = { ...base.stamina, current: army.stamina ?? base.stamina.current };
  const view = { ...base, stamina, ethereal: army.ethereal };
  if (army.confirm)
    return <RefillConfirm stamina={stamina} held={army.fragments} sending={false} onRefill={noop} onCancel={noop} />;
  return (
    <HudSheet label={armyName(TroopType.Knight, base.troops)} onClose={noop}>
      <ArmyDetail army={view} />
      <HudWindowFoot>
        {army.fragments !== undefined && (
          <RefillPrice price={fragmentsToFill(stamina)} held={army.fragments} onRefill={noop} />
        )}
        <HudIconButton icon="trash" label={ARMY_MANAGEMENT.remove} kind="danger" size="sm" onClick={noop} />
      </HudWindowFoot>
    </HudSheet>
  );
};

/**
 * The lab realm's Farms, Barracks, War hall and Scouts' lodge, each as its card shows it: how many stand and what they
 * make; its Workshops with the realm's Essence short of their next tier's price (`essence`, the owner's 27 October card).
 */
const LAB_BUILDINGS = {
  farm: {
    category: BuildingType.ResourceWheat,
    row: research.ROW_FARM,
    standing: 4,
    makes: { icon: "wheat", rate: "+25/min" },
  },
  barracks: {
    category: BuildingType.ResourceKnightT1,
    standing: 3,
    makes: { icon: "troops", rate: "+10/min" },
  },
  "workshop-short": {
    category: BuildingType.ResourceLabor,
    row: research.ROW_WORKSHOP,
    standing: 3,
    makes: { icon: "labor", rate: "+15/min" },
    essence: SHORT_ESSENCE,
  },
  "conscription-camp": {
    category: BuildingType.ConscriptionCamp,
    row: research.ROW_CONSCRIPTION,
    standing: 1,
    tier: 1,
  },
  "rations-depot": { category: BuildingType.RationsDepot, row: research.ROW_RATIONS, standing: 1, tier: 1 },
  "scouts-lodge": { category: BuildingType.ScoutsLodge, standing: 1, makes: undefined },
} satisfies Record<string, LabBuilding>;

type LabBuilding = {
  category: BuildingType;
  row?: number;
  standing: number;
  makes?: CardMakes;
  essence?: number;
  tier?: number;
};

/** A building's card on the realm some days in, its Delete drawn as it rests. */
const LabBuildingCard = ({ building }: { building: keyof typeof LAB_BUILDINGS }) => {
  const { category, row, standing, makes, essence = MID_REALM.essence, tier }: LabBuilding = LAB_BUILDINGS[building];
  const learned =
    row === undefined || tier === undefined ? MID_REALM.learned : { ...MID_REALM.learned, [row]: { tier } };
  const node = readResearchTree({ ...MID_REALM, essence, learned }).find(
    (each) => each.row === row && each.maxTier === 5,
  );
  return (
    <BuildingCardView
      name={buildingName(category)}
      icon={buildingIcon(category)}
      standing={standing}
      makes={makes}
      node={node}
      orders={{
        sending: false,
        fix: () => undefined,
        onResearch: noop,
        demolish: <HudIconButton kind="danger" icon="trash" label="Delete" title="Delete" size="sm" onClick={noop} />,
      }}
      onClose={noop}
    />
  );
};

/** The castle's own research on the realm some days in: the Shrine learned, the Well and the reaches to come. */
const LabCastleResearch = () => (
  <CastleResearch nodes={readResearchTree(MID_REALM).filter(({ branch }) => branch === "castle")} onOpen={noop} />
);

/** Research's page on the realm some days in, as the game opens it: the tree alone, a tile tapped bringing its choice. */
const LabResearch = ({ realm }: { realm: RealmResearchFacts }) => {
  const nodes = readResearchTree(realm);
  const [picked, setPicked] = useState<string | null>(
    () => (nodes.find(({ state }) => state === "ready" || state === "short") ?? nodes[0])?.key ?? null,
  );
  return (
    <ResearchPanel
      nodes={nodes}
      picked={picked}
      onPick={setPicked}
      sending={new Set()}
      fixFor={() => undefined}
      onResearch={noop}
      onClose={noop}
      castleLevel={realm.castleLevel}
    />
  );
};

/**
 * The HUD's slots in the lab as the game composes them: on a phone today's bands; on a desktop the HUD every mode
 * shares (FrontierDesktop) on the lab's game, its top bar, rail and minimap the game's own, Frontier's panels the lab's.
 */
const LabDailyQuest = () => {
  const { setup } = useGame();
  const realm = setup.store.get("Structure", { game_id: 1, entity_id: 7 });
  return realm ? <DailyQuestChip realm={realm} /> : null;
};

const labQuestFacts = () => [labQuestRulesFact()];

const LabPlaceSwitch = ({ lab }: { lab: LabState }) => (
  <PlaceSwitch
    isMapView={lab.realmView === undefined}
    layers={LAB_MAP_LAYERS}
    onGoRealm={noop}
    onGoSurface={noop}
    realm={{ mark: homeIcon("realm", 1) }}
    lines={placeLines(lab.armies)}
  />
);

const LabRealmCard = ({ lab }: { lab: LabState }) => (
  <RealmCard
    name={LAB_REALM_NAME}
    kind="realm"
    level={1}
    rankUp={lab.visiting ? undefined : { name: rankName(2), sending: false, onUpgrade: noop }}
    aspect={LAB_ASPECT}
    orderId={LAB_ORDER_ID}
    stores={everyStore(lab.stores)}
    fragments={LAB_FRAGMENTS}
    lords={lab.visiting ? null : (lab.purse?.lords ?? LAB_LORDS)}
    storeCard={lab.storeCard && <StoreCard line={lab.storeCard} onSpend={noop} onBuild={noop} />}
    onStore={noop}
    onShop={noop}
    onHome={noop}
  />
);

const LabBands = ({
  desktop,
  lab,
  ...slots
}: ComponentProps<typeof HudBands> & { desktop: boolean; lab: LabState }) => (
  <LabGame mode="frontier" facts={labQuestFacts}>
    {() => (
      <>
        {lab.offline && <LabConnectionLost />}
        {desktop ? (
          <FrontierDesktop
            clock={<DayPill clock={lab.clock} />}
            quest={<LabDailyQuest />}
            placeSwitch={
              <PlaceSwitch
                isMapView={lab.realmView === undefined}
                layers={LAB_MAP_LAYERS}
                onGoRealm={noop}
                onGoSurface={noop}
              />
            }
            realm={<LabRealmCard lab={lab} />}
            armies={slots.dock}
            page={slots.page}
            widePage={Boolean(lab.research)}
            foot={
              <>
                {slots.notices}
                {slots.action}
              </>
            }
            places={
              !lab.visiting && <FrontierPlaces surface={labSurface(lab)} onSurface={noop} research={!lab.offline} />
            }
          >
            {slots.children}
          </FrontierDesktop>
        ) : (
          <HudBands {...slots} />
        )}
      </>
    )}
  </LabGame>
);

const LabConnectionLost = () => {
  useEffect(() => {
    useConnectionStore.getState().setGlobalStatus("failed");
    return () => useConnectionStore.getState().setGlobalStatus("connected");
  }, []);
  return <NewsHeadlineBanner headline={null} />;
};

const everyStore = (stores: readonly StoreReading[]): StoreReading[] =>
  STORE_KINDS.map((kind) => stores.find((each) => each.kind === kind) ?? store(kind, 0));

/** The lab realm's name and its LORDS where a state names none, as the desktop's realm panel reads them. */
const LAB_REALM_NAME = "Duskbite";
const LAB_ASPECT: AspectId = 1;
const LAB_ORDER_ID = 12;
const LAB_MAP_LAYERS: MapLayers = { layers: [0, 1], shown: 0, go: noop };
const LAB_LORDS = 320;

/** The place a lab state has open, as the desktop's round places light it. */
const labPlaces = (lab: LabState) => ({
  surface: lab.chat ? ("chat" as const) : lab.menu ? ("menu" as const) : labSurface(lab),
  onSurface: noop,
  researchReady: !lab.offline,
  feedUnread: lab.offline ? 0 : 2,
  chatUnread: lab.offline ? 0 : 3,
});

const labSurface = (lab: LabState): HudSurface | null =>
  lab.season ? "season" : lab.research ? "research" : lab.results === "today" ? "today" : null;

/**
 * The armies on the lab, as ArmyDock draws them: a phone's row of tokens with an open slot for each army still to
 * deploy, or a desktop's list of rows with one Deploy (the header counts the slots).
 */
const LabDock = ({ lab }: { lab: LabState }) => {
  const armyArt = (army: LabArmy) => (army.troops === undefined ? undefined : ("knight-t1" as const));
  const stamina = (army: LabArmy) =>
    army.stamina === undefined ? undefined : { current: army.stamina, max: 150, perExplore: LAB_EXPLORE };
  const limits = useGame().setup.store.get("SliceRules", { game_id: 1 })?.troop_limit_config;
  const slotRule = limits && readArmySlots(limits, lab.armies.length, lab.slots ?? SLOTS);
  if (useHudLayout() === "desktop")
    return (
      <ArmySlotsCard count={slotRule?.count}>
        {lab.armies.map((army, index) => (
          <ArmyCard
            key={index}
            label={armyName(TroopType.Knight, army.troops ?? 0)}
            number={index + 1}
            art={armyArt(army)}
            stamina={stamina(army)}
            ethereal={army.ethereal}
            selected={lab.selected === index}
            onPick={lab.visiting ? undefined : noop}
          />
        ))}
        {labSlots(lab).map((slot, index) => (
          <OpenSlotCard
            key={slot.number}
            number={slot.number}
            primary={index === 0}
            start={slot.start}
            stock={index === 0 ? { count: "1,200", label: `1,200 ${FRONTIER_STORES.troops.word}` } : undefined}
            onDeploy={noop}
          />
        ))}
        {!lab.visiting && slotRule?.nextLocked && <LockedSlotLine {...slotRule.nextLocked} />}
      </ArmySlotsCard>
    );
  return (
    <nav aria-label="Armies" className="pointer-events-auto flex gap-1.5">
      {lab.armies.map((army, index) => (
        <ArmyToken
          key={index}
          label={`Army ${index + 1}`}
          art={armyArt(army)}
          stamina={stamina(army)}
          troops={army.troops}
          ethereal={army.ethereal}
          selected={lab.selected === index}
          onPick={noop}
        />
      ))}
      {labSlots(lab).map((slot) => (
        <OpenSlot key={slot.number} label="Deploy" pulse={slot.pulse} tip={slot.start?.words} onDeploy={noop} />
      ))}
    </nav>
  );
};

/**
 * The lab realm's open slots, as the deploy plan reads them: the first after an army starts on the 60 of 150 stamina it
 * left, a fresh one full. The dock and Deploy read the same.
 */
const labOpenSlots = (lab: LabState): SlotStart[] =>
  Array.from({ length: lab.visiting ? 0 : (lab.slots ?? SLOTS) - lab.armies.length }, (_, index) => {
    const inherited = index === 0 && lab.armies.length > 0;
    return {
      slot: lab.armies.length + index,
      number: lab.armies.length + index + 1,
      inherited,
      start: { current: inherited ? 60 : 150, max: 150, perExplore: LAB_EXPLORE },
    };
  });

/** The open slots as the dock draws them, the first pulsing while no army is out. */
const labSlots = (lab: LabState) =>
  labOpenSlots(lab).map((slot, index) => ({
    number: slot.number,
    pulse: index === 0 && lab.armies.length === 0,
    start: slotStart(slot),
  }));

/** The season the lab's season-over shows: prod's Playtest as its archive holds it, read by its third place. */
const LAB_SEASON = { chainId: ARCHIVED_SEASONS[0]!.chainId, gameId: ARCHIVED_SEASONS[0]!.game_id };
const LAB_SEASON_PLAYER = "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4";

const LabResults = ({
  results,
  clock,
  seasonLords,
  noWallet,
}: {
  results: NonNullable<LabState["results"]>;
  clock: DayClock;
  seasonLords: LabState["seasonLords"];
  noWallet: LabState["noWallet"];
}) =>
  results === "over" || results === "over-strong" ? (
    <SeasonOverRecap
      gameRef={LAB_SEASON}
      game={ARCHIVED_SEASONS[0]}
      board={archivedSeason(LAB_SEASON)!.board}
      viewer={LAB_SEASON_PLAYER}
      ending={results === "over" ? "lifted" : "strong"}
      withdraw={
        seasonLords && (
          <SeasonPayoutRow
            lords={1_240}
            linkWalletLine={noWallet ? linkWalletLine(LAB_CLAIM_DEADLINE, LAB_SEASON_END, NOW) : null}
            onLinkWallet={noop}
          />
        )
      }
      onExit={noop}
    />
  ) : (
    <TodaySheet
      day={12}
      lastDay={SEASON_LAST_DAY}
      clock={clock}
      gains={{ essence: 4_150, labor: 550, glory: 1_180 }}
      onRecap={noop}
      onClose={noop}
    />
  );

/** Withdraw on the fiction: the amount moves with the slider and All. */
const LabWithdrawSheet = ({ withdraw }: { withdraw: LabWithdraw }) => {
  const [amount, setAmount] = useState(withdraw.amount);
  return (
    <WithdrawSheet
      held={withdraw.held}
      wallet={WALLET_ADDRESS}
      linkWalletLine={LINK_WALLET_FOR_LORDS}
      refusal={null}
      step={{ kind: "pick" }}
      amount={amount}
      onAmount={setAmount}
      onWithdraw={noop}
      onLinkWallet={noop}
      onClose={noop}
    />
  );
};

/** The day's summary where the game draws it: over the map at the day's end, in its summary phase. */
function LabDaySummary({ card }: { card: Parameters<typeof DayDoneCard>[0] }) {
  useEffect(() => {
    useDayEndStore.setState({ phase: "summary", arrival: "live", summary: "shown" });
    return () => useDayEndStore.setState(RESTING);
  }, []);
  return <DayEndScreen summary={<DayDoneCard {...card} />} />;
}

const RIVAL = "0x222";

const LabFeed = () => {
  useLabPlayer();
  const [store] = useState(transferTrainedArmies);
  const now = useNowSeconds();
  const told = (
    id: string,
    owner: string,
    minutesAgo: number,
    storyType: string,
    storyPayload: Record<string, unknown>,
  ) =>
    ({
      id,
      event_id: id,
      story: storyType,
      owner,
      participants: [owner],
      tx_hash: `0x${id}`,
      timestamp: String(now - minutesAgo * 60),
      timestampMs: (now - minutesAgo * 60) * 1_000,
      storyPayload,
      presentation: buildStoryEventPresentation(
        { storyType, storyPayload, ownerAddress: owner, viewerAddress: PLAYER, timestamp: now * 1_000 } as never,
        store,
      ),
    }) as unknown as ProcessedStoryEvent;
  const used = (benefit: Record<string, number>) => ({ explorer_id: 201, coord: { x: 3, y: 4 }, benefit });
  const fight = (armyAfter: string, guardAfter: string) => ({
    attacker_id: 201,
    defender_id: 301,
    attacker: { player: PLAYER, category: "Knight", tier: "T1", before: "7000000000000", after: armyAfter, roll: 0 },
    defender: { player: RIVAL, category: "Knight", tier: "T1", before: "1400000000000", after: guardAfter, roll: 0 },
  });
  const stories = [
    told("rival-well", RIVAL, 2, "SiteUsed", used({ Well: 60 })),
    told("won", PLAYER, 6, "BattleEvent", fight("6500000000000", "0")),
    told("spent", PLAYER, 11, "SkillPointSpent", {
      explorer_id: 201,
      choice: "Battle",
      point_rank: 3,
      stamina: 40,
      tier: 2,
    }),
    told("bought", PLAYER, 18, "TierBought", { explorer_id: 201, attribute: "Logistics", tier: 3, price: 400 }),
    told("lost", PLAYER, 25, "BattleEvent", fight("0", "1028000000000")),
    told("shrine", PLAYER, 31, "SiteUsed", used({ ShrinePoint: 3 })),
    ...[38, 46, 55, 63, 72, 84, 97, 110, 125, 140].map((minutesAgo, at) =>
      told(`well-${minutesAgo}`, at % 2 ? PLAYER : RIVAL, minutesAgo, "SiteUsed", used({ Well: 60 })),
    ),
  ];
  return (
    <HudSheet label={EVENTS_WORDS.feed} onClose={noop}>
      <div className="flex flex-col">
        {stories.map((story) => (
          <FrontierFeedLine key={story.id} story={story} />
        ))}
      </div>
    </HudSheet>
  );
};

/** The same transfer selection as the map, on two adjacent armies; this lab never sends a transaction. */
const LabMerge = () => {
  useLabPlayer();
  const [store] = useState(transferTrainedArmies);
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
