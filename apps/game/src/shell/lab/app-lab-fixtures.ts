import type { HeraldFrontierLeaderboard, HeraldLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { StructureType } from "@bibliothecadao/types";
import { realmsAccountAddress } from "@realms-world/identity/account";
import type { Session } from "@realms-world/identity";

import type { DirectoryGame } from "../herald";
import type { PayoutWallet } from "@/hooks/context/payout-wallet";

import type { EntryTerms, SlotLedger } from "../blitz/entry";
import type { SeasonPrize } from "../season-tab/blitz-season";
import type { GameLedger, Reward } from "../season-tab/reward";

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
  "wallet-none": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "wallet-hold": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "wallet-ready": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-choose": { signedIn: true, joined: false, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-short": { signedIn: true, joined: false, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-no-strk": { signedIn: true, joined: false, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-seated": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-cancelled": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-refunded": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "entry-no-wallet": { signedIn: true, joined: false, games: [frontier(true), liveBlitz(false), eternum] },
  "reward-pending": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "reward-sealed": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "reward-no-strk": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "reward-epic": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "reward-lords": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "reward-credit": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-running": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-review": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-claim": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-no-strk": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-held": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-claimed": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-out": { signedIn: true, joined: true, games: [frontier(true), liveBlitz(false), eternum] },
} as const;

const LAB_WALLET = "0x04a1c0de5eed000000000000000000000000000000000000000000000009c2e";

/** The payout wallet the identity service reports on each screen's session; screens without one report none. */
export const LAB_PAYOUT_WALLETS: Partial<Record<keyof typeof LAB_SCREENS, PayoutWallet>> = {
  "wallet-none": { status: "no_wallet" },
  "wallet-hold": { status: "on_hold", address: LAB_WALLET, until: (NOW + 17 * 3600 + 42 * 60) * 1000 },
  "wallet-ready": { status: "ready", address: LAB_WALLET },
  "entry-choose": { status: "ready", address: LAB_WALLET },
  "entry-short": { status: "ready", address: LAB_WALLET },
  "entry-no-strk": { status: "ready", address: LAB_WALLET },
  "entry-seated": { status: "ready", address: LAB_WALLET },
  "entry-cancelled": { status: "ready", address: LAB_WALLET },
  "entry-refunded": { status: "ready", address: LAB_WALLET },
  "entry-no-wallet": { status: "no_wallet" },
  "reward-pending": { status: "ready", address: LAB_WALLET },
  "reward-sealed": { status: "ready", address: LAB_WALLET },
  "reward-no-strk": { status: "ready", address: LAB_WALLET },
  "reward-epic": { status: "ready", address: LAB_WALLET },
  "reward-lords": { status: "ready", address: LAB_WALLET },
  "reward-credit": { status: "ready", address: LAB_WALLET },
  "season-running": { status: "ready", address: LAB_WALLET },
  "season-review": { status: "ready", address: LAB_WALLET },
  "season-claim": { status: "ready", address: LAB_WALLET },
  "season-no-strk": { status: "ready", address: LAB_WALLET },
  "season-held": { status: "ready", address: LAB_WALLET },
  "season-claimed": { status: "ready", address: LAB_WALLET },
  "season-out": { status: "ready", address: LAB_WALLET },
};

/** The ledger game the lab's slot fills, on a paid Blitz's screens. */
export const LAB_SLOT_LEDGER: SlotLedger = { address: "0x1ed9e7", key: { shard: LAB_CHAIN, gameId: 7 } };

const WEI = 10n ** 18n;
const NOT_REGISTERED = {
  registered: false,
  sword: false,
  shield: false,
  swordCredit: false,
  shieldCredit: false,
  paid: 0n,
};
const SEATED = {
  registered: true,
  sword: true,
  shield: true,
  swordCredit: true,
  shieldCredit: false,
  paid: 1_000n * WEI,
};
const ENTRY: EntryTerms = {
  prices: { seat: 500n * WEI, sword: 500n * WEI, shield: 500n * WEI },
  cancelled: false,
  credits: { swords: 2, shields: 0 },
  registration: NOT_REGISTERED,
  lords: 2_140n * WEI,
  strk: 10n ** 17n,
};

/** A paid Blitz's terms for the payout wallet on each entry screen: what the ledger and the tokens would answer. */
export const LAB_ENTRY_TERMS: Partial<Record<keyof typeof LAB_SCREENS, EntryTerms>> = {
  "entry-choose": ENTRY,
  "entry-short": { ...ENTRY, credits: { swords: 0, shields: 0 }, lords: 320n * WEI },
  "entry-no-strk": { ...ENTRY, strk: 0n },
  "entry-seated": { ...ENTRY, credits: { swords: 1, shields: 0 }, registration: SEATED, lords: 1_140n * WEI },
  "entry-cancelled": { ...ENTRY, cancelled: true, registration: SEATED, lords: 1_140n * WEI },
  "entry-refunded": { ...ENTRY, cancelled: true, registration: { ...SEATED, swordCredit: false, paid: 0n } },
  "entry-no-wallet": ENTRY,
};

/** The lab's emailed code: this one is right, any other is refused as the identity service refuses it. */
export const LAB_EMAIL_CODE = "111111";

export type LabScreen = keyof typeof LAB_SCREENS;

/** A slot filling for 16:30, two hours away, with 17 of 24 seats taken; the player's among them when joined. */
export const labSlots = (joined: boolean, ledger?: SlotLedger) => ({
  slots: [
    {
      name: "blitz-1630",
      ...(ledger && { ledger: { address: ledger.address, shard: ledger.key.shard, gameId: ledger.key.gameId } }),
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
    player: "0xe0f1",
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

/**
 * Blitz ratings by gameplay account (/api/ratings?accounts): the player 1,744; the 16:30 lobby's seats falling down the
 * roster, the seventh with no linked wallet; the Frontier rivals; any other account no Realms identity owns.
 */
export const labRatings = (accounts: readonly string[]) => ({
  block_number: 812_345,
  block_hash: "0x5ea1",
  ratings: Object.fromEntries(accounts.map((account) => [account, labRatingOf(BigInt(account))])),
});

const labRatingOf = (account: bigint) => {
  const rated = (rating: number) => ({
    status: "rated",
    player: `0xe1${account.toString(16)}`,
    rating: String(rating),
  });
  if (account === BigInt(LAB_PLAYER)) return { status: "rated", player: "0xe0f1", rating: "1744" };
  const seat = Number(account - 0xa000n);
  if (seat >= 0 && seat < 24)
    return seat === 6 ? { status: "unlinked", player: null, rating: null } : rated(2480 - seat * 45);
  const rival = Number(account - 0xb000n);
  if (rival >= 0 && rival < 16) return rated(2400 - rival * 60);
  return { status: "unknown_identity", player: null, rating: null };
};

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

/** The ledger and chest collection the lab's finished Blitz was played on, on the reward screens. */
export const LAB_GAME_LEDGER: GameLedger = {
  address: "0x1ed9e7",
  chest: "0xc4e57",
  key: { shard: LAB_CHAIN, gameId: 7 },
};

const RESULT = { rank: 3, points: 352n, chestId: 41n, mmrBefore: 1744, mmrAfter: 1780 };
const SWORD = { registered: true, sword: true, shield: false, swordCredit: false, shieldCredit: false, paid: 0n };
const SEALED: Reward = {
  result: RESULT,
  chest: { opened: false, content: { kind: "cosmetic", attributes: "0x4040d01" } },
  held: true,
  registration: SWORD,
  strk: 10n ** 17n,
};

/** The payout wallet's result and chest on each reward screen: what the ledger would answer. */
export const LAB_REWARDS: Partial<Record<keyof typeof LAB_SCREENS, Reward>> = {
  "reward-pending": { ...SEALED, result: { ...RESULT, rank: 0, chestId: 0n }, chest: null },
  "reward-sealed": SEALED,
  "reward-no-strk": { ...SEALED, strk: 0n },
  "reward-epic": { ...SEALED, chest: { ...SEALED.chest!, opened: true }, held: false },
  "reward-lords": { ...SEALED, chest: { opened: true, content: { kind: "lords", amount: 700n * WEI } }, held: false },
  "reward-credit": {
    ...SEALED,
    result: { ...RESULT, mmrAfter: 1732 },
    registration: { ...SWORD, sword: false, shield: true },
    chest: { opened: true, content: { kind: "shield" } },
    held: false,
  },
};

/**
 * The Blitz season on Season: day 18 of 70 with 765,900 LORDS pooled and 500 ranked, then the season over with
 * 2,933,300 and the player on the posted list.
 */
const RUNNING: SeasonPrize = {
  ledger: LAB_GAME_LEDGER.address,
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
  share: null,
  claimed: false,
  strk: 10n ** 17n,
};
const OVER = { ...RUNNING.season, posted: true, start: NOW - 70 * DAY, end: NOW - 2 * 3600, pool: 2_933_300n * WEI };
const SHARE = 46_569n * WEI;

export const LAB_SEASON_PRIZES: Partial<Record<keyof typeof LAB_SCREENS, SeasonPrize>> = {
  "season-running": RUNNING,
  "season-review": { ...RUNNING, season: { ...OVER, reviewUntil: NOW + 42 * 60 }, share: SHARE },
  "season-claim": { ...RUNNING, season: { ...OVER, reviewUntil: NOW - 60 }, share: SHARE },
  "season-no-strk": { ...RUNNING, season: { ...OVER, reviewUntil: NOW - 60 }, share: SHARE, strk: 0n },
  "season-held": { ...RUNNING, season: { ...OVER, challenged: true, reviewUntil: NOW + 600 }, share: SHARE },
  "season-claimed": { ...RUNNING, season: { ...OVER, reviewUntil: NOW - 60 }, share: SHARE, claimed: true },
  "season-out": { ...RUNNING, season: { ...OVER, reviewUntil: NOW - 60 } },
};
