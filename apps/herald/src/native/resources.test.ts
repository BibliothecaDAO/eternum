import { describe, expect, it } from "vitest";
import { toJsonValue } from "../model-registry";
import { manifest, raw, seedDerivedRows, receipt, schema, setup, rowEvent } from "./fixtures";

function resourceEvent(name: string, keys: string[], values?: Record<string, unknown>) {
  if (values) return rowEvent(name, keys, values);
  const model = schema.models.find((model) => model.name === name)!;
  const kind = values ? "RowSet" : "RowDeleted";
  const event = schema.games.events.find((event) => event.name === kind)!;
  return {
    from_address: manifest.world.address,
    keys: [...event.prefix, "1", model.identity],
    data: [String(keys.length), ...keys],
  };
}

describe("native resource facts", () => {
  it("folds partial arrivals and balances together, then removes only the consumed slot", () => {
    const { native, fold } = setup();
    native.applyReceipt(
      fold,
      receipt([
        resourceEvent("ResourceArrival", ["1", "7", "0", "1"], {
          resources: [
            { resource_type: 2n, amount: 10n },
            { resource_type: 3n, amount: 20n },
          ],
        }),
        resourceEvent("ResourceArrival", ["1", "7", "0", "2"], { resources: [{ resource_type: 2n, amount: 30n }] }),
        resourceEvent("ResourceBalance", ["2", "7", "2"], { balance: 99n }),
      ]),
      10,
      0,
    );
    native.applyReceipt(
      fold,
      receipt([
        resourceEvent("ResourceBalance", ["1", "7", "2"], { balance: 10n }),
        resourceEvent("ResourceArrival", ["1", "7", "0", "1"], { resources: [{ resource_type: 3n, amount: 20n }] }),
      ]),
      11,
      0,
    );
    expect(fold.modelRows("ResourceArrival").find((row) => row.value.slot === "0x1")?.value.resources).toEqual([
      { resource_type: "0x3", amount: "0x14" },
    ]);
    native.applyReceipt(
      fold,
      receipt([
        resourceEvent("ResourceBalance", ["1", "7", "3"], { balance: 20n }),
        resourceEvent("ResourceArrival", ["1", "7", "0", "1"]),
      ]),
      12,
      0,
    );
    expect(fold.modelRows("ResourceArrival").map((row) => row.value.slot)).toEqual(["0x2"]);
    expect(fold.modelRows("ResourceBalance")).toHaveLength(3);
    expect(fold.modelRows("ResourceBalance").find((row) => row.value.game_id === "0x2")?.value.balance).toBe("0x63");
  });

  it("rejects malformed arrivals without exposing a partial resource mutation", () => {
    const { native, fold } = setup();
    const balance = resourceEvent("ResourceBalance", ["1", "7", "2"], { balance: 10n });
    const arrival = resourceEvent("ResourceArrival", ["1", "7", "0", "1"], {
      resources: [{ resource_type: 2n, amount: 10n }],
    });
    const invalid = { ...arrival, data: ["4", "1", "7", "0", "1", "3", "2", "2", "10"] };
    expect(() => native.applyReceipt(fold, receipt([balance, invalid]), 10, 0)).toThrow();
    expect(fold.retainedRowCount()).toBe(0);
  });
});

describe("native production facts", () => {
  it("folds recipe arrays and full-width bonus end ticks without evaluating them at delivery time", () => {
    const { native, fold, decoder } = setup();
    native.applyReceipt(
      fold,
      receipt(
        seedDerivedRows(fold, decoder, [
          resourceEvent("ProductionRecipe", ["1", "26"], {
            simple_output: 100n,
            complex_output: 200n,
            simple_inputs: [{ resource_type: 23n, amount: 10n }],
            complex_inputs: [
              { resource_type: 35n, amount: 20n },
              { resource_type: 36n, amount: 30n },
            ],
          }),
          resourceEvent("ProductionBonus", ["1", "7"], {
            incr_resource_rate_percent_num: 65535n,
            incr_labor_rate_percent_num: 2500n,
            incr_troop_rate_percent_num: 5000n,
            incr_resource_rate_end_tick: 4294967295n,
            incr_labor_rate_end_tick: 31n,
            incr_troop_rate_end_tick: 32n,
          }),
        ]),
      ),
      10,
      0,
    );
    expect(fold.modelRows("ProductionRecipe")[0].value).toMatchObject({
      game_id: "0x1",
      resource_type: "0x1a",
      simple_output: "0x64",
      complex_output: "0xc8",
      simple_inputs: [{ resource_type: "0x17", amount: "0xa" }],
      complex_inputs: [
        { resource_type: "0x23", amount: "0x14" },
        { resource_type: "0x24", amount: "0x1e" },
      ],
    });
    expect(fold.modelRows("ProductionBonus")[0].value).toMatchObject({
      incr_resource_rate_percent_num: "0xffff",
      incr_troop_rate_percent_num: "0x1388",
      incr_resource_rate_end_tick: "0xffffffff",
      incr_troop_rate_end_tick: "0x20",
    });
  });

  it("rejects a truncated production recipe atomically with its accompanying balance", () => {
    const { native, fold } = setup();
    const recipe = rowEvent("ProductionRecipe", ["1", "26"], {
      simple_output: 100,
      complex_output: 200,
      simple_inputs: [{ resource_type: 23, amount: 10 }],
      complex_inputs: [{ resource_type: 35, amount: 20 }],
    });
    const bonus = rowEvent("ProductionBonus", ["1", "7"], {
      incr_resource_rate_percent_num: 0,
      incr_labor_rate_percent_num: 0,
      incr_troop_rate_percent_num: 1,
      incr_resource_rate_end_tick: 0,
      incr_labor_rate_end_tick: 0,
      incr_troop_rate_end_tick: 31,
    });
    const invalidBonus = bonus.data.map((felt, index) => (index === bonus.data.length - 4 ? "65536" : felt));
    for (const invalid of [
      { ...recipe, data: recipe.data.slice(0, -1) },
      { ...bonus, data: invalidBonus },
    ]) {
      expect(() =>
        native.applyReceipt(
          fold,
          receipt([resourceEvent("ResourceBalance", ["1", "7", "23"], { balance: 90n }), invalid]),
          10,
          0,
        ),
      ).toThrow();
      expect(fold.retainedRowCount()).toBe(0);
    }
  });

  it("decodes the refill story as history without retaining a second copy of production state", () => {
    const { decoder, fold } = setup();
    const event = schema.games.events.find((event) => event.name === "StoryEvent")!;
    const decoded = decoder.decode(
      raw({
        from_address: manifest.world.address,
        keys: [...event.prefix, "1", "1", "7", "0", "0", "0x111", "0", "3", "0x55"],
        data: ["7", "26", "125", "2", "23", "10", "35", "20", "1920"],
      }),
    );
    expect(decoded.kind).toBe("event");
    if (decoded.kind !== "event") throw new Error("Expected production history event");
    expect(toJsonValue(decoded.value)).toMatchObject({
      timestamp: "0x780",
      story: {
        ProductionStory: {
          received_resource_type: "0x1a",
          received_amount: "0x7d",
          cost: [
            { resource_type: "0x17", amount: "0xa" },
            { resource_type: "0x23", amount: "0x14" },
          ],
        },
      },
    });
    expect(fold.retainedRowCount()).toBe(0);
  });
});

