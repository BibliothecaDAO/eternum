import { describe, expect, it } from "vitest";
import { toJsonValue } from "../model-registry";
import { manifest, raw, receipt, schema, setup, rowEvent, seedDerivedRows } from "./fixtures";

describe("native structure upgrades", () => {
  it("folds projected limits and ordered costs and refuses configuration row events", () => {
    const { native, fold, decoder } = setup();
    seedDerivedRows(fold, decoder, [rowEvent("UpgradeLimits", ["1"], { realm_max: 3, village_max: 0 })]);
    seedDerivedRows(fold, decoder, [
      rowEvent("UpgradeRecipe", ["1", "1"], {
        costs: [
          { resource_type: 23, amount: 17 },
          { resource_type: 38, amount: 19 },
        ],
      }),
    ]);
    expect(fold.modelRows("UpgradeLimits")[0].value).toEqual({ game_id: "0x1", realm_max: "0x3", village_max: "0x0" });
    expect(fold.modelRows("UpgradeRecipe")[0].value).toMatchObject({
      game_id: "0x1",
      level: "0x1",
      costs: [
        { resource_type: "0x17", amount: "0x11" },
        { resource_type: "0x26", amount: "0x13" },
      ],
    });
    expect(() =>
      native.applyReceipt(
        fold,
        receipt([
          rowEvent("UpgradeLimits", ["2"], { realm_max: 1n, village_max: 0n }),
          rowEvent("UpgradeRecipe", ["2", "1"], { costs: [{ resource_type: 23, amount: 17 }] }),
        ]),
        11,
        0,
      ),
    ).toThrow("derived-only from preset");
    expect(fold.modelRows("UpgradeLimits")).toHaveLength(1);
    expect(fold.modelRows("UpgradeRecipe")).toHaveLength(1);
  });

  it("decodes the upgrade story without retaining history as current state", () => {
    const { decoder, fold } = setup();
    const event = schema.games.events.find((event) => event.name === "StoryEvent")!;
    const decoded = decoder.decode(
      raw({
        from_address: manifest.world.address,
        keys: [...event.prefix, "1", "1", "7", "0", "0", "0x111", "0", "3", "0x55"],
        data: ["1", "2", "1860"],
      }),
    );
    expect(decoded.kind).toBe("event");
    if (decoded.kind !== "event") throw new Error("Expected history event");
    expect(toJsonValue(decoded.value)).toMatchObject({
      timestamp: "0x744",
      story: { StructureLevelUpStory: { new_level: "0x2" } },
    });
    expect(fold.retainedRowCount()).toBe(0);
  });
});
