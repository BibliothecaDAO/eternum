import { describe, expect, it } from "vitest";

import { SPECTATOR_STEPS, STEP_SETS } from "./steps.mjs";

const onTheMap = { scene: "map", rendered: "map", place: "Map", dialogs: [], pressed: [] };
const verifyOf = (name) => SPECTATOR_STEPS.find((step) => step.name === name).verify;

describe("the zoom step", () => {
  const verify = verifyOf("zoom");

  it("completes when the camera distance grew from where it was, then shrank", () => {
    expect(verify({ seen: onTheMap, played: { before: 20, zoomedOut: 45, zoomedIn: 11.86 } }).status).toBe("completed");
  });

  it("fails a zoom out that did nothing, even when the zoom in moved", () => {
    expect(verify({ seen: onTheMap, played: { before: 20, zoomedOut: 20, zoomedIn: 10 } }).status).toBe("failed");
  });

  it("fails when the starting distance was never read", () => {
    expect(verify({ seen: onTheMap, played: { before: null, zoomedOut: 45, zoomedIn: 11 } }).status).toBe("failed");
  });

  it("fails off the map, whatever the distances", () => {
    const onTheRealm = { ...onTheMap, scene: "hex", rendered: "hex", place: "Realm" };
    expect(verify({ seen: onTheRealm, played: { before: 20, zoomedOut: 45, zoomedIn: 11 } }).status).toBe("failed");
  });
});

describe("a scene check", () => {
  const verify = verifyOf("open-map");

  it("fails a route on the map with Map lit while the realm is still drawn", () => {
    const realmDrawnUnderTheMapRoute = { ...onTheMap, rendered: "hex" };
    expect(verify({ seen: realmDrawnUnderTheMapRoute })).toMatchObject({
      status: "failed",
      reason: expect.stringContaining("hex drawn"),
    });
  });
});

describe("the ownership-ring steps", () => {
  const ringStep = (name) => STEP_SETS["ownership-rings"].find((step) => step.name === name).verify;
  const ownRealm = { id: 1, owner: "0xa11ce", realm: true, ownedByViewer: true };
  const selected = (structure, ringedHexes) => ({
    ...onTheMap,
    selection: { hex: { col: 4, row: 5 }, structure, ringedHexes },
  });
  const nothing = { ...onTheMap, selection: { hex: null, structure: null, ringedHexes: 0 } };

  it("completes a selected phase only on the player's own realm with its holdings ringed, keeping the ring count", () => {
    expect(ringStep("select-realm")({ seen: selected(ownRealm, 4) })).toEqual({
      status: "completed",
      selection: { hex: { col: 4, row: 5 }, structure: ownRealm, ringedHexes: 4 },
    });
    expect(ringStep("selected-idle")({ seen: selected(ownRealm, 4) }).status).toBe("completed");
  });

  it("fails a tap that selected nothing, the wrong entity, or a realm whose holdings are not ringed", () => {
    const verify = ringStep("select-realm");
    expect(verify({ seen: nothing }).reason).toBe("no structure is selected (hex null)");
    expect(verify({ seen: selected({ ...ownRealm, id: 9, ownedByViewer: false }, 2) }).reason).toBe(
      "structure 9 is selected, not the player's own realm",
    );
    expect(verify({ seen: selected({ ...ownRealm, id: 8, realm: false }, 2) }).status).toBe("failed");
    expect(verify({ seen: selected(ownRealm, 0) }).reason).toBe("the selected realm's holdings are not ringed");
  });

  it("fails an unselected phase that still holds a selection or rings, and completes a clear one", () => {
    expect(ringStep("cleared-idle")({ seen: selected(ownRealm, 4) }).reason).toBe(
      "the map still holds a selection or rings",
    );
    expect(
      ringStep("unselected-idle")({ seen: { ...nothing, selection: { ...nothing.selection, ringedHexes: 1 } } }).status,
    ).toBe("failed");
    expect(ringStep("unselected-idle")({ seen: nothing }).status).toBe("completed");
  });

  it("fails every selection phase on a page that does not report its selection", () => {
    for (const name of ["unselected-idle", "select-realm", "selected-idle", "cleared-idle"]) {
      expect(ringStep(name)({ seen: { ...onTheMap, selection: null } }).status).toBe("failed");
    }
  });
});
