import type { EtherealLayer } from "@bibliothecadao/eternum";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import { FeedLine } from "@/ui/features/event-feed/feed-line";

import { BuildingType, FRONTIER_TROOP_NAMES, rankName, TroopType } from "@bibliothecadao/types";
import type { AlertsPopupAsk } from "@/shell/profile/alerts-ask";
import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { transferTrainedArmies, TRANSFER_TAPPED } from "@/ui/features/frontier/army/transfer-fixture";
import { TransferTroopsSheet, useSelectedTransfer } from "@/ui/features/frontier/army/transfer-troops";
import { useGame } from "@/hooks/context/game-context";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { homeIcon } from "@/ui/design-system/home-icons";
import { HudIconButton, HudSheet } from "@/ui/design-system/kit/hud-elements";
import {
  ARMY,
  ARMY_MANAGEMENT,
  DEPLOY_WORDS,
  EVENTS_WORDS,
  LINK_WALLET_FOR_LORDS,
  PAYOUTS_PAUSED,
  type Rank,
  WITHDRAWALS_CLOSED,
  YOU,
} from "@/ui/design-system/kit/words";
import { ArmyCard, ArmyCardDock, OpenSlotCard } from "@/ui/features/frontier/hud/army-row";
import { ArmyToken, OpenSlot } from "@/ui/features/frontier/hud/army-token";
import type { DayClock } from "@/ui/features/frontier/hud/day-clock";
import { HeaderStores } from "@/ui/features/frontier/hud/header-stores";
import { HudBands } from "@/ui/features/frontier/hud/hud-bands";
import { FrontierDesktop, FrontierPlaces } from "@/ui/features/frontier/hud/frontier-desktop";
import { PhoneWorldActions, type HudSurface } from "@/ui/features/frontier/hud/frontier-nav";
import { OfflineBanner } from "@/ui/features/frontier/hud/offline-notice";
import { PhoneTopBarView } from "@/ui/features/frontier/hud/phone-top-bar";
import { RealmHeaderChip } from "@/ui/features/frontier/hud/realm-header-chip";
import { LabGame, useLabPlayer } from "./lab-game";
import { useHudMode } from "@/hooks/use-hud-mode";
import { HOW_TO_PLAY_BY_MODE } from "@/shell/community";
import { MenuPage } from "@/ui/features/frontier/hud/menu-page";
import { installLabRoom } from "./chat-lab";
import { ChatPage } from "@/ui/features/frontier/hud/chat-page";
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
import { CastleResearch, CastleView } from "@/ui/features/frontier/upgrade/castle-view";
import { type ArmyView } from "@/ui/features/frontier/army/army-detail";
import { ArmyDetail } from "@/ui/features/frontier/army/army-panel";
import { MID_REALM, VETERAN_ARMY } from "@/ui/features/frontier/research/progression-fixture";
import { ResearchPanel } from "@/ui/features/frontier/research/research-panel";
import { BuildingCardView, type CardMakes } from "@/ui/features/frontier/building/building-card";
import { buildingIcon, buildingName } from "@/ui/features/frontier/build/building-names";
import { nativeResearchConstants as research, nativeStructureConstants } from "@bibliothecadao/eternum/game-client";
import { readResearchTree } from "@/ui/features/frontier/research/research-tree";
import { StoreCard, type StoreLine } from "@/ui/features/frontier/production/store-card";
import { MADE_STORES } from "@/ui/features/frontier/stores";
import { type StoreReading } from "@/ui/features/frontier/hud/status-strip";
import { useParams, useSearchParams } from "react-router-dom";
import { type SlotStart, wheatStopsAt } from "@/ui/features/frontier/deploy/deploy-plan";
import { slotStartLine } from "@/ui/features/frontier/deploy/slot-start";
import { TodaySheet } from "@/ui/features/frontier/log/today-sheet";
import { ownerDayLog, siteUseDayLog } from "./today-log-fixture";
import { SeasonList, type SeasonListRow, type SeasonPodiumPlace } from "@/ui/features/frontier/board/season-list";
import { seasonPodium } from "@/ui/features/frontier/board/season-pool";
import { SeasonDetailSheet } from "@/ui/features/frontier/board/season-detail";
import { SeasonOverRecap } from "@/shell/season-tab/season-over";
import { ARCHIVED_SEASONS, archivedSeason } from "@/shell/season-tab/archive/archive";
import { SeasonPayoutRow } from "@/ui/features/frontier/value/season-payout";
import { linkWalletLine } from "@/ui/features/frontier/value/link-wallet";
import { VisitFoot } from "@/ui/features/frontier/board/visit-foot";
import { useLayout } from "@/shell/frame/layout";
import { type DayEnd, DayEndBlock, dayEndItems, DayEndNotice } from "@/ui/features/frontier/day-end/day-end";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";
import { useEventFeedStore } from "@/ui/features/event-feed/event-feed-store";
import {
  fragmentsToFill,
  RefillButton,
  RefillConfirm,
  RefillPrice,
  StaminaRefill,
} from "@/ui/features/frontier/army/refill";
import { ShopCodeField, ShopView } from "@/ui/features/frontier/shop/shop-sheet";
import { DayPill } from "@/ui/features/frontier/hud/day-pill";
import { RealmPanel } from "@/ui/features/frontier/hud/realm-panel";
import { type WithdrawStep, WithdrawSheet } from "@/ui/features/frontier/value/withdraw-sheet";
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

