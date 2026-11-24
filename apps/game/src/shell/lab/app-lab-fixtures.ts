import type { HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { orderAspect, StructureType } from "@bibliothecadao/types";
import { LORDS_ADDRESS } from "@realms-world/chain";
import { realmsAccountAddress } from "@realms-world/identity/account";
import type { Session, ShareTally } from "@realms-world/identity";

import { orderEmblem } from "@/ui/design-system/kit/order-emblem";
import type { DoorwayRealm } from "@/ui/features/game-entry/doorway/doorway-screen";
import { type DoorwayView, doorwayView } from "@/ui/features/game-entry/doorway/doorway-view";
import { DEVICE_LIMIT_REACHED } from "@/hooks/context/gameplay-account-sync";

import type { DirectoryGame } from "../herald";
import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { ARCHIVED_SEASONS, archivedSeason } from "../season-tab/archive/archive";

import { releaseLine } from "../../../../../packages/core/src/test-support/releases";

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;
const LEFT_TODAY = 7 * 3600 + 14 * 60;

export const LAB_CHAIN = "0x5245414c4d53";

const LAB_WALLET = "0x04a1c0de5eed000000000000000000000000000000000000000000000009c2e";

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
  dev_mode_on: false,
  clock_scale: 1,
  expedition: null,
  clock: {
    start_settling_at: NOW - DAY,
    start_main_at: NOW - DAY,
    scheduled_end_at: NOW + 7 * DAY,
    end_at: NOW + 7 * DAY,
  },
  player_count: 0,
  player_state: {
    registered: false,
    settled: false,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    structures: [],
  },
  registration: null,
  settled_realms_count: 0,
  settled_villages_count: 0,
  settlement: null,
  ...over,
});

const owned = {
  registered: true,
  settled: true,
  held_realm_id: null,
  has_home_source: false,
  taken_realm_ids: [],
  structures: [REALM],
  today_quest: { quest_id: 2, progress: 0, target: 1, labor: 1_500 },
};

/** Frontier's season on Day 12, the player's realm in it or not. */
const frontier = (withRealm: boolean) =>
  game({
    game_id: 1,
    name: "frontier-1",
    // Day 12 (zero-based 11), ending in 7h 14m; tomorrow lasts a day; the third Frontier season on this world.
    day_index: 11,
    day_ends_at: NOW + LEFT_TODAY,
    next_day_length: DAY,
    expedition: { day_unit_seconds: DAY, seed: "7" },
    season_number: 3,
    clock: {
      start_settling_at: NOW - 12 * DAY + LEFT_TODAY,
      start_main_at: NOW - 12 * DAY + LEFT_TODAY,
      scheduled_end_at: NOW + 20 * DAY,
      end_at: NOW + 20 * DAY,
    },
    player_count: 1240,
    aspect_members: { 1: 389, 2: 412, 3: 314, 4: 298 },
    aspect_race: {
      finish_height: 10_000,
      season_days: 50,
      heights: { 1: 6_400, 2: 7_850, 3: 4_100, 4: 2_900 },
    },
    quest_bonus_percent: 50,
    player_state: withRealm ? owned : null,
  });

const endedFrontier = game({
  game_id: 3,
  name: "frontier-0",
  status: "Ended",
  season_number: 1,
  clock: {
    start_settling_at: NOW - 50 * DAY,
    start_main_at: NOW - 50 * DAY,
    scheduled_end_at: NOW - 3600,
    end_at: NOW - 3600,
  },
  player_count: 1240,
  aspect_members: { 1: 389, 2: 412, 3: 314, 4: 298 },
  aspect_race: {
    finish_height: 10_000,
    season_days: 50,
    heights: { 1: 10_000, 2: 8_420, 3: 6_180, 4: 4_910 },
  },
  quest_bonus_percent: 50,
  player_state: owned,
});

const liveTestnet = game({
  game_id: 4,
  name: "testnet-1795479180",
  mode: "frontier",
  status: "Live",
  clock_scale: 1,
  season_number: null,
  day_index: 0,
  day_ends_at: NOW + LEFT_TODAY,
  next_day_length: DAY,
  clock: {
    start_settling_at: NOW - 3600,
    start_main_at: NOW - 3600,
    scheduled_end_at: NOW + 7 * DAY,
    end_at: NOW + 7 * DAY,
  },
  player_count: 142,
  player_state: null,
});

