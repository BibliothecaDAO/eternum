import { describe, expect, it } from "vitest";
import { hash } from "starknet";
import { schema, manifest, receipt, setup } from "./fixtures";

function nameEvent(address: string, name: string) {
  const model = schema.models.find((model) => model.name === "AddressName")!;
  const event = schema.domains.structures.events.find((event) => event.name === "RowSet" && event.prefix.length === 1)!;
  return {
    from_address: manifest.world.address,
    keys: [...event.prefix, "0x1", model.identity],
    data: ["0x1", address, "0x1", name],
  };
}

describe("native account names", () => {
  it("replaces one deployment-global account fact and preserves an explicit zero", () => {
    const { native, fold } = setup();
    for (const [index, name] of ["0x123", "0x456", "0x0"].entries()) {
      native.applyReceipt(fold, receipt([nameEvent("0x111", name)]), 10, index);
      const rows = fold.modelRows("AddressName");
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toEqual({ address: "0x111", name });
      expect(BigInt(rows[0].key)).toBe(BigInt(hash.computePoseidonHashOnElements(["0x111"])));
    }
  });
});