/** A deploy order on the state's realm: the troops it asks for, 2 wheat a troop, against the troops and wheat its stores hold. */
type LabDeploy = {
  count: number;
  /** Seconds until the next troop is home; none while nothing makes them. */
  troopsWait?: number;
};

const DEPLOY: LabDeploy = { count: 1_000 };

/** The stores with one of them holding another amount, its limit kept. */
const holding = (stores: readonly StoreReading[], kind: StoreReading["kind"], amount: number) =>
  stores.map((each) => (each.kind === kind ? { ...each, amount } : each));

type LabSite = Omit<Parameters<typeof SiteCardView>[0], "onClose" | "onRealm">;

/** A III Shrine's card (owner, 3 November 2026: "ok for D"): Army 2 holding one III point, Army 1 none. */

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
  verb: ATTACK_30,
};
/** Blightglow Rift as the owner met it on prod (11-03): 794 knights against a rested guard of 1,400. */
const BLIGHTGLOW: LabSite = {
  site: "Rift",
  name: "Blightglow",
  beast: { name: "Wyvern", beast: "wyvern", combatClass: "Knight" },
  army: { art: "knight-t1", troops: 794 },
  guard: 1_400,
  fight: FIGHT(601, 1_033),
  pay: { icon: "essence", amount: 4_200 },
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
type LabWithdraw = { held: number; wallet: string | null; refusal?: string; step: WithdrawStep; amount: number };
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
const FINAL_MINUTES: DayClock = { ...CLOCK, secondsLeft: 9 * 60, shareLeft: 9 / 960, tone: "ember" };
const labDayEnd = (clock: DayClock): DayEnd => ({
  clock,
  items: dayEndItems({ camp: { x: 4, y: 9 }, armyCanExplore: true }),
  run: noop,
});
const UNKNOWN_TOTALS = {
  reveals: undefined,
  cleared: undefined,
  essence: undefined,
  labor: undefined,
};
const DAY_DONE = {
  endedDay: 12,
  clock: { ...NIGHT, secondsLeft: 7 * HOUR + 55 * 60 },
  totals: { reveals: 31, cleared: 3, essence: 6_400, labor: 1_150 },
  best: {
    kind: "clear" as const,
    site: "Ruin" as const,
    guard: 3_400,
    paid: { resource: "essence" as const, amount: 4_800 },
  },
  aspect: 2 as const,
  race: {
    finishHeight: 10_000,
    standings: [
      { aspectId: 2 as const, height: 9_600, own: true },
      { aspectId: 1 as const, height: 6_200, own: false },
      { aspectId: 3 as const, height: 4_100, own: false },
      { aspectId: 4 as const, height: 2_900, own: false },
    ],
  },
  history: "whole" as const,
  onRetry: () => undefined,
  rank: { from: 14, to: 12 },
  armies: 3,
  troopsLost: 6_021,
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
  totals: DAY_DONE.totals,
  rank: DAY_DONE.rank,
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
  key: string,
  icon: LabTile["icon"],
  name: string,
  gives: LabTile["gives"],
  gems: LabTile["gems"],
  standing: LabTile["standing"],
): LabTile => ({ key, icon, name, tip: "", gives, gems, standing });
const gem = (tier: Rank): LabTile["gems"] => [{ tier }];
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
const essenceShortPrice: LabTile["standing"] = {
  kind: "price",
  prices: [
    { of: "essence", amount: 6_000, short: true },
    { of: "labor", amount: 1_500, short: false },
  ],
  short: { of: "essence", wait: undefined },
};
const BUILD_TILES: LabTile[] = [
  tile("farm", "farm", "Farm", { icon: "wheat", value: "+6.3/min" }, gem(2), price(6_800)),
  tile(
    "workshop",
    "workshop",
    "Workshop",
    { icon: "labor", value: "+0.83/min" },
    gem(2),
    price(34_000, { of: "labor", wait: 16 * HOUR }, "Costs more with each one standing: 1"),
  ),
  tile("barracks", "barracks", "Barracks", { icon: "troops", value: "+13/min" }, gem(1), price(6_800)),
  tile("supply", "supply-yard", buildingName(BuildingType.SupplyYard), { icon: "order-skill" }, gem(1), trainingPrice),
];
const SHORT_TILES: LabTile[] = BUILD_TILES.map((card) =>
  card.key === "farm" || card.key === "workshop" || card.key === "barracks"
    ? card
    : { ...card, standing: essenceShortPrice },
);
const EARLY_TILES: LabTile[] = [
  tile("farm", "farm", "Farm", { icon: "wheat", value: "+5/min" }, gem(0), price(800)),
  tile("workshop", "workshop", "Workshop", { icon: "labor", value: "+0.83/min" }, gem(0), price(2_000)),
  tile("barracks", "barracks", "Barracks", { icon: "troops", value: "+1.7/min" }, gem(0), price(800)),
  tile("supply", "supply-yard", buildingName(BuildingType.SupplyYard), { icon: "order-skill" }, gem(1), trainingPrice),
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

/**
 * `owner`: the owner's Army 4 (4 November, the panel he found crowded); `ready` holds a III point. `ethereal`: the army
 * in an Ethereal depth.
 */
type LabArmySheet = {
  fragments?: number;
  confirm?: boolean;
  stamina?: number;
  owner?: "crowded" | "ready";
  ethereal?: EtherealLayer;
};

const line = (overrides: Partial<StoreLine> & Pick<StoreLine, "kind">): StoreLine => ({
  perHour: undefined,
  held: undefined,
  limit: 18_000,
  tone: "calm",
  fullIn: undefined,
  noBuilding: false,
  ...overrides,
});
const STORE_LINES: StoreLine[] = [
  line({
    kind: "wheat",
    perHour: 1_500,
    tier: 5,
    held: 4_410,
    fullIn: 9 * HOUR + 4 * 60,
    makers: ["9 Farms · +25/min"],
  }),
  line({
    kind: "labor",
    perHour: 500,
    tier: 3,
    held: 9_640,
    fullIn: 16 * HOUR + 44 * 60,
  }),
  line({
    kind: "troops",
    perHour: 600,
    held: 1_200,
    fullIn: 28 * HOUR,
  }),
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
/**
 * The lab season's podium, read by the game's own rule (seasonPodium) from a board of the lab's rows: 300 LORDS among
 * the top 3. `final`, the season over and its three winners fixed, the first two paid and the third being awarded;
 * `open`, only the first player has cleared a site, so the other two places stand open.
 */
const labPodium = (season: NonNullable<LabState["season"]>): SeasonPodiumPlace[] | null => {
  if (season === "unpublished") return null;
  const entries = SEASON_NAMES.map((name, index) => ({
    address: name,
    sites_cleared: {
      total: season === "open" && index > 0 ? 0 : SEASON_SITES[index],
      camps: 0,
      rifts: 0,
      ruins: 0,
      beasts: 0,
    },
  }));
  const awards = [
    { rank: 1, address: SEASON_NAMES[0], lords: "150" },
    { rank: 2, address: SEASON_NAMES[1], lords: "100" },
  ];
  const prize =
    season === "final"
      ? { pool: "300", top_n: 3, count: 3, awards }
      : { pool: "300", top_n: 3, count: null, awards: [] };
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
  "today-sites": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today-sites" },
  merge: { clock: CLOCK, stores: STORES, armies: ARMIES, merge: true },
  idle: { clock: CLOCK, stores: STORES, armies: ARMIES },
  // The alerts popup over the map on entering (owner's pick A of reports/push-popup-1.md), and on an iPhone's browser.
  "alerts-popup": { clock: CLOCK, stores: STORES, armies: ARMIES, alertsPopup: "remind" },
  "alerts-popup-install": { clock: CLOCK, stores: STORES, armies: ARMIES, alertsPopup: "install" },
  "armies-open": { clock: CLOCK, stores: STORES, armies: ARMIES.slice(0, 2) },
  // Armies through the spire: each one in an Ethereal layer wears its layer's mark; its panel and a phone's pick too.
  "armies-ethereal": { clock: CLOCK, stores: STORES, armies: ETHEREAL_ARMIES },
  "selected-ethereal": { clock: CLOCK, stores: STORES, armies: ETHEREAL_ARMIES, selected: 1, army: { ethereal: 2 } },
  "picked-ethereal": { clock: CLOCK, stores: STORES, armies: ETHEREAL_ARMIES, selected: 1, picked: "owner" },
  // Deploy's slots as the Armies card draws them: no army out of three, or one, the first open one chosen.
  "deploy-slots": { clock: CLOCK, stores: STORES, armies: [], slots: 3, deploy: DEPLOY },
  "deploy-slots-mix": { clock: CLOCK, stores: STORES, armies: ARMIES.slice(0, 1), slots: 3, deploy: DEPLOY },
  // An army picked opens its panel, as the game opens it on a selection.
  selected: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0, army: {} },
  // A phone's picked army, its card not opened: the row in the dock's place.
  picked: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 1, picked: "owner" },
  "picked-rested": { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 1, picked: "rested" },
  "picked-pay": { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 1, picked: "pay" },
  full: { clock: CLOCK, stores: FULL_STORES, armies: ARMIES },
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
    stores: holding(STORES, "wheat", 2_000),
    armies: ARMIES,
    deploy: DEPLOY,
  },
  "deploy-no-wheat": {
    clock: CLOCK,
    stores: holding(STORES, "wheat", 1),
    armies: ARMIES,
    deploy: { count: 0 },
  },
  "deploy-empty": {
    clock: CLOCK,
    stores: holding(STORES, "troops", 0),
    armies: [],
    deploy: { count: 0 },
  },
  "deploy-empty-making": {
    clock: CLOCK,
    stores: holding(STORES, "troops", 0),
    armies: [],
    deploy: { count: 0, troopsWait: 6 * 60 },
  },
  "site-camp": { clock: CLOCK, stores: STORES, armies: ARMIES, site: CAMP_CARD },
  feed: { clock: CLOCK, stores: STORES, armies: ARMIES, feed: true },
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
    site: { ...CAMP_CARD, site: "Beasts", guard: 400, fight: FIGHT(15), pay: null },
  },
  "site-ruin": { clock: CLOCK, stores: STORES, armies: ARMIES, site: RUIN_CARD },
  // The owner's Titanwatch on 28 October, no army selected: a named ruin, its Ammit, its chest and XP on one row.
  "site-ruin-armyless": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      name: "Titanwatch",
      beast: { name: "Ammit", beast: "ammit", combatClass: "Knight" },
      army: null,
      guard: 2_300,
      fight: undefined,
      verb: null,
    },
  },
  "site-ruin-lose": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 1_200 },
      fight: FIGHT(1_200, 2_300),
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
  // The owner's phone card on prod (11-03): Blightglow Rift's wyvern guard of 1,400, paying 4,200 essence and 93 XP.
  // Rested, the guard strikes at full strength: this attack leaves the army 193 of its 794 and the guard 1,033. It
  // said "Army will be lost" then, of a second attack the card does not send (owner: "the army will be lost shouldnt be
  // shown either ?").
  "site-blightglow": { clock: CLOCK, stores: STORES, armies: ARMIES, site: BLIGHTGLOW },
  // The same guard tired (short of its 40 defense stamina, it strikes at 70%): 793 leave 372, the guard 1,034.
  "site-blightglow-tired": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: { ...BLIGHTGLOW, army: { art: "knight-t1", troops: 793 }, fight: FIGHT(421, 1_034) },
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
  "build-training": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "build-training" },
  "build-early": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "build-early" },
  "build-short": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "build-short" },
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
  "realm-full": { clock: CLOCK, stores: STORES, armies: ARMIES, realmView: "full" },
  // In the realm with its labor store full (audit 10-27): the strip's ring says so.
  "realm-labor-full": { clock: CLOCK, stores: FULL_STORES, armies: ARMIES, realmView: "build" },
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
  "army-full": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { stamina: 170, fragments: LAB_FRAGMENTS },
  },
  "army-crowded": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { fragments: 0, owner: "crowded" },
  },
  "army-crowded-ready": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    army: { fragments: LAB_FRAGMENTS, owner: "ready" },
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
  "move-refill-short": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    selected: 0,
    refill: 0,
    order: { ...EXPLORE, stamina: { cost: 30, held: 10, wait: 40 * 60 } },
  },
  // A store's card, opened from its ring (desktop) or its plate (phone): filling, full, and made by no building.
  stores: { clock: CLOCK, stores: STORES, armies: ARMIES, storeCard: STORE_LINES[0] },
  "stores-full": {
    clock: CLOCK,
    stores: FULL_STORES,
    armies: ARMIES,
    storeCard: { ...STORE_LINES[1], held: 18_000, tone: "ember" },
  },
  // Labor's card filling at 500 an hour: a rate under ten a minute, as a store's rate reads it.
  "stores-labor": { clock: CLOCK, stores: STORES, armies: ARMIES, storeCard: STORE_LINES[1] },
  "stores-empty": {
    clock: CLOCK,
    stores: STORES,
    armies: [],
    storeCard: line({ kind: "troops", perHour: 0, held: 1_500, limit: 6_000, noBuilding: true }),
  },
  research: { clock: CLOCK, stores: STORES, armies: ARMIES, research: true },
  // A refused order's notice, through the game's own notice store: on a desktop it stands at the rail's top.
  notice: { clock: CLOCK, stores: STORES, armies: ARMIES, notice: staminaShortfall(10, 30) },
  today: { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today" },
  // Today in the day's last hour, opened from the day end's line.
  "today-last-hour": { clock: LAST_HOUR, stores: STORES, armies: ARMIES, lastHour: true, results: "today" },
  "today-earlier": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today-earlier" },
  "today-failed": { clock: CLOCK, stores: STORES, armies: ARMIES, results: "today-failed" },
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
  "season-pool-unpublished": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "unpublished" },
  // The season over, its prize's three winners posted; and one where only the leader has cleared a site.
  "season-final": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "final" },
  "season-open": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "open" },
  "season-loading": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "loading" },
  "season-failed": { clock: CLOCK, stores: STORES, armies: ARMIES, season: "failed" },
  visiting: { clock: CLOCK, stores: STORES, armies: ARMIES, visiting: true },
  "site-losing": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    site: {
      ...RUIN_CARD,
      army: { ...ARMY_CHIP, troops: 1_200 },
      fight: FIGHT(1_200, 2_300),
    },
  },
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
  // A Devcon player signed in by email, LORDS in the realm and no wallet linked: the purse marked, its name saying why.
  "purse-no-wallet": {
    clock: CLOCK,
    stores: STORES,
    armies: [],
    purse: { lords: 1_240 },
    noWallet: true,
  },
  "value-hud-claimed": { clock: CLOCK, stores: STORES, armies: ARMIES, purse: { lords: 1_240 } },
  "value-menu": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    menu: true,
  },
  withdraw: { clock: CLOCK, stores: STORES, armies: ARMIES, purse: { lords: 1_240 }, withdraw: WITHDRAW_500 },
  "withdraw-no-wallet": {
    clock: CLOCK,
    stores: STORES,
    armies: ARMIES,
    purse: { lords: 1_240 },
    withdraw: { ...WITHDRAW_500, wallet: null },
    noWallet: true,
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
} as const;

