import { expect, it } from "vitest";
import {
  awaySince,
  sendCampaign,
  variantOf,
  wranglerFailure,
  type Account,
  type Delivery,
  type Handoff,
} from "./comeback-campaign";

const HOUR = 60 * 60;
/** The send. */
const NOW = 1_000_000;
/** 24 hours before the send: a player who acted after it has come back. */
const SINCE = NOW - 24 * HOUR;
/** The visit record began long before the window. */
const RECORDED = 0;
const account = (overrides: Partial<Account>): Account => ({
  realmsId: "0x1",
  discord: false,
  ticket: null,
  playtester: false,
  inSeason: false,
  lastAction: 0,
  lastVisit: 0,
  optedOut: false,
  ...overrides,
});

it("picks each account's variant, and none for an account that stopped news emails", () => {
  const idleFounder = account({ ticket: "regular", inSeason: true, lastAction: SINCE - 1 });
  expect(variantOf(idleFounder, NOW, RECORDED)).toBe("D");
  expect(variantOf({ ...idleFounder, lastAction: SINCE + 5 }, NOW, RECORDED)).toBeNull();
  expect(variantOf(account({ ticket: "golden" }), NOW, RECORDED)).toBe("N");
  expect(variantOf(account({ playtester: true, inSeason: true, lastAction: SINCE - 1 }), NOW, RECORDED)).toBe("P");
  expect(variantOf(account({ playtester: true }), NOW, RECORDED)).toBe("P");
  expect(variantOf(account({ playtester: true, inSeason: true, lastAction: SINCE + 5 }), NOW, RECORDED)).toBeNull();
  expect(variantOf(account({}), NOW, RECORDED)).toBeNull();
  // A recorded visit leaves the player out, research-only or not: within the window, or within the hour the record
  // can lag behind a visit.
  expect(variantOf({ ...idleFounder, lastVisit: SINCE + 60 }, NOW, RECORDED)).toBeNull();
  expect(variantOf({ ...idleFounder, lastVisit: SINCE - 60 * 60 + 60 }, NOW, RECORDED)).toBeNull();
  expect(variantOf({ ...idleFounder, lastVisit: SINCE - 60 * 60 - 60 }, NOW, RECORDED)).toBe("D");
  // Without a visit record nobody is away; N does not depend on it.
  expect(variantOf(idleFounder, NOW, null)).toBeNull();
  expect(variantOf(account({ ticket: "golden" }), NOW, null)).toBe("N");
  // N asks for a realm not yet founded: a visit since signing up does not found it.
  expect(variantOf(account({ ticket: "golden", lastVisit: SINCE + 5 }), NOW, RECORDED)).toBe("N");
  for (const stopped of [{ ...idleFounder }, account({ ticket: "golden" }), account({ playtester: true })])
    expect(variantOf({ ...stopped, optedOut: true }, NOW, RECORDED)).toBeNull();
});

/**
 * The send record and the opt-out column as D1 holds them, shared by every run, and a provider that delivers every
 * email it accepts: it has no deduplication, so a second handoff is a second email.
 */
const world = () => {
  const record = new Map<string, "reserved" | "sent">();
  const optedOut = new Set<string>();
  const cameBack = new Set<string>();
  const delivered: string[] = [];
  const run = (
    deliveries: Delivery[],
    options: {
      answer?: (delivery: Delivery) => Handoff;
      crashBeforeMark?: string;
      duringPause?: () => void;
    } = {},
  ) =>
    sendCampaign({
      deliveries,
      stillAway: async ({ realmsId }) => !cameBack.has(realmsId),
      reserve: async ({ realmsId }) => {
        if (optedOut.has(realmsId)) return "opted_out";
        if (record.has(realmsId)) return "taken";
        record.set(realmsId, "reserved");
        return "reserved";
      },
      send: async (delivery) => {
        await Promise.resolve();
        const answer = options.answer?.(delivery) ?? { kind: "accepted", id: `email-${delivery.realmsId}` };
        if (answer.kind !== "refused") delivered.push(delivery.realmsId);
        return answer;
      },
      markSent: async ({ realmsId }) => {
        if (realmsId === options.crashBeforeMark) throw new Error("crashed before the mark");
        record.set(realmsId, "sent");
      },
      release: async ({ realmsId }) => void record.delete(realmsId),
      pause: async () => options.duringPause?.(),
    });
  return { run, record, optedOut, cameBack, delivered };
};
const deliveries: Delivery[] = [
  { realmsId: "0xa", variant: "D" },
  { realmsId: "0xb", variant: "N" },
  { realmsId: "0xc", variant: "P" },
];

it("sends each account once, so a second run sends nobody", async () => {
  const { run, delivered } = world();
  expect(await run(deliveries)).toMatchObject({ sent: 3, alreadyReserved: 0 });
  expect(await run(deliveries)).toMatchObject({ sent: 0, alreadyReserved: 3 });
  expect(delivered).toEqual(["0xa", "0xb", "0xc"]);
});

