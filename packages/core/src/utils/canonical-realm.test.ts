import { describe, expect, it } from "vitest";
import { getCanonicalRealmMetadata } from "./canonical-realm";

describe("canonical settlement metadata", () => {
  it("loads the same named resource traits as the contract's canonical examples", async () => {
    // Realm 1 is of the Order of Giants (order 1).
    expect(await getCanonicalRealmMetadata(1)).toEqual({ name: "Stolsli", order: 1, resources: ["Stone", "Coal"] });
    expect(await getCanonicalRealmMetadata(87)).toMatchObject({ name: "Gislegob", resources: ["Coal"] });
  }, 30_000);
  it.each([0, 8001, 1.5, Number.NaN])("rejects an invalid realm number %s", async (id) => {
    await expect(getCanonicalRealmMetadata(id)).rejects.toThrow("realm number");
  });
});