type LabState = {
  merge?: boolean;
  /** The order bar's Refill for its short stamina, the realm's LORDS held against its 140 price (plenty, or short of it). */
  refill?: number;
  results?: "today" | "today-sites" | "today-earlier" | "today-failed" | "over" | "over-strong";
  /** The realm's LORDS waiting for automatic payout. */
  seasonLords?: boolean;
  /** The account has no linked wallet to receive its LORDS: the purse marked, Withdraw and the season's card say so. */
  noWallet?: boolean;
  season?: "list" | "detail" | "unpublished" | "loading" | "failed" | "final" | "open";
  /** The player first on the season's board, right under its column names. */
  seasonFirst?: boolean;
  visiting?: boolean;
  /** A notice the client raises (a refused order), as the game's notice store holds it. */
  notice?: string;
  /** Research's page: the tree on the realm some days in. */
  research?: boolean;
  /** The card a store's ring or plate opened. */
  storeCard?: StoreLine;
  army?: LabArmySheet;
  shop?: { fragments: number; held: boolean };
  /**
   * A phone's picked army: the owner's Army 2 (27 October: 14/140, 100 of 126 LORDS, a level to buy), it rested, or its
   * realm holding 500 LORDS.
   */
  picked?: "owner" | "rested" | "pay";
  realmView?: "build-training" | "build" | "build-early" | "build-short" | "castle" | "castle-short" | "full";
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
  menu?: boolean;
  /** Chat open: a page on a phone, docked on desktop. Its controls are there to be measured for touch. */
  chat?: boolean;
  purse?: { lords: number; gain?: number };
  realm?: { level: number };
  withdraw?: LabWithdraw;
};

