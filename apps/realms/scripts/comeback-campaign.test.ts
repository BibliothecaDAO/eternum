import { expect, it } from "vitest";
import { sendCampaign, variantOf, type Account, type Delivery } from "./comeback-campaign";

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

/** A provider that delivers once per key, and the campaign's send record, as two runs of the script share them. */
const world = () => {
  const delivered = new Map<string, string>();
  const record = new Set<string>();
  const run = (deliveries: Delivery[], options: { crashAfterSend?: string; refuse?: string } = {}) =>
    sendCampaign({
      campaign: "comeback",
      deliveries,
      alreadySent: new Set(record),
      send: async (delivery, key) => {
        if (delivery.realmsId === options.refuse) return { ok: false, id: null };
        if (!delivered.has(key)) delivered.set(key, delivery.realmsId);
        return { ok: true, id: `email-${delivery.realmsId}` };
      },
      record: async (delivery) => {
        if (delivery.realmsId === options.crashAfterSend) throw new Error("crashed before the record");
        record.add(delivery.realmsId);
      },
      pause: async () => {},
    });
  return { run, delivered, record };
};
const deliveries: Delivery[] = [
  { realmsId: "0xa", variant: "D" },
  { realmsId: "0xb", variant: "N" },
  { realmsId: "0xc", variant: "P" },
];

it("sends each account once, so a second run sends nobody", async () => {
  const { run, delivered, record } = world();
  expect(await run(deliveries)).toEqual({ sent: 3, skipped: 0, refused: 0 });
  expect(await run(deliveries)).toEqual({ sent: 0, skipped: 3, refused: 0 });
  expect([...delivered.values()]).toEqual(["0xa", "0xb", "0xc"]);
  expect([...record]).toEqual(["0xa", "0xb", "0xc"]);
});

it("delivers once after a crash between the provider's acceptance and the record", async () => {
  const { run, delivered } = world();
  await expect(run(deliveries, { crashAfterSend: "0xb" })).rejects.toThrow("crashed before the record");
  expect(await run(deliveries)).toEqual({ sent: 2, skipped: 1, refused: 0 });
  expect(delivered.size).toBe(3);
});

it("stops at the first refusal and leaves the rest for the rerun", async () => {
  const { run, record } = world();
  expect(await run(deliveries, { refuse: "0xb" })).toEqual({ sent: 1, skipped: 0, refused: 1 });
  expect([...record]).toEqual(["0xa"]);
  expect(await run(deliveries)).toEqual({ sent: 2, skipped: 1, refused: 0 });
});