it("never sends again an account whose send was interrupted, however long after and whatever the live figures", async () => {
  const { run, record, delivered } = world();
  await expect(run(deliveries, { crashBeforeMark: "0xb" })).rejects.toThrow("crashed before the mark");
  expect(await run(deliveries)).toMatchObject({ sent: 1, alreadyReserved: 2 });
  expect(delivered).toEqual(["0xa", "0xb", "0xc"]);
  expect(record.get("0xb")).toBe("reserved");
});

it("sends each account once when two runs go at the same time", async () => {
  const { run, delivered } = world();
  const [first, second] = await Promise.all([run(deliveries), run(deliveries)]);
  expect(first.sent + second.sent).toBe(3);
  expect([...delivered].sort()).toEqual(["0xa", "0xb", "0xc"]);
});

it("skips an account that stops news emails while the run is going", async () => {
  const { run, optedOut, delivered } = world();
  const counts = await run(deliveries, { duringPause: () => optedOut.add("0xb") });
  expect(counts).toMatchObject({ sent: 2, optedOut: 1 });
  expect(delivered).toEqual(["0xa", "0xc"]);
});

it("frees an outright refusal for a later run, and keeps an unclear answer out of every later run", async () => {
  const refused = world();
  expect(
    await refused.run(deliveries, {
      answer: (d) => (d.realmsId === "0xb" ? { kind: "refused" } : { kind: "accepted", id: null }),
    }),
  ).toMatchObject({ sent: 1, refused: 1 });
  expect(await refused.run(deliveries)).toMatchObject({ sent: 2, alreadyReserved: 1 });
  expect(refused.delivered).toEqual(["0xa", "0xb", "0xc"]);

  const unclear = world();
  expect(
    await unclear.run(deliveries, {
      answer: (d) => (d.realmsId === "0xb" ? { kind: "unknown" } : { kind: "accepted", id: null }),
    }),
  ).toMatchObject({ sent: 1, unknown: 1 });
  expect(await unclear.run(deliveries)).toMatchObject({ sent: 1, alreadyReserved: 2 });
  expect(unclear.delivered).toEqual(["0xa", "0xb", "0xc"]);
});

it("logs a failed D1 call by the error it names, never the query wrangler echoes", () => {
  const query = `SELECT realmsId FROM "user" WHERE email = 'player.one+x@example.com' AND realmsId = '0x60f67df9b1f934013b3a4466d1eed5694622a4d07' -- t=4sG3KOHtwTwmyHGHtx-2nzHwK7_NqlBhdhMfeiRC9Lc`;
  const failures = [
    wranglerFailure(1, `✘ [ERROR] no such table: news_email_sends: SQLITE_ERROR\n  ${query}`),
    wranglerFailure(1, `✘ [ERROR] A request to the Cloudflare API failed.\n  ${query}`),
  ];
  expect(failures).toEqual(["wrangler exit 1: no such table: news_email_sends", "wrangler exit 1"]);
  for (const failure of failures) expect(failure).not.toMatch(/example\.com|0x60f67|4sG3KOH|player/);
});

it("leaves out a player who comes back while the run is going, by the latest confirmed activity", async () => {
  const { run, cameBack, delivered } = world();
  const counts = await run(deliveries, { duringPause: () => cameBack.add("0xc") });
  expect(counts).toMatchObject({ sent: 2, cameBack: 1 });
  expect(delivered).toEqual(["0xa", "0xb"]);
});

it("counts away from the visit record's first full hour while the record is younger than a day", () => {
  expect(awaySince(NOW, RECORDED)).toBe(SINCE);
  expect(awaySince(NOW, null)).toBeNull();
  // The record began 11 hours before the send: every visit from 10 hours before is in it.
  const began = NOW - 11 * HOUR;
  expect(awaySince(NOW, began)).toBe(NOW - 10 * HOUR);
  // Seeded before the record began, and an action 20 hours ago: away since the record could see.
  const founder = account({ ticket: "regular", inSeason: true, lastVisit: began - 60, lastAction: NOW - 20 * HOUR });
  expect(variantOf(founder, NOW, began)).toBe("D");
  expect(variantOf({ ...founder, lastVisit: began + 60 }, NOW, began)).toBeNull();
  expect(variantOf({ ...founder, lastAction: NOW - 9 * HOUR }, NOW, began)).toBeNull();
  expect(variantOf(account({ playtester: true, lastVisit: began - 60 }), NOW, began)).toBe("P");
  // In the record's first hour a visit may be missing from it: nobody is away, N still gets its email.
  expect(awaySince(NOW, NOW - HOUR / 2)).toBeNull();
  expect(variantOf(founder, NOW, NOW - HOUR / 2)).toBeNull();
  expect(variantOf(account({ ticket: "golden" }), NOW, NOW - HOUR / 2)).toBe("N");
});
