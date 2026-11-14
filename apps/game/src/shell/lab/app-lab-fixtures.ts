import type { HeraldFrontierLeaderboard, HeraldLeaderboard } from "@bibliothecadao/eternum/game-sync";
import { StructureType } from "@bibliothecadao/types";
import { uint256 } from "starknet";
import { buildLedgerEconomicPreset, chestPresetFor } from "../../../../../config/deployer/clean/ledger/economics";
import { blitzVictoryPointConfig } from "../../../../../config/source/blitz/balance";
import { VICTORY_POINTS_MULTIPLIER } from "../../../../../config/source/common/arena/points";
import { realmsAccountAddress } from "@realms-world/identity/account";
import type { CampaignReferral, CampaignTicket, Session, ShareTally } from "@realms-world/identity";

import { orderEmblem } from "@/ui/design-system/kit/order-emblem";
import type { DoorwayRealm } from "@/ui/features/game-entry/doorway/doorway-screen";
import { type DoorwayView, doorwayView } from "@/ui/features/game-entry/doorway/doorway-view";
import { DEVICE_LIMIT_REACHED } from "@/hooks/context/gameplay-account-sync";

import type { DirectoryGame } from "../herald";
import { nativeFactSchemaIdentity } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { ARCHIVED_SEASONS, archivedSeason } from "../season-tab/archive/archive";

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
  clock: { start_settling_at: NOW - DAY, start_main_at: NOW - DAY, scheduled_end_at: NOW + 7 * DAY,
end_at: NOW + 7 * DAY, end_grace_seconds: 0 },
  player_count: 0,
  player_state: {
    registered: false,
    settled: false,
    roster_wallet: null,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    structures: [],
  },
  roster_count: 0,
  preset_id: 0,
  registration: null,
  settled_realms_count: 0,
  settled_villages_count: 0,
  settlement: null,
  ...over,
});

const owned = {
  registered: true,
  settled: true,
  roster_wallet: LAB_WALLET,
  held_realm_id: null,
  has_home_source: false,
  taken_realm_ids: [],
  structures: [REALM],
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
    season_number: 3,
    clock: {
      start_settling_at: NOW - 12 * DAY + LEFT_TODAY,
      start_main_at: NOW - 12 * DAY + LEFT_TODAY,
      scheduled_end_at: NOW + 20 * DAY,
end_at: NOW + 20 * DAY,
      end_grace_seconds: 0,
    },
    player_count: 1240,
    player_state: withRealm ? owned : null,
  });

/** Frontier's second season, over an hour ago and not settled yet: the directory still lists it. */
const endedFrontier = game({
  game_id: 3,
  name: "frontier-0",
  status: "Ended",
  season_number: 2,
  clock: { start_settling_at: NOW - 21 * DAY, start_main_at: NOW - 21 * DAY, scheduled_end_at: NOW - 3600,
end_at: NOW - 3600, end_grace_seconds: 0 },
  player_count: 1240,
  player_state: owned,
});

const liveBlitz = (member: boolean) =>
  game({
    game_id: 7,
    name: "blitz-1500-1",
    mode: "blitz",
    clock: { start_settling_at: NOW - 3600, start_main_at: NOW - 2400, scheduled_end_at: NOW + 5040,
end_at: NOW + 5040, end_grace_seconds: 0 },
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
  clock: { start_settling_at: NOW + 3600, start_main_at: NOW + 7200, scheduled_end_at: NOW + 14_400,
end_at: NOW + 14_400, end_grace_seconds: 0 },
  player_count: 18,
  roster_count: 24,
  player_state: {
    registered: true,
    settled: false,
    roster_wallet: LAB_WALLET,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    structures: [],
  },
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
    scheduled_end_at: NOW + 60 * DAY,
end_at: NOW + 60 * DAY,
    end_grace_seconds: 0,
  },
});

