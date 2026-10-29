import { describe, expect, it } from "vitest";
import { canonicalRealm } from "./canonical-realm";

describe("canonical settlement metadata", () => {
  it("reads the same named resource traits as the contract's canonical examples", () => {
    // Realm 1 is of the Order of Giants (order 1).
    expect(canonicalRealm(1)).toEqual({ name: "Stolsli", order: 1, resources: ["Stone", "Coal"] });
    expect(canonicalRealm(87)).toEqual({ name: "Gislegob", order: 5, resources: ["Coal"] });
    expect(canonicalRealm(8000).name).not.toBe("");
  });
  it.each([0, 8001, 1.5, Number.NaN])("rejects an invalid realm number %s", (id) => {
    expect(() => canonicalRealm(id)).toThrow("realm number");
  });
});