/** Every state the HUD lab draws, by the name in its address: the HUD room lists them. */
export const HUD_LAB_STATES = Object.keys(STATES);

const SLOTS = 4;
const noop = () => undefined;

/**
 * Dev only: the Map HUD's states on the lab fixtures, at /lab/kit/hud/<state> (idle, selected, full, offline, menu,
 * empty, explore, move, wheat-short, stamina-short): the components the live HUD draws, on the handoff's fiction.
 */
export const HudLab = () => {
  const { state = "idle" } = useParams();
  const lab: LabState = STATES[state as keyof typeof STATES] ?? STATES.idle;
  const desktop = useLayout() === "desktop";
  // The game wears Frontier's age (world.tsx's useHudMode); the lab draws it the same.
  useHudMode("frontier");
  useLabNotice(lab.notice);
  // The phone's chat page reads the chat lab's room (`?view=messages`, `?view=conversation`), as /lab/kit/chat does.
  const [view] = useSearchParams();
  useState(() => lab.chat && installLabRoom(view.get("view")));
  // The season's detail closes back to its list, and a row opens it again, as FrontierSeason plays it.
  const [detailShut, setDetailShut] = useState(false);
  const chatPane = useRef<HTMLElement>(null);
  // Chat reads the game's players (its mentions), so the phone's page stands in the lab game, as the desktop's does.
  const chat = lab.chat && (
    <LabGame mode="frontier">
      {() => <ChatPage rooms={[GLOBAL_ROOM]} signedIn onSignIn={noop} pane={chatPane} onClose={noop} />}
    </LabGame>
  );
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
          <PhoneTopBarView
            realm={{ icon: homeIcon("realm", lab.realm?.level ?? 1), label: rankName(lab.realm?.level ?? 1) }}
            stores={[...lab.stores]}
            clock={<DayPill clock={lab.clock} />}
            isMapView={lab.realmView === undefined}
            storeCard={lab.storeCard && <StoreCard line={lab.storeCard} onSpend={noop} onBuild={noop} />}
            onOpenRealm={noop}
            onSwitchView={noop}
          />
        }
        page={
          chat && !desktop ? (
            chat
          ) : lab.research ? (
            <LabResearch />
          ) : lab.menu ? (
            <MenuPage
              rank="#12"
              onResearch={noop}
              onFeed={noop}
              onChat={noop}
              onRelics={noop}
              onShop={noop}
              researchReady={!lab.offline}
              events={lab.offline ? 0 : 2}
              chatUnread={lab.offline ? 0 : 3}
              fragments={240}
              onToday={noop}
              onSeason={noop}
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
                podium={labPodium(lab.season)}
                rows={lab.seasonFirst ? SEASON_BOARD_YOU_FIRST : SEASON_BOARD}
                state={lab.season === "loading" || lab.season === "failed" ? lab.season : "ready"}
                onRetry={noop}
                onOpen={() => setDetailShut(false)}
                onClose={noop}
                ends={{ at: SEASON_ENDS_AT, day: CLOCK.day, lastDay: SEASON_LAST_DAY }}
              />
            )
          ) : undefined
        }
        banner={lab.offline ? <OfflineBanner onRetry={noop} /> : undefined}
        notices={!lab.visiting ? <DayEndNotice dayEnd={labDayEnd(lab.clock)} onOpen={noop} /> : undefined}
        action={
          <>
            {lab.order && !desktop && (
              <OrderBar
                {...lab.order}
                revealYield={500}
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
        nav={
          !lab.visiting && (
            <PhoneWorldActions
              surface={
                lab.chat && !desktop
                  ? "chat"
                  : lab.menu
                    ? "menu"
                    : lab.season
                      ? "season"
                      : lab.research
                        ? "research"
                        : null
              }
              onSurface={noop}
              events={lab.offline ? 0 : 2}
              unread={lab.offline ? 0 : 3}
            />
          )
        }
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
        {(lab.realmView === "build" ||
          lab.realmView === "build-early" ||
          lab.realmView === "build-short" ||
          lab.realmView === "build-training") && (
          <BuildView
            tiles={
              lab.realmView === "build-early"
                ? EARLY_TILES
                : lab.realmView === "build-short"
                  ? SHORT_TILES
                  : BUILD_TILES
            }
            chosen={lab.realmView === "build-training" ? 3 : lab.realmView === "build" ? 0 : 2}
            onChoose={noop}
            prices={
              lab.realmView === "build-training"
                ? [
                    { of: "essence", amount: 6_000 },
                    { of: "labor", amount: 1_500 },
                  ]
                : [{ of: "labor", amount: lab.realmView === "build" ? 6_800 : 800 }]
            }
            refusal={undefined}
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
                  name: FRONTIER_TROOP_NAMES[TroopType.Knight],
                  art: "knight-t1",
                  role: DEPLOY_WORDS.troopRoles[TroopType.Knight](),
                  atHome: troopsAtHome,
                  displayCount: count,
                  displayWheat: count * 2,
                  isCustom: count !== most,
                },
              ]
            : [],
        selected: troopsAtHome > 0 ? TroopType.Knight : undefined,
        onPick: noop,
      }}
      art={troopsAtHome === 0 ? undefined : ("knight-t1" as const)}
      troopsAtHome={troopsAtHome}
      count={count}
      isFullStack={count === most}
      allowedSlots={3}
      amount={{ most, max: most, held: most < troopsAtHome ? most : troopsAtHome }}
      onCount={setCount}
      start={start}
      slots={{ open, onPick: setSlot }}
      troopsWait={deploy.troopsWait}
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
      refill={<StaminaRefill stamina={army.stamina!} held={fragments} onRefill={noop} />}
      onDetails={noop}
    />
  );
};

