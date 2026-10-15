import { describe, expect, it } from "vitest";

import { SPECTATOR_STEPS } from "./steps.mjs";

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
