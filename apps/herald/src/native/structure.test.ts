import { describe, expect, it } from "vitest";
import { toJsonValue } from "../model-registry";
import { manifest, raw, receipt, schema, setup } from "./fixtures";

function ruleEvent(name: string, keys: string[], values: string[]) {
  const model = schema.models.find((model) => model.name === name)!;
  const event = schema.domains.season.events.find((event) => event.name === "RowSet")!;
  return {
    from_address: manifest.native.domains.season.address,
    keys: [...event.prefix, "1", model.identity],
    data: [String(keys.length), ...keys, String(values.length), ...values],
  };
}

describe("native structure upgrades", () => {
  it("folds immutable limits and ordered costs together and rejects partial recipes atomically", () => {
    const { native, fold } = setup();
    native.applyReceipt(
      fold,
      receipt([
        ruleEvent("UpgradeLimits", ["1"], ["3", "0"]),
        ruleEvent("UpgradeRecipe", ["1", "1"], ["2", "23", "17", "38", "19"]),
      ]),
      10,
      0,
    );
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
          ruleEvent("UpgradeLimits", ["2"], ["1", "0"]),
          ruleEvent("UpgradeRecipe", ["2", "1"], ["2", "23", "17"]),
        ]),
        11,
        0,
      ),
    ).toThrow();
    expect(fold.modelRows("UpgradeLimits")).toHaveLength(1);
    expect(fold.modelRows("UpgradeRecipe")).toHaveLength(1);
  });

  it("decodes the upgrade story without retaining history as current state", () => {
    const { decoder, fold } = setup();
    const event = schema.domains.structures.events.find((event) => event.name === "StoryEvent")!;
    const decoded = decoder.decode(
      raw({
        from_address: manifest.native.domains.structures.address,
        keys: [...event.prefix, "1", "1", "7", "0", "0x111", "0", "3", "0x55"],
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
