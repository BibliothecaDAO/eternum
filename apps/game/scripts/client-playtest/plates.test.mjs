import { describe, expect, it } from "vitest";

import { judgePlates } from "./plates.mjs";

/** The page's three side colours as the probe resolves them: yours green, an ally's blue, anyone else's red. */
const SIDES = { own: "rgb(102, 221, 171)", ally: "rgb(106, 168, 255)", enemy: "rgb(255, 123, 107)" };
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
  sides: SIDES,
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

describe("the side colours (owner, 2026-10-21: three sides, red for everything that is not yours or an ally's)", () => {
  const sided = (side, colours, extra = {}) => ({ ...token("army:1", army), side, colours, ...extra });

  it("passes labels drawn in their side's colour, nobody's in the enemy's red", () => {
    for (const [side, colour] of [
      ["own", SIDES.own],
      ["ally", SIDES.ally],
      ["enemy", SIDES.enemy],
      ["neutral", SIDES.enemy],
    ])
      expect(judgePlates(reading([sided(side, [colour, colour, colour])])).status).toBe("completed");
  });

  it("fails a label with any part off its side's colour, naming what it drew and wanted", () => {
    const greenBar = judgePlates(reading([sided("enemy", [SIDES.enemy, SIDES.enemy, SIDES.own])]));
    expect(greenBar).toMatchObject({ status: "failed", reason: "1 labels not drawn in their side's colour" });
    expect(greenBar.offSide).toEqual([
      { label: "T1 500", side: "enemy", colours: [SIDES.enemy, SIDES.enemy, SIDES.own], wanted: SIDES.enemy },
    ]);
    const grey = "rgb(185, 177, 161)";
    expect(judgePlates(reading([sided("neutral", [grey, grey])])).status).toBe("failed");
  });

  it("fails a page whose side colours are not three, or were not read", () => {
    const alike = { ...SIDES, ally: SIDES.own };
    expect(judgePlates(reading([sided("own", [SIDES.own])], { sides: alike })).reason).toBe(
      "the page's three side colours are not three",
    );
    expect(judgePlates(reading([sided("own", [SIDES.own])], { sides: {} })).status).toBe("failed");
  });
});
