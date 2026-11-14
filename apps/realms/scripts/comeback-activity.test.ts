import { expect, it } from "vitest";
import { dayOf } from "../../../packages/core/src/utils/days";
import {
  Activity,
  stillFits,
  sendCampaign,
  variantOf,
  type Account,
  type Delivery,
  type HistoryEvent,
} from "./comeback-campaign";

// The Devcon season's own calendar (Herald's directory), and a send on its Frontier Day 5.
const CALENDAR = {
  seed: 3286620661979583031199232875686605379684932987835349531891724301093691491459n,
  startMainAt: 1793682000,
  scheduledEndAt: 1793988000,
  endAt: 1793988000,
  dayUnitSeconds: 7200,
};
const NOW = 1793800000;
const SINCE = NOW - 24 * 60 * 60;
/** The visit record (user.lastSeenAt) began long before the window. */
const RECORDED = 0;
const hex = (value: number) => `0x${value.toString(16)}`;
const today = dayOf(CALENDAR, NOW)!.index;

// Player addresses, as Herald writes them.
const EXPLORER = "0x7f7c1afd2011c17204a0aa4205c5eb53bacd9e9b498421bd5415c9c613a70fd";
const ATTACKER = "0x490b9567e8a84468372eada53ca0986d5ce01baffd5ce61c4e80fb505564157";
const REJECTED = "0x6b2656586c5305258b35c5e8a1c393c2c82969a17b19099e5fb336ea640c101";
const BATCHER = "0x11";
const CLAIMER = "0x22";
const OLD_CLAIMER = "0x33";

// Events in Herald's history shapes (block numbers ascending with time).
const story = (block: number, owner: string, at: number): HistoryEvent => ({
  model: "StoryEvent",
  block_number: block,
  value: { owner, story: { ExplorationReward: {} }, game_id: "0x1", entity_id: "0xdb06b00000023", timestamp: hex(at) },
});
const battle = (block: number, player: string, at: number): HistoryEvent => ({
  model: "BattleEvent",
  block_number: block,
  value: {
    attacker: { player, tier: "T1" },
    attacker_owner: "0xb903800000001",
    defender: { player: "0x0" },
    defender_owner: "0x0",
    timestamp: hex(at),
  },
});
const rejected = (block: number, actor: string): HistoryEvent => ({
  model: "GameplayRejected",
  block_number: block,
  value: { actor, reason: "destination occupied", game_id: "0x1" },
});
const batch = (block: number, actor: string): HistoryEvent => ({
  model: "BatchProgress",
  block_number: block,
  value: { game_id: "0x1", actor, tx_hash: "0x2", remaining: "0x8" },
});

const activityNow = () => new Activity(CALENDAR, () => NOW);

it("counts every confirmed action by the player it names, and claims by their Frontier day", () => {
  const activity = activityNow();
  activity.noteHistory([
    story(300, EXPLORER, NOW - 600),
    battle(250, ATTACKER, NOW - 3600),
    rejected(205, REJECTED),
    story(210, "0x99", NOW - 7200),
    batch(320, BATCHER),
    story(100, "0x98", SINCE - 7200),
  ]);
  activity.noteClaims([
    { account: CLAIMER, day: hex(today) },
    { account: OLD_CLAIMER, day: "0x0" },
  ]);
  for (const back of [EXPLORER, ATTACKER, REJECTED, BATCHER, CLAIMER])
    expect(activity.latestOf([back])).toBeGreaterThanOrEqual(SINCE);
  expect(activity.latestOf([OLD_CLAIMER])).toBeLessThan(SINCE);
  expect(activity.latestOf(["0x98"])).toBe(SINCE - 7200);
});

it("dates an event without a timestamp by the earliest later block, or now when none follows", () => {
  const activity = activityNow();
  activity.noteHistory([
    story(100, "0x98", SINCE - 50_000),
    rejected(150, REJECTED),
    story(200, "0x99", SINCE - 40_000),
    batch(250, BATCHER),
  ]);
  expect(activity.latestOf([REJECTED])).toBe(SINCE - 40_000);
  expect(activity.latestOf([BATCHER])).toBe(NOW);
});

it("stops on a history kind it cannot attribute, rather than treat it as an absence", () => {
  expect(() =>
    activityNow().noteHistory([{ model: "ResearchStory", block_number: 1, value: { player: EXPLORER } }]),
  ).toThrow("unattributed history kind: ResearchStory");
});

