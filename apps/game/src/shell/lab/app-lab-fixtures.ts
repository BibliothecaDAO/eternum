import type { HeraldFrontierLeaderboard, HeraldLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { StructureType } from "@bibliothecadao/types";
import { realmsAccountAddress } from "@realms-world/identity/account";
import type { Session } from "@realms-world/identity";

import type { DirectoryGame } from "../herald";

/**
 * The app lab's one fiction, the handoff's: Day 12 of a Frontier season, today ends with 7h 14m left, the player
 * (Maelis) ranks 12th of 1,240 with a realm; a Blitz fills for 16:30 with 17 of 24 seats, another is live; Eternum
 * opens in a week; Dominion waits. Nothing here reaches a shard.
 */
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;
const LEFT_TODAY = 7 * 3600 + 14 * 60;

export const LAB_CHAIN = "0x5245414c4d53";
export const LAB_GUARDIAN = { publicKey: "0x1a2b", accountClassHash: "0x3c4d" };
const REALMS_ID = "0x7";
export const LAB_PLAYER = realmsAccountAddress(REALMS_ID, LAB_GUARDIAN.accountClassHash, LAB_GUARDIAN.publicKey);

export const LAB_SESSION: Session = {
  session: { id: "lab", expiresAt: "2099-01-01T00:00:00.000Z", userId: "lab" },
  user: {
    id: "lab",
    realmsId: REALMS_ID,
    name: "Maelis",
    email: "maelis@realms.test",
    image: "04",
    emailVerified: true,
  },
} as unknown as Session;

const REALM = {
  entity_id: 1,
  category: StructureType.Realm,
  level: 1,
  realm_id: 3098,
  coord_x: null,
  coord_y: null,
  resources_packed: "0",
};

const game = (over: Partial<DirectoryGame>): DirectoryGame => ({
  chainId: LAB_CHAIN,
  game_id: 1,
  name: "frontier-1",
  mode: "frontier",
  status: "Live",
  ready: true,
  dev_mode_on: false,
  expedition: null,
  clock: { start_settling_at: NOW - DAY, start_main_at: NOW - DAY, end_at: NOW + 7 * DAY, end_grace_seconds: 0 },
  player_count: 0,
  player_state: { registered: false, settled: false, roster_member: false, structures: [] },
  roster_count: 0,
  preset_id: 0,
  registration: null,
  settled_realms_count: 0,
  settled_villages_count: 0,
  settlement: null,
  ...over,
});

const owned = { registered: true, settled: true, roster_member: true, structures: [REALM] };

/** Frontier's season on Day 12, the player's realm in it or not. */
const frontier = (withRealm: boolean) =>
  game({
    game_id: 1,
    name: "frontier-1",
    // Day 12 (zero-based 11), ending in 7h 14m; tomorrow lasts a day; the third Frontier season on this world.
    day_index: 11,
    day_ends_at: NOW + LEFT_TODAY,
    next_day_length: DAY,
    season_number: 3,
    clock: {
      start_settling_at: NOW - 12 * DAY + LEFT_TODAY,
      start_main_at: NOW - 12 * DAY + LEFT_TODAY,
      end_at: NOW + 20 * DAY,
      end_grace_seconds: 0,
    },
    player_count: 1240,
    player_state: withRealm ? owned : null,
  });

const endedFrontier = game({
  game_id: 3,
  name: "frontier-0",
  status: "Ended",
  player_count: 1240,
  player_state: owned,
});
const liveBlitz = (member: boolean) =>
  game({
    game_id: 7,
    name: "blitz-1500-1",
    mode: "blitz",
    clock: { start_settling_at: NOW - 3600, start_main_at: NOW - 2400, end_at: NOW + 5040, end_grace_seconds: 0 },
    player_count: 24,
    roster_count: 24,
    player_state: member ? owned : null,
  });
const eternum = game({
  game_id: 9,
  name: "eternum-1",
  mode: "eternum",
  status: "Registration",
  ready: false,
  clock: {
    start_settling_at: NOW + 7 * DAY,
    start_main_at: NOW + 7 * DAY,
    end_at: NOW + 60 * DAY,
    end_grace_seconds: 0,
  },
});

/** One state per screen the painted pass draws. */
export const LAB_SCREENS = {
  "first-visit": { signedIn: false, joined: false, games: [frontier(false), liveBlitz(false), eternum] },
  home: { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "no-realm": { signedIn: true, joined: false, games: [frontier(false), liveBlitz(false), eternum] },
  "blitz-seat": { signedIn: true, joined: false, games: [frontier(true), liveBlitz(true), eternum] },
  "season-over": { signedIn: true, joined: false, games: [endedFrontier, liveBlitz(false), eternum] },
} as const;

export type LabScreen = keyof typeof LAB_SCREENS;

/** A slot filling for 16:30, two hours away, with 17 of 24 seats taken; the player's among them when joined. */
export const labSlots = (joined: boolean) => ({
  slots: [
    {
      name: "blitz-1630",
      closesAt: new Date((NOW + 2 * 3600 + 4 * 60) * 1000).toISOString(),
      frozenAt: null,
      closed: false,
      registrations: Array.from({ length: 17 }, (_, position) => ({
        realmsId: joined && position === 16 ? REALMS_ID : `0x${(100 + position).toString(16)}`,
        account: `0x${(0xa000 + position).toString(16)}`,
        position,
        gameNumber: null,
      })),
    },
  ],
});

const NAMES = [
  "Ysabeau",
  "Aldric",
  "Corwin",
  "Tybalt",
  "Isolde",
  "Brannoc",
  null,
  "Gwenllian",
  "Osric",
  "Rhoswen",
  "Peredur",
];
const rival = (index: number) => `0x${(0xb000 + index).toString(16)}`;

/** Rivals' sites cleared, best first: the painted board's numbers. */
const RIVAL_SITES = [148, 132, 127, 121, 116, 112, 108, 103, 99, 96, 91];

/** Frontier's board: eleven rivals (one unnamed) and the player twelfth with 88 sites, 31 chests and 1,500 LORDS. */
export const LAB_FRONTIER_BOARD: HeraldFrontierLeaderboard = {
  game_id: "1",
  mode: "frontier",
  entries: [
    ...RIVAL_SITES.map((sites, index) => ({
      address: rival(index),
      sites,
      chests: 40 - index,
      lords: 2900 - index * 120,
    })),
    { address: LAB_PLAYER, sites: 88, chests: 31, lords: 1500 },
  ].map(({ address, sites, chests, lords }, index) => ({
    address,
    structure_id: String(index + 1),
    rank: index + 1,
    sites_cleared: { total: sites, camps: 0, rifts: 0, ruins: 0, stragglers: 0 },
    chests_earned: chests,
    rewards: { lords: String(lords), essence: "0", labor: "0" },
    deepest_depth: 2,
    order: (index % 16) + 1,
  })),
};

/** A finished Blitz: the player third of 24. */
export const LAB_BLITZ_BOARD: HeraldLeaderboard = {
  game_id: "7",
  mode: "points",
  entries: [rival(1), rival(0), LAB_PLAYER, rival(2), rival(3)].map((address, index) => ({
    address,
    rank: index + 1,
    totalPoints: 412 - index * 30,
  })),
} as unknown as HeraldLeaderboard;

/** Names for the rivals the identity Worker would serve; the unnamed one reads "Lord" and its last four. */
export const LAB_PROFILES = Object.fromEntries(
  NAMES.map((name, index) => [rival(index), { name, portrait: `0${(index % 9) + 1}` }]),
);

export const LAB_FINISHED_BLITZ = {
  ...liveBlitz(true),
  game_id: 7,
  status: "Settled" as const,
  shardUrl: "https://lab",
};

/**
 * The Blitz rating's top six and the player 41st of 1,240 (/api/ratings/top). The rows are L2 wallets, which the
 * identity Worker names for no one yet, so they read "Lord" and their last four as they would live.
 */
export const LAB_RATING_TOP = {
  block_number: 812_345,
  block_hash: "0x5ea1",
  total: 1240,
  entries: ["2480", "2210", "2050", "1960", "1880", "1820"].map((rating, index) => ({
    rank: index + 1,
    player: `0x${(0xe000 + index).toString(16)}`,
    rating,
  })),
  self: { status: "rated" as const, player: "0xe0f1", rating: "1744", rank: 41 },
};
