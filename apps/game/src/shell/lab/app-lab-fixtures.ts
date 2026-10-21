import type { HeraldFrontierLeaderboard, HeraldLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { StructureType } from "@bibliothecadao/types";
import { realmsAccountAddress } from "@realms-world/identity/account";
import type { Session } from "@realms-world/identity";

import { orderEmblem } from "@/ui/design-system/kit/order-emblem";
import type { DoorwayRealm } from "@/ui/features/game-entry/doorway/doorway-screen";
import { type DoorwayView, doorwayView } from "@/ui/features/game-entry/doorway/doorway-view";
import { DEVICE_LIMIT_REACHED } from "@/hooks/context/gameplay-account-sync";

import type { DirectoryGame } from "../herald";

import type { EntryTerms } from "../blitz/entry";
import type { SlotKey } from "../value/ledger";
import type { PlayedGameKeys } from "../season-tab/reward";
import type { SeasonPrize } from "../season-tab/blitz-season";
import type { Reward } from "../season-tab/reward";

/**
 * The app lab's one fiction, the handoff's: Day 12 of a Frontier season, today ends with 7h 14m left, the player
 * (Maelis) ranks 12th of 1,240 with a realm; a Blitz slot takes entries until 16:30 with 31 registered, another Blitz is live; Eternum
 * opens in a week; Dominion waits. Nothing here reaches a shard.
 */
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;
const LEFT_TODAY = 7 * 3600 + 14 * 60;

export const LAB_CHAIN = "0x5245414c4d53";

/** The lab's payout wallet, which also holds its Blitz seat. */
export const LAB_WALLET = "0x04a1c0de5eed000000000000000000000000000000000000000000000009c2e";

/** The slot the lab's Blitz is registered in, and the game it filled, on the environment's ledger. */
export const LAB_SLOT_KEY: SlotKey = { shard: LAB_CHAIN, slotId: 3 };
export const LAB_GAME_KEYS: PlayedGameKeys = { game: { shard: LAB_CHAIN, gameId: 7 }, slot: LAB_SLOT_KEY };

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
  player_state: { registered: false, settled: false, roster_wallet: null, structures: [] },
  roster_count: 0,
  preset_id: 0,
  registration: null,
  settled_realms_count: 0,
  settled_villages_count: 0,
  settlement: null,
  ...over,
});

const owned = { registered: true, settled: true, roster_wallet: LAB_WALLET, structures: [REALM] };

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
    slotId: LAB_SLOT_KEY.slotId,
  });