describe("native building facts", () => {
  it("decodes building changes and payments as history without creating current-state rows", () => {
    const { decoder, fold } = setup();
    const event = schema.games.events.find((event) => event.name === "StoryEvent")!;
    const decode = (data: string[]) => {
      const decoded = decoder.decode(
        raw({
          from_address: manifest.world.address,
          keys: [...event.prefix, "1", "1", "7", "0", "0", "0x111", "0", "3", "0x55"],
          data,
        }),
      );
      if (decoded.kind !== "event") throw new Error("Expected building history event");
      return toJsonValue(decoded.value);
    };
    expect(decode(["8", "0", "11", "10", "37", "1", "1920"])).toMatchObject({
      story: {
        BuildingPlacementStory: { coord: { alt: false, x: "0xb", y: "0xa" }, category: "0x25", change: "Destroyed" },
      },
    });
    expect(decode(["9", "0", "11", "10", "37", "1", "23", "100", "1920"])).toMatchObject({
      story: { BuildingPaymentStory: { category: "0x25", cost: [{ resource_type: "0x17", amount: "0x64" }] } },
    });
    expect(fold.retainedRowCount()).toBe(0);
  });
  const keys = ["1", "7", "11", "10"];
  it("folds building placement, pause and deletion with resource changes in one receipt", () => {
    const { native, fold } = setup();
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("Building", keys, { category: 37, paused: false, labor_paid: 0n, tier: 1 }),
        resourceEvent("ResourceBalance", ["1", "7", "23"], { balance: 90n }),
      ]),
      10,
      0,
    );
    expect(fold.modelRows("Building")[0].value).toMatchObject({
      category: "0x25",
      structure_id: "0x7",
      paused: false,
    });
    expect(fold.modelRows("Building")[0].value).not.toHaveProperty("entity_id");
    expect(fold.modelRows("Building")[0].value).not.toHaveProperty("bonus_percent");
    native.applyReceipt(
      fold,
      receipt([
        rowEvent("Building", keys, { category: 37, paused: true, labor_paid: 0n, tier: 1 }),
        resourceEvent("ResourceBalance", ["1", "7", "35"], { balance: 60n }),
      ]),
      11,
      0,
    );
    expect(fold.modelRows("Building")[0].value.paused).toBe(true);
    native.applyReceipt(
      fold,
      receipt([resourceEvent("Building", keys), resourceEvent("ResourceBalance", ["1", "7", "35"], { balance: 120n })]),
      12,
      0,
    );
    expect(fold.modelRows("Building")).toEqual([]);
    expect(fold.modelRows("ResourceBalance").find((row) => row.value.resource_type === "0x23")?.value.balance).toBe(
      "0x78",
    );
  });
  it("rejects a malformed building without publishing the accompanying balance", () => {
    const { native, fold } = setup();
    const building = rowEvent("Building", keys, { category: 37, paused: false, labor_paid: 0, tier: 1 });
    expect(() =>
      native.applyReceipt(
        fold,
        receipt([
          resourceEvent("ResourceBalance", ["1", "7", "23"], { balance: 90n }),
          { ...building, data: building.data.slice(0, -1) },
        ]),
        10,
        0,
      ),
    ).toThrow();
    expect(fold.retainedRowCount()).toBe(0);
  });
});