/** The same Eternum game open, the player on its roster: Enter. */
const openEternum = game({
  ...eternum,
  status: "Live",
  ready: true,
  clock: { start_settling_at: NOW - DAY, start_main_at: NOW - DAY, scheduled_end_at: NOW + 60 * DAY,
end_at: NOW + 60 * DAY, end_grace_seconds: 0 },
  player_state: {
    registered: true,
    settled: false,
    roster_wallet: null,
    held_realm_id: null,
    has_home_source: false,
    taken_realm_ids: [],
    structures: [],
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
  // The player's finished Blitz, its results not yet opened, leads Play: no Blitz open and the Frontier season over
  // (audit-1027 play 10: Blitz's column, and the way to the build orders, went with it).
  "blitz-results-lead": { signedIn: true, games: [endedFrontier, eternum] },
  // No Blitz open, the calendar's next ranked game due: its column shows the start and when entry opens (the owner's
  // 10:08, before the 12:00 game's entry opens at 10:25).
  "blitz-next": { signedIn: true, games: [frontier(true), eternum] },
  // Only Eternum, not open yet: it leads Play, idle as its column would be, beside an idle Blitz; then open, to enter.
  "eternum-lead": { signedIn: true, games: [eternum] },
  "eternum-open": { signedIn: true, games: [openEternum] },
  unnamed: { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "no-realm": { signedIn: true, games: [frontier(false), liveBlitz(false), eternum] },
  "blitz-seat": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  // The seat's Blitz leads, and the next slot's entry closes hours away: its row reads the longer clock QA met on dev
  // ("Entry closes 12:55 · 10h 46m left"), which wraps on a phone.
  "blitz-seat-late-slot": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-over": { signedIn: true, games: [endedFrontier, liveBlitz(false), eternum] },
  // The same season's Results with a podium of one place (the owner's dev season of 2 November: the player alone and
  // paid) and of two.
  "season-over-one": { signedIn: true, games: [endedFrontier, liveBlitz(false), eternum] },
  "season-over-two": { signedIn: true, games: [endedFrontier, liveBlitz(false), eternum] },
  // No Frontier season listed, the last one settled into the history: production after its first season (10-31).
  "no-season": { signedIn: true, games: [liveBlitz(false), eternum] },
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
  // Frontier's season before its prize pool is published.
  "season-unpublished": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "season-review": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-claim": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-held": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-claimed": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  "season-out": { signedIn: true, games: [frontier(true), liveBlitz(true), eternum] },
  // Devcon's flyer landing (/join/devcon): an account holding no ticket, whose flyer opens a regular or a golden one, and
  // one holding its golden ticket at the Devcon game's Realm step (doorway/home).
  "devcon-flyer": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "devcon-golden": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "devcon-held": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // A friend's referral link (/join/devcon/r/<code>): who sent it over the sealed ticket, which opens a regular one.
  "devcon-referral": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // Invite friends on You (/profile), for each home: a free home before its first friend counts, a Devcon home on its
  // way to golden, a held Realm's, and the moments friends earn a free home its ticket and a Devcon home golden.
  "invite-free": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "invite-devcon": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "invite-held": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "invite-earned": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "invite-golden": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "invite-pending": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  "invite-link": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
  // Your shared days on You (/profile): what a player's posted Frontier days brought.
  "shared-days": { signedIn: true, games: [frontier(true), liveBlitz(false), eternum] },
} as const;

/** The Devcon ticket each Devcon screen's account opens with any flyer's code, or already holds. */
export const LAB_DEVCON_TICKETS: Partial<
  Record<keyof typeof LAB_SCREENS, { tier: CampaignTicket["tier"]; held: boolean }>
> = {
  "devcon-flyer": { tier: "regular", held: false },
  "devcon-golden": { tier: "golden", held: false },
  "devcon-held": { tier: "golden", held: true },
  "devcon-referral": { tier: "regular", held: false },
};

const LAB_REFERRAL_CODE = "7KQ2MX4D";
/** The inviter a referral link names on the friend's landing. */
export const LAB_REFERRER = "Isolde";
type FriendState = CampaignReferral["friends"][number]["state"];
/** A friend by state, with "*" after it for one whose ticket is golden. */
type FriendSpec = FriendState | `${FriendState}*`;
const FRIEND_NAMES = ["Corvin", "Isolde", "Tamsin", null, "Brannoc", "Wren"];
const friends = (specs: FriendSpec[]) =>
  specs.map((spec, index) => ({
    name: FRIEND_NAMES[index % FRIEND_NAMES.length] ?? null,
    state: spec.replace("*", "") as FriendState,
    golden: spec.endsWith("*"),
  }));
const referral = (
  home: CampaignReferral["home"],
  specs: FriendSpec[],
  {
    tier = home === "free" || home === "held" ? null : "regular",
    goldenPending = false,
    linkGolden = false,
    earned = {},
  }: {
    tier?: CampaignReferral["tier"];
    goldenPending?: boolean;
    linkGolden?: boolean;
    earned?: Partial<CampaignReferral["earned"]>;
  } = {},
): CampaignReferral => ({
  code: LAB_REFERRAL_CODE,
  home,
  tier,
  goldenPending,
  link: { counted: specs.filter((spec) => spec.startsWith("counted")).length, golden: linkGolden },
  friends: friends(specs),
  earned: { ticket: false, golden: false, ...earned },
});

/** What a screen's account's shared days brought; a screen this names none of has shared no day. */
export const LAB_NO_SHARES: ShareTally = { links: 0, posted: 0, visits: 0, joined: 0, activated: 0 };
export const LAB_SHARE_TALLIES: Partial<Record<keyof typeof LAB_SCREENS, ShareTally>> = {
  "shared-days": { links: 9, posted: 7, visits: 1_240, joined: 31, activated: 12 },
};

/** A screen's referral link on You when LAB_REFERRALS names none: a free home's, with no friend yet. */
export const LAB_FIRST_REFERRAL = referral("free", []);

/** Each screen's referral link and friends on You. */
export const LAB_REFERRALS: Partial<Record<keyof typeof LAB_SCREENS, CampaignReferral>> = {
  "invite-free": referral("free", ["founded", "signed*"]),
  "invite-devcon": referral("devcon", ["counted", "counted", "excluded", "founded"]),
  "invite-held": referral("held", ["counted*", "signed"]),
  "invite-earned": referral("ticket", ["counted", "signed"], { earned: { ticket: true } }),
  "invite-pending": referral("devcon", ["counted", "counted*", "founded"], {
    tier: "golden",
    goldenPending: true,
    earned: { ticket: true, golden: true },
  }),
  "invite-golden": referral("golden", ["counted", "counted*", "founded"], {
    tier: "golden",
    earned: { ticket: true, golden: true },
  }),
  "invite-link": referral(
    "golden",
    [
      "counted*",
      "counted*",
      "counted*",
      "counted*",
      "counted*",
      "counted*",
      "counted*",
      "counted*",
      "counted*",
      "counted*",
      "signed*",
    ],
    {
      tier: "golden",
      linkGolden: true,
      earned: { ticket: true, golden: true },
    },
  ),
};

/** The Realms the linked wallet holds on each screen that reads them (the relay's held-Realms answer). */
export const LAB_HELD_REALMS: Partial<Record<keyof typeof LAB_SCREENS, { realmId: number; map: null }[]>> = {
  "devcon-held": [{ realmId: 4786, map: null }],
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
  "devcon-held": LAB_WALLET,
};

const WEI = 10n ** 18n;

/**
 * Blitz's money as production registers it (its ledger and chest presets), so every entry and reward screen, and every
 * docs capture of one, states the live entry, split and chest.
 */
const PRODUCTION_CHESTS = chestPresetFor("production");
const PRODUCTION_LEDGER = buildLedgerEconomicPreset("blitz", { environment: "production", chests: PRODUCTION_CHESTS });
const ENTRY_FEE = uint256.uint256ToBN(PRODUCTION_LEDGER.entry_fee);
const SWORD_PRICE = uint256.uint256ToBN(PRODUCTION_LEDGER.sword_price);
const SHIELD_PRICE = uint256.uint256ToBN(PRODUCTION_LEDGER.shield_price);
/** The payout wallet's LORDS before it joins the slot. */
const WALLET_LORDS = 2_140n * WEI;
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
  // The seat and the shield in LORDS; the sword from a credit.
  paid: ENTRY_FEE + SHIELD_PRICE,
  refundable: false,
  gameId: 0,
  registeredAt: 0,
};
const SEATED_WALLET_LORDS = WALLET_LORDS - SEATED.paid;
const ENTRY: EntryTerms = {
  prices: { seat: ENTRY_FEE, sword: SWORD_PRICE, shield: SHIELD_PRICE },
  split: { protocolCutBps: PRODUCTION_LEDGER.protocol_cut_bps, chestLordsBps: PRODUCTION_LEDGER.chest_lords_bps },
  cancelled: false,
  close: NOW + 2 * 3600 + 4 * 60,
  credits: { swords: 2, shields: 0 },
  registration: NOT_REGISTERED,
  lordsToken: "0x10e5",
  lords: WALLET_LORDS,
};

/** The same slot past its close, its games drawn. */
const CLOSED_ENTRY: EntryTerms = {
  ...ENTRY,
  close: NOW - 20 * 60,
  credits: { swords: 1, shields: 0 },
  lords: SEATED_WALLET_LORDS,
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
  // Short of the seat itself: Mint is the way on.
  "entry-short": { ...ENTRY, credits: { swords: 0, shields: 0 }, lords: ENTRY_FEE / 2n },
  "entry-registered": {
    ...ENTRY,
    credits: { swords: 1, shields: 0 },
    registration: SEATED,
    lords: SEATED_WALLET_LORDS,
  },
  "entry-drawing": { ...CLOSED_ENTRY, registration: SEATED },
  "entry-seated": { ...CLOSED_ENTRY, registration: SEATED },
  "entry-unseated": { ...CLOSED_ENTRY, registration: { ...SEATED, refundable: true } },
  "entry-cancelled": { ...ENTRY, cancelled: true, registration: SEATED, lords: SEATED_WALLET_LORDS },
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

/** The screens with no Blitz slot open. */
const QUIET_BLITZ_SCREENS: readonly LabScreen[] = [
  "no-blitz",
  "blitz-next",
  "blitz-results-lead",
  "eternum-lead",
  "eternum-open",
];

/** The screens whose player has no finished game to open. */
export const LAB_NO_HISTORY_SCREENS: readonly LabScreen[] = [
  "no-games",
  "no-blitz",
  "blitz-next",
  "eternum-lead",
  "eternum-open",
];

/** The slot closing at 16:30, two hours away, on the lab's shard; on the after-close screens, closed and split. */
export const labSlots = (screen: LabScreen) => {
  if (QUIET_BLITZ_SCREENS.includes(screen)) return { slots: [] };
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
  releaseSchemas: { "1": nativeFactSchemaIdentity },
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
      campaign: null,
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

/** Blitz's points for one of each scoring action, as its balance grants them (stored in millionths). */
const BLITZ_POINTS = {
  tile: Number(blitzVictoryPointConfig.pointsForTileExploration / BigInt(VICTORY_POINTS_MULTIPLIER)),
  crate: Number(blitzVictoryPointConfig.pointsForRelicDiscovery / BigInt(VICTORY_POINTS_MULTIPLIER)),
  hyperstructure: Number(
    blitzVictoryPointConfig.pointsForHyperstructureClaimAgainstBandits / BigInt(VICTORY_POINTS_MULTIPLIER),
  ),
  claim: Number(
    blitzVictoryPointConfig.pointsForNonHyperstructureClaimAgainstBandits / BigInt(VICTORY_POINTS_MULTIPLIER),
  ),
};

/** One row of a finished Blitz: what each action scored at Blitz's points, and their sum. */
const blitzBoardRow = (address: string, index: number) => {
  const tiles = 48 - index * 6;
  const claims = 4 - Math.floor(index / 2);
  const activityBreakdown = {
    exploration: { count: tiles, points: tiles * BLITZ_POINTS.tile },
    openRelicChest: { count: 3, points: 3 * BLITZ_POINTS.crate },
    hyperStructureBanditsDefeat: { count: 1, points: BLITZ_POINTS.hyperstructure },
    otherStructureBanditsDefeat: { count: claims, points: claims * BLITZ_POINTS.claim },
    hyperstructureShare: { count: 1, points: 1_060 - index * 180 },
  };
  const totalPoints = Object.values(activityBreakdown).reduce((sum, { points }) => sum + points, 0);
  return { address, rank: index + 1, totalPoints, activityBreakdown };
};

/**
 * A finished Blitz: the player third of five, each row with the activity its points came from, as Herald's points
 * board answers it (the score card draws the player's).
 */
export const LAB_BLITZ_BOARD: HeraldLeaderboard = {
  game_id: "7",
  mode: "points",
  entries: [rival(1), rival(0), LAB_PLAYER, rival(2), rival(3)].map(blitzBoardRow),
};

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

/** A rated wallet's L2 address, by its index on the board. */
const ratedWallet = (index: number) =>
  `0x0${(0xe000 + index).toString(16)}${"7c4b".repeat(14)}${(0x9a10 + index * 0x111).toString(16).slice(-4)}`;

/** How many wallets the lab's Blitz rating holds. */
const RATED_WALLETS = 120;

/**
 * The Blitz rating's whole board of `wallets` rated wallets (/api/ratings/top; 120 painted, or a larger field to
 * measure): each row's L2 owner with the Realms profile behind it, the player 41st of 120 and the same share of any
 * larger field. Of the leading six, the fourth wallet is linked to no Realms identity and the sixth chose no name, so
 * both read as their addresses; the field below them is named by number.
 */
export const labRatingTop = (wallets: number) => {
  const place = Math.max(7, Math.round((wallets * 41) / 120));
  const self = {
    status: "rated" as const,
    player: LAB_WALLET,
    rating: "1744",
    rank: place,
    profile: { realmsId: REALMS_ID, name: LAB_SESSION.user.name, portrait: LAB_SESSION.user.image },
  };
  const entries = Array.from({ length: wallets }, (_, index) => {
    const rank = index + 1;
    if (rank === place) return { rank, player: self.player, rating: self.rating, profile: self.profile };
    return {
      rank,
      player: ratedWallet(index),
      rating: String(Math.max(0, 2480 - index * 18)),
      profile: ratedProfile(index),
    };
  });
  return { block_number: 812_345, block_hash: "0x5ea1", entries, self };
};

/** The painted rating: 120 wallets, the player 41st. */
export const LAB_RATING_TOP = labRatingTop(RATED_WALLETS);

/**
 * A rated wallet's profile: the leading six as named, the fourth unlinked and the sixth unnamed; the field by number.
 */
function ratedProfile(index: number) {
  if (index === 3) return null;
  return {
    realmsId: `0x${(0x200 + index).toString(16)}`,
    name: index === 5 ? null : (NAMES[index] ?? `Rider ${index + 1}`),
    portrait: `0${(index % 9) + 1}`,
  };
}

/** The 16:30 lobby's seated players' names (their gameplay accounts resolve like any player's). */
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
  sender: { playerId: chatPlayerId(name), displayName: name },
  zoneId: "slot:blitz-1630",
  content,
  createdAt: new Date((NOW - 600 + index * 60) * 1000).toISOString(),
}));

/** Global's chat so far, oldest first: the room every player has, in the app as in a game. */
export const LAB_GLOBAL_CHAT = [
  ["Isolde", "anyone up for the next Blitz?"],
  ["Corwin", "frontier day 12, the spire is open"],
  ["Aldric", "gg everyone, see you at the lobby"],
].map(([name, content], index) => ({
  id: `lab-global-${index}`,
  sender: { playerId: chatPlayerId(name), displayName: name },
  zoneId: "world:global",
  content,
  createdAt: new Date((NOW - 900 + index * 120) * 1000).toISOString(),
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
/** Each rank band's token reward in entries, best band first, as production's chest preset pays it. */
const TOKEN_SHARES = PRODUCTION_CHESTS.bands.map((band) => band.lords_shares);
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
  // The best band's token reward.
  "reward-lords": {
    ...SEALED,
    chest: OPENED,
    held: false,
    content: { kind: "lords", amount: BigInt(TOKEN_SHARES[CHEST.band]) * ENTRY_FEE },
  },
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
} satisfies Record<string, { view: DoorwayView; realm: DoorwayRealm | null }>;
