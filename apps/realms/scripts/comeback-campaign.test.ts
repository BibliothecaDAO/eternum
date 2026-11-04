import { expect, it } from "vitest";
import {
  sendCampaign,
  variantOf,
  wranglerFailure,
  type Account,
  type Delivery,
  type Handoff,
} from "./comeback-campaign";

const TODAY = 1_000_000;
const account = (overrides: Partial<Account>): Account => ({
  realmsId: "0x1",
  discord: false,
  ticket: null,
  playtester: false,
  inSeason: false,
  lastAction: 0,
  optedOut: false,
  ...overrides,
});

it("picks each account's variant, and none for an account that stopped news emails", () => {
  const idleFounder = account({ ticket: "regular", inSeason: true, lastAction: TODAY - 1 });
  expect(variantOf(idleFounder, TODAY)).toBe("D");
  expect(variantOf({ ...idleFounder, lastAction: TODAY + 5 }, TODAY)).toBeNull();
  expect(variantOf(account({ ticket: "golden" }), TODAY)).toBe("N");
  expect(variantOf(account({ playtester: true, inSeason: true, lastAction: TODAY - 1 }), TODAY)).toBe("P");
  expect(variantOf(account({ playtester: true }), TODAY)).toBe("P");
  expect(variantOf(account({}), TODAY)).toBeNull();
  for (const stopped of [{ ...idleFounder }, account({ ticket: "golden" }), account({ playtester: true })])
    expect(variantOf({ ...stopped, optedOut: true }, TODAY)).toBeNull();
});

/**
 * The send record and the opt-out column as D1 holds them, shared by every run, and a provider that delivers every
 * email it accepts: it has no deduplication, so a second handoff is a second email.
 */
const world = () => {
  const record = new Map<string, "reserved" | "sent">();
  const optedOut = new Set<string>();
  const delivered: string[] = [];
  const run = (
    deliveries: Delivery[],
    options: { answer?: (delivery: Delivery) => Handoff; crashBeforeMark?: string; duringPause?: () => void } = {},
  ) =>
    sendCampaign({
      deliveries,
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
  return { run, record, optedOut, delivered };
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
