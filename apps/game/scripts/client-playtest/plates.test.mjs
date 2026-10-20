import { describe, expect, it } from "vitest";

import { judgePlates } from "./plates.mjs";

/** A reading of one view as the probe returns it: every label's rectangle, and its thing as the renderer placed it. */
const reading = (things, fields = {}) => ({
  world: true,
  labels: things.filter((thing) => thing.kind !== "order line").length,
  opened: 0,
  tokens: things.filter((thing) => thing.kind === "token").length,
  orderLine: null,
  overlaps: [],
  crowded: [],
  takers: 0,
  caught: [],
  things,
  ...fields,
});
/** An army's token, 74 × 50 at (100, 100): its foot at y 150. */
const token = (key, over) => ({ kind: "token", key, text: "T1 500", x: 100, y: 100, w: 74, h: 50, over });
/** Its army as drawn: its tile at (137, 200), its top at y 160 (10px under the foot), its label point at y 150. */
const army = { tile: { x: 137, y: 200 }, top: { x: 137, y: 160 }, point: { x: 137, y: 150 } };

describe("the live anchor gate (review-token-anchor-1: missing evidence never passes)", () => {
  it("passes a label measured over its thing", () => {
    expect(judgePlates(reading([token("army:1", army)]))).toMatchObject({ status: "completed" });
  });

  it("fails a label that reaches down onto its thing", () => {
    const below = { ...army, top: { x: 137, y: 130 } };
    expect(judgePlates(reading([token("army:1", below)])).reason).toBe("1 labels stand on their thing or away from it");
  });

  it("blocks a label whose thing was not read, alone or beside measured ones", () => {
    expect(judgePlates(reading([token("army:1", null)]))).toMatchObject({
      status: "blocked",
      reason: "1 of 1 labels not measured against their thing",
    });
    const mixed = judgePlates(reading([token("army:1", army), { ...token("army:2", undefined), x: 300 }]));
    expect(mixed).toMatchObject({ status: "blocked", reason: "1 of 2 labels not measured against their thing" });
    expect(mixed.unmeasured).toEqual(["army:2"]);
  });

  it("blocks a partial or non-finite reading of a thing", () => {
    const partial = { tile: army.tile, top: army.top };
    expect(judgePlates(reading([token("army:1", partial)])).status).toBe("blocked");
    const nowhere = { ...army, top: { x: Number.NaN, y: 160 } };
    expect(judgePlates(reading([token("army:1", nowhere)])).status).toBe("blocked");
  });

  it("blocks a page that reports no world at all", () => {
    expect(judgePlates(reading([token("army:1", null)], { world: false })).reason).toBe(
      "the page does not report its world (window.__gameRenderer): no label measured against its thing",
    );
  });

  it("does not ask the order line for a thing: it names none", () => {
    const line = { kind: "order line", text: "Attack", x: 400, y: 400, w: 80, h: 40 };
    expect(judgePlates(reading([token("army:1", army), line])).status).toBe("completed");
  });

  it("still fails a real fault before it blocks on missing evidence", () => {
    const overlapping = reading([token("army:1", null)], { overlaps: [{ a: "T1 500", b: "T2 300", gap: -4 }] });
    expect(judgePlates(overlapping).status).toBe("failed");
  });
});