/** A seat on a Blitz roster whose game is still being prepared: it opens in two hours, the player's realm not ready yet. */
const preparingBlitz = game({
  game_id: 8,
  name: "blitz-1900-1",
  mode: "blitz",
  status: "Registration",
  ready: false,
  clock: { start_settling_at: NOW + 3600, start_main_at: NOW + 7200, end_at: NOW + 14_400, end_grace_seconds: 0 },
  player_count: 18,
  roster_count: 24,
  player_state: { registered: true, settled: false, roster_wallet: LAB_WALLET, structures: [] },
  slotId: LAB_SLOT_KEY.slotId,
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
  "first-visit": { signedIn: false, games: [frontier(false), liveBlitz(false), eternum] },
  home: { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // Play for a player with the longest name an account takes (packages/identity account-rules), with the install
  // notice: the desktop bar must hold both at its narrowest width.
  "long-name": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // A player with no finished game yet (qa-app-1 P3-9), and a session that has claimed no name (qa-blitz-1 #3).
  "no-games": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // No Blitz anywhere, no slot open and no result left to open: Blitz's column says none is scheduled (live-qa-night-1
  // P3-12: it vanished from Play).
  "no-blitz": { signedIn: true, games: [frontier(true), eternum] },
  // No Blitz open, the calendar's next ranked game due: its column shows the start and when entry opens (the owner's
  // 10:08, before the 12:00 game's entry opens at 10:25).
  "blitz-next": { signedIn: true, games: [frontier(true), eternum] },
  unnamed: { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "no-realm": { signedIn: true, games: [frontier(false), liveBlitz(false), eternum] },
  "blitz-seat": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  // The seat's Blitz leads, and the next slot's entry closes hours away: its row reads the longer clock QA met on dev
  // ("Entry closes 12:55 · 10h 46m left"), which wraps on a phone.
  "blitz-seat-late-slot": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-over": { signedIn: true, games: [endedFrontier, liveBlitz(false), eternum] },
  // A seat in a game still being prepared: Play leads with its lobby, never Enter before the game opens.
  "blitz-preparing": { signedIn: true, games: [frontier(false), preparingBlitz, liveBlitz(false), eternum] },
  "wallet-none": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "wallet-ready": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-choose": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-short": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-registered": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // Past the close, before a game's roster names the wallet.
  "entry-drawing": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // The slot's game is live and its roster seats the player: the ledger binds no game until the result.
  "entry-seated": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "entry-unseated": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-cancelled": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-refunded": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-no-wallet": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "reward-pending": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "reward-sealed": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "reward-after-season": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "reward-opening": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "reward-epic": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "reward-lords": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "reward-credit": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-running": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-review": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-claim": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-held": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-claimed": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-out": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
} as const;

/** The player's name on each screen whose player is not Maelis. */
export const LAB_NAMES: Partial<Record<keyof typeof LAB_SCREENS, string>> = {
  "long-name": "WWWWWWWWWWWWWWWWWWWW",
  // Identity names a new account by its id until a name is claimed.
  unnamed: LAB_SESSION.user.id,
};

/** The payout wallet linked on each screen's session; a screen not named here has none. */
export const LAB_PAYOUT_WALLETS: Partial<Record<keyof typeof LAB_SCREENS, string>> = {
  "wallet-ready": LAB_WALLET,
  "entry-choose": LAB_WALLET,
  "entry-short": LAB_WALLET,
  "entry-registered": LAB_WALLET,
  "entry-drawing": LAB_WALLET,
  "entry-seated": LAB_WALLET,
  "entry-unseated": LAB_WALLET,
  "entry-cancelled": LAB_WALLET,
  "entry-refunded": LAB_WALLET,
  "reward-pending": LAB_WALLET,
  "reward-sealed": LAB_WALLET,
  "reward-after-season": LAB_WALLET,
  "reward-opening": LAB_WALLET,
  "reward-epic": LAB_WALLET,
  "reward-lords": LAB_WALLET,
  "reward-credit": LAB_WALLET,
  "season-running": LAB_WALLET,
  "season-review": LAB_WALLET,
  "season-claim": LAB_WALLET,
  "season-held": LAB_WALLET,
  "season-claimed": LAB_WALLET,
  "season-out": LAB_WALLET,
};

const WEI = 10n ** 18n;
const NOT_REGISTERED = {
  registered: false,
  sword: false,
  shield: false,
  swordCredit: false,
  shieldCredit: false,
  paid: 0n,
  refundable: false,
  gameId: 0,
  registeredAt: 0,
};
const SEATED = {
  registered: true,
  sword: true,
  shield: true,
  swordCredit: true,
  shieldCredit: false,
  paid: 1_000n * WEI,
  refundable: false,
  gameId: 0,
  registeredAt: 0,
};
const ENTRY: EntryTerms = {
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  split: { protocolCutBps: 1000, chestLordsBps: 1000 },
  cancelled: false,
  close: NOW + 2 * 3600 + 4 * 60,
  credits: { swords: 2, shields: 0 },
  registration: NOT_REGISTERED,
  lordsToken: "0x10e5",
  lords: 2_140n * WEI,
};

/** The same slot past its close, its games drawn. */
const CLOSED_ENTRY: EntryTerms = {
  ...ENTRY,
  close: NOW - 20 * 60,
  credits: { swords: 1, shields: 0 },
  lords: 1_140n * WEI,
};

/** Screens whose slot has closed: its lobby is reached by its address once the list no longer shows it. */
/** A slot whose entry closes hours away, as QA met dev's 11:00Z slot: 10h 46m. */
const LATE_SLOT_CLOSE = NOW + 10 * 3600 + 46 * 60;

const CLOSED_SLOT_SCREENS: readonly LabScreen[] = ["entry-drawing", "entry-seated", "entry-unseated", "entry-refunded"];

/** How many registered in the slot, as the ledger counts them. */
export const LAB_SLOT_REGISTERED = 31;

/** A paid Blitz's terms for the payout wallet on each entry screen: what the ledger and the tokens would answer. */
export const LAB_ENTRY_TERMS: Partial<Record<keyof typeof LAB_SCREENS, EntryTerms>> = {
  "entry-choose": ENTRY,
  "entry-short": { ...ENTRY, credits: { swords: 0, shields: 0 }, lords: 320n * WEI },
  "entry-registered": { ...ENTRY, credits: { swords: 1, shields: 0 }, registration: SEATED, lords: 1_140n * WEI },
  "entry-drawing": { ...CLOSED_ENTRY, registration: SEATED },
  "entry-seated": { ...CLOSED_ENTRY, registration: SEATED },
  "entry-unseated": { ...CLOSED_ENTRY, registration: { ...SEATED, refundable: true } },
  "entry-cancelled": { ...ENTRY, cancelled: true, registration: SEATED, lords: 1_140n * WEI },
  "entry-refunded": { ...CLOSED_ENTRY, registration: { ...SEATED, refundable: true, swordCredit: false, paid: 0n } },
  "entry-no-wallet": ENTRY,
};

/** The lab's emailed code: this one is right, any other is refused as the identity service refuses it. */
export const LAB_EMAIL_CODE = "111111";

export type LabScreen = keyof typeof LAB_SCREENS;

/**
 * The season calendar as the launch service answers it: on `blitz-next`, the next ranked game starting in 1h 52m with
 * its entry opening in 17m; on `no-blitz`, none left in the season. Elsewhere a game is open, so the column shows it.
 */
export const labCalendar = (screen: LabScreen) => {
  if (screen !== "blitz-next") return { phases: [], nextBlitz: null };
  const at = (minutes: number) => new Date((NOW + minutes * 60) * 1000).toISOString();
  return { phases: [], nextBlitz: { name: "blitz-next", startsAt: at(112), closesAt: at(107), opensAt: at(17) } };
};

/** The slot closing at 16:30, two hours away, on the lab's shard; on the after-close screens, closed and split. */
export const labSlots = (screen: LabScreen) => {
  if (screen === "no-blitz" || screen === "blitz-next") return { slots: [] };
  const closed = CLOSED_SLOT_SCREENS.includes(screen);
  const closesAt = closed ? CLOSED_ENTRY.close : screen === "blitz-seat-late-slot" ? LATE_SLOT_CLOSE : ENTRY.close;
  return {
    slots: [
      {
        slotId: LAB_SLOT_KEY.slotId,
        chainId: LAB_CHAIN,
        name: "blitz-1630",
        closesAt: new Date(closesAt * 1000).toISOString(),
        frozenAt: closed ? new Date((closesAt + 60) * 1000).toISOString() : null,
        closed,
      },
    ],
  };
};

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
    sites_cleared: { total: sites, camps: 0, rifts: 0, ruins: 0, beasts: 0 },
    chests_earned: chests,
    rewards: { lords: String(lords), essence: "0", labor: "0" },
    deepest_depth: 2,
    order: (index % 16) + 1,
  })),
};