const liveBlitz = (member: boolean) =>
  game({
    game_id: 7,
    name: "blitz-1500-1",
    mode: "blitz",
    clock: {
      start_settling_at: NOW - 3600,
      start_main_at: NOW - 2400,
      scheduled_end_at: NOW + 5040,
      end_at: NOW + 5040,
    },
    player_count: 24,
    player_state: member ? owned : null,
  });
const eternum = game({
  game_id: 9,
  name: "eternum-1",
  mode: "eternum",
  status: "Registration",
  clock: {
    start_settling_at: NOW + 7 * DAY,
    start_main_at: NOW + 7 * DAY,
    scheduled_end_at: NOW + 60 * DAY,
    end_at: NOW + 60 * DAY,
  },
});

/** The same Eternum game open, the player on its roster: Enter. */
const openEternum = game({
  ...eternum,
  status: "Live",
  clock: {
    start_settling_at: NOW - DAY,
    start_main_at: NOW - DAY,
    scheduled_end_at: NOW + 60 * DAY,
    end_at: NOW + 60 * DAY,
  },
  player_state: {
    registered: true,
    settled: false,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    structures: [],
  },
});

/** One state per screen the painted pass draws. */
export const LAB_SCREENS = {
  "first-visit": { signedIn: false, games: [frontier(false), liveBlitz(false), eternum] },
  preseason: { signedIn: false, games: [] },
  "preseason-member": { signedIn: true, games: [] },
  "preseason-chosen": { signedIn: true, games: [] },
  "preseason-sealed": { signedIn: true, games: [] },
  "preseason-invited": { signedIn: false, games: [] },
  "preseason-invited-pick": { signedIn: true, games: [] },
  "preseason-testnet": { signedIn: false, games: [liveTestnet] },
  "preseason-testnet-chosen": { signedIn: true, games: [liveTestnet] },
  fragments: { signedIn: true, games: [] },
  home: { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // Play for a player with the longest name an account takes (packages/identity account-rules), with the install
  // notice: the desktop bar must hold both at its narrowest width.
  "long-name": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // A player with no finished game yet (qa-app-1 P3-9), and a session that has claimed no name (qa-blitz-1 #3).
  "no-games": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // No Blitz anywhere, no slot open and no result left to open: Blitz's column says none is scheduled (live-qa-night-1
  // P3-12: it vanished from Play).
  "no-blitz": { signedIn: true, games: [frontier(true), eternum] },
  // The player's finished Blitz, its results not yet opened, leads Play: no Blitz open and the Frontier season over
  // (audit-1027 play 10: Blitz's column, and the way to the build orders, went with it).
  "blitz-results-lead": { signedIn: true, games: [endedFrontier, eternum] },
  // Only Eternum, not open yet: it leads Play, idle as its column would be, beside an idle Blitz; then open, to enter.
  "eternum-lead": { signedIn: true, games: [eternum] },
  "eternum-open": { signedIn: true, games: [openEternum] },
  unnamed: { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "no-realm": { signedIn: true, games: [frontier(false), liveBlitz(false), eternum] },
  "season-over": { signedIn: true, games: [endedFrontier, liveBlitz(false), eternum] },
  // The same season's Results with a podium of one place (the owner's dev season of 2 November: the player alone and
  // paid) and of two.
  "season-over-one": { signedIn: true, games: [endedFrontier, liveBlitz(false), eternum] },
  "season-over-two": { signedIn: true, games: [endedFrontier, liveBlitz(false), eternum] },
  // No Frontier season listed, the last one settled into the history: production after its first season (10-31).
  "no-season": { signedIn: true, games: [liveBlitz(false), eternum] },
  "wallet-none": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "wallet-ready": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-running": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  // Frontier's season before its prize pool is published.
  "season-unpublished": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "realm-held": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "realm-vault": { signedIn: true, games: [frontier(false), eternum] },
  // Your shared days on You (/profile): what a player's posted Frontier days brought.
  "shared-days": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
} as const;

/** What a screen's account's shared days brought; a screen this names none of has shared no day. */
export const LAB_NO_SHARES: ShareTally = {
  links: 0,
  posted: 0,
  visits: 0,
  joined: 0,
  activated: 0,
  friendsPaid: 0,
  fragmentsEarned: 0,
};
export const LAB_SHARE_TALLIES: Partial<Record<keyof typeof LAB_SCREENS, ShareTally>> = {
  "realm-vault": {
    links: 4,
    posted: 3,
    visits: 180,
    joined: 6,
    activated: 4,
    friendsPaid: 3,
    fragmentsEarned: 300,
  },
  "shared-days": {
    links: 9,
    posted: 7,
    visits: 1_240,
    joined: 31,
    activated: 12,
    friendsPaid: 8,
    fragmentsEarned: 800,
  },
};

/** The Realms the linked wallet holds on each screen that reads them (the relay's held-Realms answer). */
export const LAB_HELD_REALMS: Partial<Record<keyof typeof LAB_SCREENS, { realmId: number; map: null }[]>> = {
  "realm-held": [{ realmId: 4786, map: null }],
  "realm-vault": [538, 4490, 5012, 3, 8, 10, 1].map((realmId) => ({ realmId, map: null })),
};

/** The player's name on each screen whose player is not Maelis. */
export const LAB_NAMES: Partial<Record<keyof typeof LAB_SCREENS, string>> = {
  "long-name": "WWWWWWWWWWWWWWWWWWWW",
  // Identity names a new account by its id until a name is claimed.
  unnamed: LAB_SESSION.user.id,
};

/** The payout wallet linked on each screen's session; a screen not named here has none. */
export const LAB_PAYOUT_WALLETS: Partial<Record<keyof typeof LAB_SCREENS, string>> = {
  "wallet-ready": LAB_WALLET,
  fragments: LAB_WALLET,
  "preseason-member": LAB_WALLET,
  "preseason-chosen": LAB_WALLET,
  "preseason-sealed": LAB_WALLET,
  "preseason-invited-pick": LAB_WALLET,
  "preseason-testnet-chosen": LAB_WALLET,
  "season-running": LAB_WALLET,
  "realm-held": LAB_WALLET,
  "realm-vault": LAB_WALLET,
};

/** The lab's emailed code: this one is right, any other is refused as the identity service refuses it. */
export const LAB_EMAIL_CODE = "111111";

export type LabScreen = keyof typeof LAB_SCREENS;

const PRESEASON_SCREENS: readonly LabScreen[] = [
  "preseason",
  "preseason-member",
  "preseason-chosen",
  "preseason-sealed",
  "preseason-invited",
  "preseason-invited-pick",
  "preseason-testnet",
  "preseason-testnet-chosen",
];
const LAB_ORDER_MEMBERS: Readonly<Record<number, number>> = {
  1: 12,
  9: 9,
  12: 11,
  13: 7,
  2: 6,
  10: 8,
  11: 5,
  16: 5,
  3: 10,
  6: 8,
  14: 7,
  15: 6,
  4: 4,
  5: 4,
  7: 3,
  8: 4,
};
export const labOrderIntent = (screen: LabScreen) => ({
  order:
    screen === "preseason-chosen" || screen === "preseason-sealed" || screen === "preseason-testnet-chosen" ? 1 : null,
  members: LAB_ORDER_MEMBERS,
});
export const LAB_SEAL_CODE = "SEAL2345";
export const LAB_SHARE_CODE = "MRGHT234";
export const LAB_INVITE = { kind: "aspect", moment: 1, name: "Dana", order: 13, members: 39 } as const;
export const labJoinedShare = (screen: LabScreen) =>
  screen === "preseason-invited-pick"
    ? ({ kind: "aspect", chainId: null, gameId: null, moment: LAB_INVITE.moment, name: LAB_INVITE.name } as const)
    : null;
export const labSealCode = (screen: LabScreen) => ({ held: screen === "preseason-sealed" });
export const LAB_FRAGMENT_QUOTE = {
  id: "lab-quote",
  lordsWei: String(2_750n * 10n ** 18n),
  token: LORDS_ADDRESS,
  treasury: "0x7a",
  expiresAt: NOW + 600,
};

const SEASON_ONE_PHASE = (at: (minutes: number) => string) => ({
  phase: "frontier" as const,
  startsAt: at(14 * 24 * 60 + 3 * 60 + 20),
  endsAt: at(64 * 24 * 60),
});

export const labCalendar = (screen: LabScreen) => {
  const at = (minutes: number) => new Date((NOW + minutes * 60) * 1000).toISOString();
  return { phases: PRESEASON_SCREENS.includes(screen) ? [SEASON_ONE_PHASE(at)] : [] };
};

/** The screens whose player has no finished game to open. */
export const LAB_NO_HISTORY_SCREENS: readonly LabScreen[] = [
  "no-games",
  "no-blitz",
  "eternum-lead",
  "eternum-open",
  "preseason",
  "preseason-member",
  "preseason-chosen",
  "preseason-sealed",
  "preseason-invited",
  "preseason-invited-pick",
  "preseason-testnet",
  "preseason-testnet-chosen",
];

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
  // A name as long as a claim takes: a phone's board cuts it with an ellipsis.
  "Rhoswen the Unbowed",
  "Peredur",
];
const rival = (index: number) => `0x${(0xb000 + index).toString(16)}`;

/** Rivals' sites cleared, best first: the painted board's numbers. */
const RIVAL_SITES = [148, 132, 127, 121, 116, 112, 108, 103, 99, 96, 91];
/** Rivals' LORDS, as uneven as prod's Playtest board (none to four figures), so its columns are seen to align. */
const RIVAL_LORDS = [650, 2900, 450, 0, 50, 600, 500, 100, 1000, 0, 25];

/** The fewest players a measured field holds: the painted rivals and the player. */
export const LAB_FIELD_MIN = RIVAL_SITES.length + 1;

/**
 * The lab shard's manifest, listed in the lab's directory when it holds a field, so the shard opens with no read of its
 * own and its Frontier board is read at Herald's path (never reached on the network).
 */
export const LAB_SHARD_MANIFEST = {
  version: 1,
  chainId: LAB_CHAIN,
  releases: releaseLine(nativeFactSchemaIdentity, [1]),
  rpcUrl: "https://rpc.lab.invalid",
  accountClassHash: "0x2",
  contracts: { games: "0x1ab" },
  guardianPublicKey: "0x3",
  l2GasBound: "0x47868c00",
};

/** How many realms the lab's season holds, as prod's live season on 4 November 2026. */
const SEASON_REALMS = 87;

/** The player's place in a field of `realms`: 60th of 87, and the same share of any larger field. */
const ownSeasonPlace = (realms: number) => Math.max(RIVAL_SITES.length + 1, Math.round((realms * 60) / 87));

/**
 * Frontier's board of `realms` realms (87 painted, or a larger field to measure): the eleven painted rivals (one
 * unnamed) first, then the field, each a site behind the one before, none with LORDS yet; the player among them with 42
 * sites, 9 chests and 1,500 LORDS. `read` counts the board's reads so far: each moves the player a site on, as a live
 * board changes between its reads.
 */
export const labFrontierBoard = (realms: number, read = 0): HeraldFrontierLeaderboard => {
  const field = Array.from({ length: realms - RIVAL_SITES.length - 1 }, (_, index) => ({
    address: rival(RIVAL_SITES.length + index),
    sites: Math.max(0, 90 - index),
    chests: Math.max(0, 20 - Math.floor(index / 4)),
    lords: 0,
  }));
  const before = ownSeasonPlace(realms) - RIVAL_SITES.length - 1;
  return {
    game_id: "1",
    mode: "frontier",
    entries: [
      ...RIVAL_SITES.map((sites, index) => ({
        address: rival(index),
        sites,
        chests: 40 - index,
        lords: RIVAL_LORDS[index]!,
      })),
      ...field.slice(0, before),
      { address: LAB_PLAYER, sites: 42 + read, chests: 9, lords: 1500 },
      ...field.slice(before),
    ].map(({ address, sites, chests, lords }, index) => ({
      address,
      structure_id: String(index + 1),
      rank: index + 1,
      sites_cleared: { total: sites, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
      chests_earned: chests,
      rewards: { lords: String(lords), essence: "0", labor: "0" },
      deepest_depth: 2,
      level: Math.max(0, Math.min(3, Math.floor((12 - index) / 4))),
      order: (index % 16) + 1,
    })),
    // The dev pool: 300 LORDS among the top 3, the winners not posted while the season runs.
    prize: { pool: "300", top_n: 3, count: null, awards: [] },
  };
};

/** Frontier's painted board: 87 realms, the player 60th. */
export const LAB_FRONTIER_BOARD = labFrontierBoard(SEASON_REALMS);

/**
 * The same board once the season is over and its three winners are fixed (the Results' podium): first and second paid,
 * their receipts naming them, third still being awarded.
 */
export const LAB_FRONTIER_FINAL_BOARD: HeraldFrontierLeaderboard = {
  ...LAB_FRONTIER_BOARD,
  game_id: "3",
  prize: {
    pool: "300",
    top_n: 3,
    count: 3,
    awards: [
      { rank: 1, address: LAB_FRONTIER_BOARD.entries[0]!.address, lords: "150" },
      { rank: 2, address: LAB_FRONTIER_BOARD.entries[1]!.address, lords: "100" },
    ],
  },
};

/**
 * A final board of the first rivals and the player after them, every place paid out of the 300 LORDS: a podium of fewer
 * than three places.
 */
const shortFinalBoard = (rivals: number, lords: string[]): HeraldFrontierLeaderboard => {
  const player = LAB_FRONTIER_BOARD.entries.find((entry) => entry.address === LAB_PLAYER)!;
  const entries = [...LAB_FRONTIER_BOARD.entries.slice(0, rivals), player].map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
  const awards = entries.map(({ rank, address }, index) => ({ rank, address, lords: lords[index]! }));
  return {
    ...LAB_FRONTIER_FINAL_BOARD,
    entries,
    prize: { pool: "300", top_n: entries.length, count: entries.length, awards },
  };
};

/** The final board each Results screen reads for the ended season: its whole board, or one cut to one or two places. */
export const LAB_FINAL_BOARDS: Partial<Record<keyof typeof LAB_SCREENS, HeraldFrontierLeaderboard>> = {
  "season-over-one": shortFinalBoard(0, ["300"]),
  "season-over-two": shortFinalBoard(1, ["200", "100"]),
};

/** Production's first season's top twelve, by their public names, in its archived board's order. */
const SEASON_ONE_NAMES = [
  "Volcanic",
  "djizus",
  "Canzi",
  "Nexonik",
  "Krump",
  "bal7hazar",
  "FOCGIE",
  "yang",
  "dudendy",
  "Astavn",
  "TsuAurym",
  "Loaf",
];
const [SEASON_ONE] = ARCHIVED_SEASONS;
const SEASON_ONE_ENTRIES = archivedSeason({ chainId: SEASON_ONE!.chainId, gameId: SEASON_ONE!.game_id })!.board.entries;

/** Devcon's Season 0 as the directory lists it once over (Fri 6 Nov 18:00Z), drawn over prod's Playtest board. */
export const LAB_DEVCON_SEASON_0 = {
  ...SEASON_ONE!,
  game_id: 990,
  season_number: 0,
  clock: { ...SEASON_ONE!.clock, end_at: Date.UTC(2026, 10, 6, 18) / 1000 },
};

/** The board before any prize pool is published (the Season tab's podium says so). */
export const LAB_FRONTIER_UNPUBLISHED_BOARD: HeraldFrontierLeaderboard = { ...LAB_FRONTIER_BOARD, prize: null };

/** Names for the rivals the identity Worker would serve; the unnamed one reads "Lord" and its last four. */
export const LAB_PROFILES = Object.fromEntries([
  ...NAMES.map((name, index) => [rival(index), { name, portrait: `0${(index % 9) + 1}` }]),
  ...SEASON_ONE_NAMES.map((name, index) => [
    SEASON_ONE_ENTRIES[index]!.address,
    { name, portrait: `0${(index % 9) + 1}` },
  ]),
]);

export const LAB_FINISHED_BLITZ = {
  ...liveBlitz(true),
  game_id: 7,
  status: "Settled" as const,
  shardUrl: "https://lab",
};

const SEAT_NAMES = ["Ysabeau", "Aldric", "Corwin", "Tybalt", "Isolde", "Brannoc", "Caradoc", "Gwenllian", "Osric"];
export const LAB_SEAT_PROFILES = Object.fromEntries(
  SEAT_NAMES.map((name, position) => [
    `0x${(0xa000 + position).toString(16)}`,
    { name, portrait: `0${(position % 9) + 1}` },
  ]),
);

/** A chat player's Realms id: chat names its players by it. */
const chatPlayerId = (name: string) => `0x${(100 + SEAT_NAMES.indexOf(name)).toString(16)}`;

/**
 * The chat players' profiles, keyed as identity keys them: by each one's account on our shards, which our guardian
 * places by their Realms id. Each chose a portrait, so chat is seen to draw the one identity holds.
 */
export const LAB_CHAT_PROFILES = new Map(
  SEAT_NAMES.map((name, position) => [
    BigInt(realmsAccountAddress(chatPlayerId(name), LAB_GUARDIAN.accountClassHash, LAB_GUARDIAN.publicKey)),
    { name, portrait: `0${((position + 4) % 9) + 1}` },
  ]),
);

export const LAB_GLOBAL_CHAT = [
  ["Isolde", "anyone pushing Deep sites tonight?"],
  ["Corwin", "frontier day 12, the spire is open"],
  ["Aldric", "gg everyone, see you on the next day"],
].map(([name, content], index) => ({
  id: `lab-global-${index}`,
  sender: { playerId: chatPlayerId(name), displayName: name },
  zoneId: "world:global",
  content,
  createdAt: new Date((NOW - 900 + index * 120) * 1000).toISOString(),
}));

/**
 * A new account at its one step (sign-in's name and portrait): the Discord name suggested at sign-up, which passes the
 * rule, or one too short to, so the field is drawn refused; or an email sign-up, suggested nothing.
 */
export const LAB_NEW_ACCOUNTS = {
  name: { ...LAB_SESSION, user: { ...LAB_SESSION.user, name: null, suggestedName: "Maelis" } },
  "name-refused": { ...LAB_SESSION, user: { ...LAB_SESSION.user, name: null, suggestedName: "Ma" } },
  "name-email": { ...LAB_SESSION, user: { ...LAB_SESSION.user, name: null, suggestedName: null } },
} as unknown as Record<"name" | "name-refused" | "name-email", Session>;

/** The sign-in mail the code step names. */
export const LAB_SIGN_IN_EMAIL = LAB_SESSION.user.email;

/** When the lab's emailed code stops working: five minutes on, as the identity Worker gives it. */
export const labCodeExpiry = () => Math.floor(Date.now() / 1000) + 300;

/** How long the lab's awaited season is from starting: two hours, so the doorway's chip reads its clock time and the wait. */
export const LAB_SEASON_WAIT = 2 * 3600 + 4 * 60;

/**
 * The doorway into Frontier: the map booting under the player's realm, the entry held for a sign-in before the realm
 * is known, and the realm step with the entry's own chip: the season's start awaited, a Blitz roster filling.
 */
export const LAB_DOORWAYS = {
  map: {
    view: doorwayView({ source: "boot", phase: "wait_worldmap_ready", audience: "player", modelShare: 0.57 }),
    realm: { name: "Stolsli", emblem: orderEmblem(2), aspect: orderAspect(2) },
  },
  spectator: {
    view: doorwayView({ source: "boot", phase: "wait_worldmap_ready", audience: "spectator", modelShare: 0.62 }),
    realm: { name: "Stolsli", emblem: orderEmblem(2), aspect: orderAspect(2) },
  },
  "sign-in": {
    view: doorwayView({ source: "entry", phase: "account", audience: "player", signedIn: false }),
    realm: null,
  },
  waiting: {
    view: doorwayView({ source: "entry", phase: "settlement-waiting", audience: "player", signedIn: true }),
    realm: null,
  },
  preparing: {
    view: doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }),
    realm: null,
  },
  "map-failed": {
    view: doorwayView({ source: "boot", phase: "error", audience: "player", failedScene: "map", realmCanOpen: true }),
    realm: { name: "Stolsli", emblem: orderEmblem(1) },
  },
  devices: {
    view: doorwayView({
      source: "boot",
      phase: "reconnect_required",
      audience: "player",
      accountError: DEVICE_LIMIT_REACHED,
    }),
    realm: null,
  },
  ended: {
    view: doorwayView({ source: "boot", phase: "ready", audience: "player", ended: true }),
    realm: null,
  },
  // The Realm step: choose your home, then Create your realm.
  home: {
    view: doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }),
    realm: null,
  },
  aspect: {
    view: doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }),
    realm: null,
  },
  "aspect-realm": {
    view: doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }),
    realm: null,
  },
  "aspect-kept": {
    view: doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }),
    realm: null,
  },
  "realm-side": {
    view: doorwayView({ source: "entry", phase: "settlement", audience: "player", signedIn: true }),
    realm: null,
  },
} satisfies Record<string, { view: DoorwayView; realm: DoorwayRealm | null }>;