const labPickedArmy = (lab: LabState): { army: PickedArmyView; fragments: number } => {
  const index = lab.selected ?? 0;
  const base = {
    explorerId: index + 1,
    number: index + 1,
    label: `${ARMY} ${index + 1}`,
    art: "knight-t1" as const,
    ethereal: lab.armies[index]?.ethereal,
  };
  if (lab.picked) {
    const rested = lab.picked === "rested";
    const army = {
      ...base,
      troops: 1_342,
      stamina: { current: rested ? 140 : 14, max: 140, perExplore: 20 },
      secondsToFull: rested ? 0 : 4 * HOUR + 11 * 60,
    };
    return { army, fragments: lab.picked === "pay" ? LAB_FRAGMENTS : 0 };
  }
  const army = lab.armies[index];
  const current = army.stamina ?? 0;
  return {
    army: {
      ...base,
      troops: army.troops ?? 0,
      stamina: { current, max: 150, perExplore: LAB_EXPLORE },
      secondsToFull: (150 - current) * 60,
    },
    fragments: LAB_FRAGMENTS,
  };
};

/** The owner's Army 4 (4 November): 4.7K troops, +704 a tile, 17/140 full in 1h 22m. */
const OWNER_ARMY: ArmyView = {
  ...VETERAN_ARMY,
  name: `${ARMY} 4`,
  troops: 4_700,
  stamina: { current: 17, max: 140, perExplore: 20 },
  secondsToFull: 82 * 60,
  revealYield: 704,
};