it("emails the players still away and leaves out one who claims between two emails", async () => {
  const activity = activityNow();
  activity.noteHistory([
    story(100, "0xa", SINCE - 7200),
    story(101, "0xb", SINCE - 7200),
    story(102, "0xc", SINCE - 7200),
  ]);
  activity.noteClaims([{ account: CLAIMER, day: hex(today) }]);
  const account = (realmsId: string, addresses: string[]): Account & { addresses: string[] } => ({
    realmsId,
    addresses,
    discord: false,
    ticket: "regular",
    playtester: false,
    inSeason: true,
    lastAction: activity.latestOf(addresses),
    lastVisit: 0,
    optedOut: false,
  });
  const accounts = [
    account("0x1a", ["0xa"]),
    account("0x1b", ["0xb"]),
    account("0x1c", ["0xc"]),
    account("0x1d", [CLAIMER]),
  ];
  const deliveries = accounts.flatMap((a) =>
    variantOf(a, NOW, RECORDED)
      ? [{ ...a, variant: variantOf(a, NOW, RECORDED)! } as Delivery & { addresses: string[] }]
      : [],
  );
  expect(deliveries.map((d) => d.realmsId)).toEqual(["0x1a", "0x1b", "0x1c"]);

  const sent: string[] = [];
  let pauses = 0;
  const counts = await sendCampaign({
    deliveries,
    // The run catches up before each email; after the first email, 0xb's player claims today.
    stillAway: async (delivery) => {
      if (pauses === 1) activity.noteClaims([{ account: "0xb", day: hex(today) }]);
      return activity.latestOf(delivery.addresses) < SINCE;
    },
    reserve: async () => "reserved",
    send: async (delivery) => {
      sent.push(delivery.realmsId);
      return { kind: "accepted", id: null };
    },
    markSent: async () => {},
    release: async () => {},
    pause: async () => void pauses++,
  });
  expect(sent).toEqual(["0x1a", "0x1c"]);
  expect(counts).toMatchObject({ sent: 2, cameBack: 1 });
});

it("leaves out a player who only researched, by their recorded visit, before and between emails", async () => {
  // Research writes no history event and no claim: only the recorded visit (user.lastSeenAt) shows they came back.
  const activity = activityNow();
  activity.noteHistory([
    story(100, "0xa", SINCE - 7200),
    story(101, "0xb", SINCE - 7200),
    story(102, "0xc", SINCE - 7200),
  ]);
  const visits = new Map([
    ["0x1a", SINCE - 3 * 24 * 60 * 60],
    ["0x1b", SINCE - 3 * 24 * 60 * 60],
    ["0x1c", SINCE - 3 * 24 * 60 * 60],
    ["0x1d", NOW - 1800], // opened the game half an hour ago and researched
  ]);
  const account = (realmsId: string, addresses: string[]): Account & { addresses: string[] } => ({
    realmsId,
    addresses,
    discord: false,
    ticket: "regular",
    playtester: false,
    inSeason: true,
    lastAction: activity.latestOf(addresses),
    lastVisit: visits.get(realmsId)!,
    optedOut: false,
  });
  const accounts = [
    account("0x1a", ["0xa"]),
    account("0x1b", ["0xb"]),
    account("0x1c", ["0xc"]),
    account("0x1d", ["0xd"]),
  ];
  const deliveries = accounts.flatMap((a) =>
    variantOf(a, NOW, RECORDED)
      ? [{ ...a, variant: variantOf(a, NOW, RECORDED)! } as Delivery & { addresses: string[] }]
      : [],
  );
  expect(deliveries.map((d) => d.realmsId)).toEqual(["0x1a", "0x1b", "0x1c"]);

  const sent: string[] = [];
  const counts = await sendCampaign({
    deliveries,
    // After the first email, 0x1b's player opens the game: the visit is recorded, and no chain event follows.
    stillAway: async (delivery) => {
      if (sent.length === 1) visits.set("0x1b", NOW);
      return stillFits(
        delivery.variant,
        { lastAction: activity.latestOf(delivery.addresses), lastVisit: visits.get(delivery.realmsId)! },
        NOW,
        RECORDED,
      );
    },
    reserve: async () => "reserved",
    send: async (delivery) => {
      sent.push(delivery.realmsId);
      return { kind: "accepted", id: null };
    },
    markSent: async () => {},
    release: async () => {},
    pause: async () => {},
  });
  expect(sent).toEqual(["0x1a", "0x1c"]);
  expect(counts).toMatchObject({ sent: 2, cameBack: 1 });
});

it("keeps emailing a ticket holder who signed up and visited without founding, until they found", () => {
  const signedUpToday = { lastAction: 0, lastVisit: NOW - 600 };
  expect(stillFits("N", signedUpToday, NOW, RECORDED)).toBe(true);
  expect(stillFits("N", { ...signedUpToday, lastAction: NOW - 60 }, NOW, RECORDED)).toBe(false);
  expect(stillFits("D", signedUpToday, NOW, RECORDED)).toBe(false);
});