/**
 * A finished Blitz: the player third of five, each row with the activity its points came from, as Herald's points
 * board answers it (the score card draws the player's).
 */
export const LAB_BLITZ_BOARD: HeraldLeaderboard = {
  game_id: "7",
  mode: "points",
  entries: [rival(1), rival(0), LAB_PLAYER, rival(2), rival(3)].map((address, index) => ({
    address,
    rank: index + 1,
    totalPoints: 412 - index * 30,
    activityBreakdown: {
      exploration: { count: 48 - index * 6, points: 96 - index * 12 },
      openRelicChest: { count: 3, points: 30 },
      hyperStructureBanditsDefeat: { count: 1, points: 100 },
      otherStructureBanditsDefeat: { count: 4 - (index % 3), points: 80 - (index % 3) * 20 },
      hyperstructureShare: { count: 1, points: 106 - index * 18 + (index % 3) * 20 },
    },
  })),
};

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
 * The Blitz rating's top six and the player 41st of 1,240 (/api/ratings/top): each row's L2 owner with the Realms
 * profile behind it; the fourth wallet is linked to no Realms identity and the sixth chose no name, so both read as
 * their addresses.
 */
export const LAB_RATING_TOP = {
  block_number: 812_345,
  block_hash: "0x5ea1",
  total: 1240,
  entries: ["2480", "2210", "2050", "1960", "1880", "1820"].map((rating, index) => ({
    rank: index + 1,
    player: `0x0${(0xe000 + index).toString(16)}${"7c4b".repeat(14)}${(0x9a10 + index * 0x111).toString(16)}`,
    rating,
    profile:
      index === 3
        ? null
        : {
            realmsId: `0x${(0x200 + index).toString(16)}`,
            name: index === 5 ? null : NAMES[index],
            portrait: `0${index + 1}`,
          },
  })),
  self: {
    status: "rated" as const,
    player: LAB_WALLET,
    rating: "1744",
    rank: 41,
    profile: { realmsId: REALMS_ID, name: LAB_SESSION.user.name, portrait: LAB_SESSION.user.image },
  },
};

