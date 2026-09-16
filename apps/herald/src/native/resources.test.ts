import { describe, expect, it } from "vitest";
import { manifest, receipt, schema, setup } from "./fixtures";

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

  it("keeps full-width allowances and removes revoked approvals", () => {
    const { native, fold } = setup();
    const keys = ["1", "7", "8", "2"];
    native.applyReceipt(
      fold,
      receipt([resourceEvent("ResourceAllowance", keys, [(2n ** 128n - 1n).toString()])]),
      10,
      0,
    );
    expect(BigInt(fold.modelRows("ResourceAllowance")[0].value.amount as string)).toBe(2n ** 128n - 1n);
    native.applyReceipt(fold, receipt([resourceEvent("ResourceAllowance", keys)]), 11, 0);
    expect(fold.modelRows("ResourceAllowance")).toEqual([]);
  });
});
