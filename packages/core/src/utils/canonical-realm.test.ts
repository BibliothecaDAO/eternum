import { describe, expect, it } from "vitest";
import { getCanonicalRealmMetadata } from "./canonical-realm";

describe("canonical settlement metadata", () => {
  it("loads the same named resource traits as the contract's canonical examples", async () => {
    expect(await getCanonicalRealmMetadata(1)).toEqual({ name: "Stolsli", resources: ["Stone", "Coal"] });
    expect(await getCanonicalRealmMetadata(87)).toEqual({ name: "Gislegob", resources: ["Coal"] });
  }, 30_000);
  it.each([0, 8001, 1.5, Number.NaN])("rejects an invalid realm number %s", async (id) => {
    await expect(getCanonicalRealmMetadata(id)).rejects.toThrow("realm number");
  });
});