/** The 16:30 lobby's seated players' names (their gameplay accounts resolve like any player's). */
const SEAT_NAMES = ["Ysabeau", "Aldric", "Corwin", "Tybalt", "Isolde", "Brannoc", "Caradoc", "Gwenllian", "Osric"];
export const LAB_SEAT_PROFILES = Object.fromEntries(
  SEAT_NAMES.map((name, position) => [
    `0x${(0xa000 + position).toString(16)}`,
    { name, portrait: `0${(position % 9) + 1}` },
  ]),
);

/** Blitz ratings by wallet (/api/ratings?players): the only wallet the lab asks for is the player's own, at 1,744. */
export const labRatings = (wallets: readonly string[]) => ({
  block_number: 812_345,
  block_hash: "0x5ea1",
  ratings: Object.fromEntries(wallets.map((wallet) => [wallet, { status: "rated", player: wallet, rating: "1744" }])),
});

/** The lobby's chat so far (/api/chat/world), oldest first, from seated players. */
export const LAB_CHAT = [
  ["Aldric", "gl hf"],
  ["Tybalt", "who takes the north ridge?"],
  ["Brannoc", "storm lords keep together"],
  ["Osric", "see you at the spires"],
  ["Ysabeau", "two minutes"],
].map(([name, content], index) => ({
  id: `lab-chat-${index}`,
  sender: { playerId: `0x${(100 + SEAT_NAMES.indexOf(name)).toString(16)}`, displayName: name },
  zoneId: "slot:blitz-1630",
  content,
  createdAt: new Date((NOW - 600 + index * 60) * 1000).toISOString(),
}));

const RESULT = { rank: 3, chestId: 41n, mmrBefore: 1744, mmrAfter: 1780 };
const SWORD = {
  registered: true,
  sword: true,
  shield: false,
  swordCredit: false,
  shieldCredit: false,
  paid: 0n,
  refundable: false,
  gameId: 7,
  registeredAt: 0,
};
const CHEST = { seasonId: 3, band: 0, requested: false, finished: false, requester: "0x0", requestBlock: 0 };
const OPENED = { ...CHEST, requested: true, finished: true, requester: LAB_WALLET, requestBlock: 812_300 };
/** The slot's entry, and each rank band's token reward in shares of it, best band first: the two lowest draw none. */
const ENTRY_FEE = 500n * WEI;
const TOKEN_SHARES = [4, 2, 1, 0, 0];
const SEALED: Reward = {
  result: RESULT,
  collection: "0xc4e57",
  chest: CHEST,
  held: true,
  content: null,
  drawBlocksLeft: null,
  seasonEnd: NOW + 52 * DAY,
  token: { shares: TOKEN_SHARES[CHEST.band], entryFee: ENTRY_FEE },
  registration: SWORD,
};
/** A sealed chest of a rank band, with that band's token reward. */
const sealedOf = (band: number): Reward => ({
  ...SEALED,
  chest: { ...CHEST, band },
  token: { shares: TOKEN_SHARES[band], entryFee: ENTRY_FEE },
});