const LabArmy = ({ army }: { army: LabArmySheet }) => {
  const base = army.owner ? OWNER_ARMY : VETERAN_ARMY;
  const stamina = { ...base.stamina, current: army.stamina ?? base.stamina.current };
  const full = stamina.current >= stamina.max;
  const view = { ...base, stamina, ethereal: army.ethereal, ...(full ? { secondsToFull: 0 } : {}) };
  if (army.confirm)
    return <RefillConfirm stamina={stamina} held={army.fragments} sending={false} onRefill={noop} onCancel={noop} />;
  return (
    <HudSheet
      label={base.name}
      beside={<HudIconButton icon="trash" label={ARMY_MANAGEMENT.remove} kind="danger" size="sm" onClick={noop} />}
      onClose={noop}
    >
      <ArmyDetail
        army={view}
        refill={
          army.fragments === undefined || full ? undefined : (
            <RefillPrice price={fragmentsToFill(stamina)} held={army.fragments} onRefill={noop} />
          )
        }
      />
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
const LabResearch = () => {
  const nodes = readResearchTree(MID_REALM);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <ResearchPanel
      nodes={nodes}
      picked={picked}
      onPick={setPicked}
      sending={new Set()}
      fixFor={() => undefined}
      onResearch={noop}
      onClose={noop}
    />
  );
};

/**
 * The HUD's slots in the lab as the game composes them: on a phone today's bands; on a desktop the HUD every mode
 * shares (FrontierDesktop) on the lab's game, its top bar, rail and minimap the game's own, Frontier's panels the lab's.
 */
const LabBands = ({ desktop, lab, ...slots }: ComponentProps<typeof HudBands> & { desktop: boolean; lab: LabState }) =>
  desktop ? (
    <LabGame mode="frontier">
      {() => (
        <FrontierDesktop
          identity={
            <RealmHeaderChip owner="0x1" name={LAB_REALM_NAME} level={lab.realm?.level ?? 1} expanded onPress={noop} />
          }
          season={{ rank: "#12", onOpen: noop }}
          clock={<DayPill clock={lab.clock} />}
          stores={<HeaderStores stores={lab.stores} showPopoverCard={false} />}
          banner={slots.banner}
          realm={
            <RealmPanel
              name={LAB_REALM_NAME}
              level={lab.realm?.level ?? 1}
              stores={[...lab.stores]}
              onHome={noop}
              onClose={noop}
              {...(!lab.visiting && {
                lords: lab.purse?.lords ?? LAB_LORDS,
                linkWalletLine: lab.noWallet ? LINK_WALLET_FOR_LORDS : null,
                storeCards: lab.storeCard && {
                  kinds: MADE_STORES,
                  open: lab.storeCard.kind,
                  onToggle: noop,
                  card: <StoreCard line={lab.storeCard} onSpend={noop} onBuild={noop} />,
                },
                onWithdraw: noop,
              })}
            />
          }
          armies={slots.dock}
          page={slots.page}
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
      )}
    </LabGame>
  ) : (
    <HudBands {...slots} />
  );

/** The lab realm's name and its LORDS where a state names none, as the desktop's realm panel reads them. */
const LAB_REALM_NAME = "Duskbite";
const LAB_LORDS = 320;

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
  const armyArt = (army: LabArmy) => (army.troops === undefined ? undefined : ("knight-t1" as const));
  const stamina = (army: LabArmy) =>
    army.stamina === undefined ? undefined : { current: army.stamina, max: 150, perExplore: LAB_EXPLORE };
  if (useLayout() === "desktop")
    return (
      <ArmyCardDock>
        {lab.armies.map((army, index) => (
          <ArmyCard
            key={index}
            label={`Army ${index + 1}`}
            number={index + 1}
            art={armyArt(army)}
            stamina={stamina(army)}
            ethereal={army.ethereal}
            selected={lab.selected === index}
            onPick={lab.visiting ? undefined : noop}
          />
        ))}
        {labSlots(lab).map((slot) => (
          <OpenSlotCard key={slot.number} label="Deploy" onDeploy={noop} {...slot} />
        ))}
      </ArmyCardDock>
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
        <OpenSlot key={slot.number} label="Deploy" onDeploy={noop} {...slot} />
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
    start: { bar: slot.start!, words: `${slotStartLine(slot)}.` },
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
      day={results === "today-earlier" ? 11 : 12}
      lastDay={SEASON_LAST_DAY}
      today={results !== "today-earlier"}
      clock={clock}
      totals={{ reveals: 19, cleared: 2, essence: 4_150, labor: 550 }}
      dayEnd={<DayEndBlock dayEnd={labDayEnd(clock)} />}
      lines={results === "today-sites" ? siteUseDayLog(NOW) : readTodayLog()}
      history={results === "today-failed" ? "failed" : "whole"}
      onRetry={noop}
      onShare={results === "today-earlier" ? noop : undefined}
      onEarlier={noop}
      onLater={results === "today-earlier" ? noop : undefined}
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
      linkWalletLine={LINK_WALLET_FOR_LORDS}
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

/** The day's summary where the game draws it: over the map at the day's end, in its summary phase. */
function LabDaySummary({ card }: { card: Parameters<typeof DayDoneCard>[0] }) {
  useEffect(() => {
    useDayEndStore.setState({ phase: "summary", arrival: "live", summary: "shown" });
    return () => useDayEndStore.setState(RESTING);
  }, []);
  return <DayEndScreen summary={<DayDoneCard {...card} />} />;
}

/**
 * The Feed's lines for a point spent, a tier bought and a Shrine used, worded by the game's story formatter, between two
 * plain ones (a Well used, a reveal), so a rank's gem reads against the rows round it.
 */
const LabFeed = () => {
  useLabPlayer();
  const [store] = useState(transferTrainedArmies);
  const told = (id: string, storyType: string, storyPayload: Record<string, unknown>) =>
    ({
      id,
      event_id: id,
      story: storyType,
      owner: "0x111",
      participants: ["0x111"],
      tx_hash: `0x${id}`,
      timestamp: String(NOW),
      timestampMs: NOW * 1_000,
      storyPayload,
      presentation: buildStoryEventPresentation(
        { storyType, storyPayload, ownerAddress: "0x111", viewerAddress: "0x111", timestamp: NOW * 1_000 } as never,
        store,
      ),
    }) as unknown as ProcessedStoryEvent;
  const used = (benefit: Record<string, number>) => ({ explorer_id: 201, coord: { x: 3, y: 4 }, benefit });
  const stories = [
    told("well", "SiteUsed", used({ Well: 60 })),
    told("spent", "SkillPointSpent", { explorer_id: 201, choice: "Battle", point_rank: 3, stamina: 40, tier: 2 }),
    told("bought", "TierBought", { explorer_id: 201, attribute: "Logistics", tier: 3, price: 400 }),
    told("shrine", "SiteUsed", used({ ShrinePoint: 3 })),
    told("well-full", "SiteUsed", used({ Well: 0 })),
  ];
  const feed = (
    <HudSheet label={EVENTS_WORDS.feed} onClose={noop}>
      <div className="flex flex-col">
        {stories.map((story) => (
          <FeedLine key={story.id} story={story} own />
        ))}
      </div>
    </HudSheet>
  );
  // A desktop's HUD already stands in the lab game (its docked chat); a phone's needs one.
  return useLayout() === "desktop" ? (
    feed
  ) : (
    <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: "0x111" } as never}>
      {feed}
    </GameProvider>
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
