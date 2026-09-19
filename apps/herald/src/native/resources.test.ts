import { describe, expect, it } from "vitest";
import { toJsonValue } from "../model-registry";
import { manifest, raw, receipt, schema, setup } from "./fixtures";

function resourceEvent(name: string, keys: string[], values?: string[]) {
  const model = schema.models.find((model) => model.name === name)!;
  const kind = values ? "RowSet" : "RowDeleted";
  const event = schema.domains.resources.events.find((event) => event.name === kind)!;
  return {
    from_address: manifest.native.domains.resources.address,
    keys: [...event.prefix, "1", model.identity],
    data: [String(keys.length), ...keys, ...(values ? [String(values.length), ...values] : [])],
  };
}

describe("native resource facts", () => {
  it("folds partial arrivals and balances together, then removes only the consumed slot", () => {
    const { native, fold } = setup();
    native.applyReceipt(
      fold,
      receipt([
        resourceEvent("ResourceArrival", ["1", "7", "0", "1"], ["2", "2", "10", "3", "20"]),
        resourceEvent("ResourceArrival", ["1", "7", "0", "2"], ["1", "2", "30"]),
        resourceEvent("ResourceBalance", ["2", "7", "2"], ["99"]),
      ]),
      10,
      0,
    );
    native.applyReceipt(
      fold,
      receipt([
        resourceEvent("ResourceBalance", ["1", "7", "2"], ["10"]),
        resourceEvent("ResourceArrival", ["1", "7", "0", "1"], ["1", "3", "20"]),
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
        resourceEvent("ResourceBalance", ["1", "7", "3"], ["20"]),
        resourceEvent("ResourceArrival", ["1", "7", "0", "1"]),
      ]),
      12,
      0,
    );
    expect(fold.modelRows("ResourceArrival").map((row) => row.value.slot)).toEqual(["0x2"]);
    expect(fold.modelRows("ResourceBalance")).toHaveLength(3);
    expect(fold.modelRows("ResourceBalance").find((row) => row.value.game_id === "0x2")?.value.balance).toBe("0x63");
  });

  it("rejects malformed and foreign-domain arrivals without exposing a partial resource mutation", () => {
    const { native, fold } = setup();
    const balance = resourceEvent("ResourceBalance", ["1", "7", "2"], ["10"]);
    const arrival = resourceEvent("ResourceArrival", ["1", "7", "0", "1"], ["1", "2", "10"]);
    for (const invalid of [
      { ...arrival, data: ["4", "1", "7", "0", "1", "3", "2", "2", "10"] },
      { ...arrival, from_address: manifest.native.domains.structures.address },
    ]) {
      expect(() => native.applyReceipt(fold, receipt([balance, invalid]), 10, 0)).toThrow();
      expect(fold.retainedRowCount()).toBe(0);
    }
  });
});

describe("native production facts", () => {
  it("folds recipe arrays and full-width bonus end ticks without evaluating them at delivery time", () => {
    const { native, fold } = setup();
    native.applyReceipt(
      fold,
      receipt([
        resourceEvent("ProductionRecipe", ["1", "26"], ["100", "200", "1", "23", "10", "2", "35", "20", "36", "30"]),
        resourceEvent("ProductionBonus", ["1", "7"], ["65535", "2500", "5000", "4294967295", "31", "32"]),
      ]),
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
    const bonus = resourceEvent("ProductionBonus", ["1", "7"], ["0", "0", "5000", "0", "0", "31"]);
    for (const invalid of [
      resourceEvent("ProductionRecipe", ["1", "26"], ["100", "200", "1", "23", "10", "1", "35"]),
      resourceEvent("ProductionBonus", ["1", "7"], ["0", "0", "65536", "0", "0", "31"]),
      { ...bonus, from_address: manifest.native.domains.structures.address },
    ]) {
      expect(() =>
        native.applyReceipt(
          fold,
          receipt([resourceEvent("ResourceBalance", ["1", "7", "23"], ["90"]), invalid]),
          10,
          0,
        ),
      ).toThrow();
      expect(fold.retainedRowCount()).toBe(0);
    }
  });

  it("decodes the refill story as history without retaining a second copy of production state", () => {
    const { decoder, fold } = setup();
    const event = schema.domains.resources.events.find((event) => event.name === "StoryEvent")!;
    const decoded = decoder.decode(
      raw({
        from_address: manifest.native.domains.resources.address,
        keys: [...event.prefix, "1", "1", "7", "0", "0x111", "0", "3", "0x55"],
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
    const event = schema.domains.structures.events.find((event) => event.name === "StoryEvent")!;
    const decode = (data: string[]) => {
      const decoded = decoder.decode(
        raw({
          from_address: manifest.native.domains.structures.address,
          keys: [...event.prefix, "1", "1", "7", "0", "0x111", "0", "3", "0x55"],
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
  const keys = ["1", "0", "2000", "2001", "11", "10"];
  function buildingEvent(values?: string[]) {
    const model = schema.models.find((model) => model.name === "Building")!;
    const event = schema.domains.structures.events.find((event) => event.name === (values ? "RowSet" : "RowDeleted"))!;
    return {
      from_address: manifest.native.domains.structures.address,
      keys: [...event.prefix, "1", model.identity],
      data: [String(keys.length), ...keys, ...(values ? [String(values.length), ...values] : [])],
    };
  }
  it("folds building placement, pause and deletion with resource changes in one receipt", () => {
    const { native, fold } = setup();
    native.applyReceipt(
      fold,
      receipt([buildingEvent(["37", "7", "0"]), resourceEvent("ResourceBalance", ["1", "7", "23"], ["90"])]),
      10,
      0,
    );
    expect(fold.modelRows("Building")[0].value).toMatchObject({
      category: "0x25",
      outer_entity_id: "0x7",
      paused: false,
    });
    expect(fold.modelRows("Building")[0].value).not.toHaveProperty("entity_id");
    expect(fold.modelRows("Building")[0].value).not.toHaveProperty("bonus_percent");
    native.applyReceipt(
      fold,
      receipt([buildingEvent(["37", "7", "1"]), resourceEvent("ResourceBalance", ["1", "7", "35"], ["60"])]),
      11,
      0,
    );
    expect(fold.modelRows("Building")[0].value.paused).toBe(true);
    native.applyReceipt(
      fold,
      receipt([buildingEvent(), resourceEvent("ResourceBalance", ["1", "7", "35"], ["120"])]),
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
    expect(() =>
      native.applyReceipt(
        fold,
        receipt([resourceEvent("ResourceBalance", ["1", "7", "23"], ["90"]), buildingEvent(["37", "7", "2"])]),
        10,
        0,
      ),
    ).toThrow();
    expect(fold.retainedRowCount()).toBe(0);
  });
});