/** The payout wallet's result and chest on each reward screen: what the ledger would answer. */
export const LAB_REWARDS: Partial<Record<keyof typeof LAB_SCREENS, Reward>> = {
  "reward-pending": { ...SEALED, result: { ...RESULT, rank: 0, chestId: 0n }, chest: null },
  // The middle band, the chest the owner picked.
  "reward-sealed": sealedOf(2),
  "reward-after-season": { ...sealedOf(1), seasonEnd: NOW - DAY },
  // The draw part-way: 4 of its 11 blocks still to come.
  "reward-opening": { ...SEALED, chest: { ...OPENED, band: 2, finished: false }, held: false, drawBlocksLeft: 4 },
  "reward-epic": { ...SEALED, chest: OPENED, held: false, content: { kind: "cosmetic", attributes: "0x4040d01" } },
  // The best band's token reward: four entries.
  "reward-lords": { ...SEALED, chest: OPENED, held: false, content: { kind: "lords", amount: 4n * ENTRY_FEE } },
  "reward-credit": {
    ...SEALED,
    result: { ...RESULT, mmrAfter: 1732 },
    registration: { ...SWORD, sword: false, shield: true },
    chest: { ...OPENED, band: 3 },
    held: false,
    content: { kind: "shield" },
  },
};

/**
 * The Blitz season on Season: day 18 of 70 with 765,900 LORDS pooled and 500 ranked, then the season over with
 * 2,933,300 and the player on the posted list.
 */
const RUNNING: SeasonPrize = {
  ledger: "0x1ed9e7",
  seasonId: 3,
  season: {
    participants: 500,
    winners: 50,
    posted: false,
    challenged: false,
    reviewUntil: 0,
    presetId: 4,
    start: NOW - 18 * DAY,
    end: NOW + 52 * DAY,
    pool: 765_900n * WEI,
  },
  curve: { paidFractionBps: 1000, decayBps: 9600 },
  wallet: LAB_WALLET,
  share: null,
  position: null,
  claimed: false,
};
const OVER = { ...RUNNING.season, posted: true, start: NOW - 70 * DAY, end: NOW - 2 * 3600, pool: 2_933_300n * WEI };
const SHARE = 46_569n * WEI;

export const LAB_SEASON_PRIZES: Partial<Record<keyof typeof LAB_SCREENS, SeasonPrize>> = {
  "season-running": RUNNING,
  "season-review": { ...RUNNING, season: { ...OVER, reviewUntil: NOW + 42 * 60 }, share: SHARE, position: 11 },
  "season-claim": { ...RUNNING, season: { ...OVER, reviewUntil: NOW - 60 }, share: SHARE, position: 11 },
  "season-held": {
    ...RUNNING,
    season: { ...OVER, challenged: true, reviewUntil: NOW + 600 },
    share: SHARE,
    position: 11,
  },
  "season-claimed": {
    ...RUNNING,
    season: { ...OVER, reviewUntil: NOW - 60 },
    share: SHARE,
    position: 11,
    claimed: true,
  },
  "season-out": { ...RUNNING, season: { ...OVER, reviewUntil: NOW - 60 } },
};

/**
 * A new account at its one step (sign-in's name and portrait): the name suggested at sign-up, which passes the rule, or
 * one too short to, so the field is drawn refused.
 */
export const LAB_NEW_ACCOUNTS = {
  name: { ...LAB_SESSION, user: { ...LAB_SESSION.user, name: null, suggestedName: "Maelis" } },
  "name-refused": { ...LAB_SESSION, user: { ...LAB_SESSION.user, name: null, suggestedName: "Ma" } },
} as unknown as Record<"name" | "name-refused", Session>;

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
    view: doorwayView({ source: "boot", phase: "initial_sync", audience: "player" }),
    realm: { name: "Stolsli", emblem: orderEmblem(1) },
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
  // The holds with a step: the map failed with the realm to open, the device limit, a Blitz to watch, one ended.
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
  watch: {
    view: doorwayView({ source: "entry", phase: "spectate", audience: "player", signedIn: true }),
    realm: null,
  },
  ended: {
    view: doorwayView({ source: "boot", phase: "ready", audience: "player", ended: true }),
    realm: null,
  },
} satisfies Record<string, { view: DoorwayView; realm: DoorwayRealm | null }>;
