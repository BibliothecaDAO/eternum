import { describe, expect, it } from "vitest";
import schemaJson from "../../../../contracts/l3/world-native/schema/schema.json";
import type { NativeMember, NativeSchema } from "./schema";
import { decodeMembers } from "./serde";

const schema = schemaJson as unknown as NativeSchema;

describe("native member decoding", () => {
  it("decodes successive rows and member updates without retaining earlier values", () => {
    const members = [{ name: "balance", type: "core::integer::u128" }];
    const first = decodeMembers(schema, members, ["7"]);
    expect(decodeMembers(schema, [...members], ["11"])).toEqual({ balance: 11n });
    expect(first).toEqual({ balance: 7n });
    expect(decodeMembers(schema, [{ ...members[0], name: "amount" }], ["13"])).toEqual({ amount: 13n });
  });

  it("validates every frame after the layout has already decoded a valid row", () => {
    const members = [{ name: "count", type: "core::integer::u8" }];
    expect(decodeMembers(schema, members, ["7"])).toEqual({ count: 7n });
    expect(() => decodeMembers(schema, members, ["256"])).toThrow("exceeds");
    expect(() => decodeMembers(schema, members, [])).toThrow("Truncated");
    expect(() => decodeMembers(schema, members, ["1", "2"])).toThrow("trailing");
    expect(decodeMembers(schema, members, ["9"])).toEqual({ count: 9n });
  });

  it("keeps different member types and member order distinct", () => {
    const narrow = [{ name: "count", type: "core::integer::u8" }];
    const wide = [{ name: "count", type: "core::integer::u32" }];
    expect(decodeMembers(schema, narrow, ["1"])).toEqual({ count: 1n });
    expect(decodeMembers(schema, wide, ["256"])).toEqual({ count: 256n });
    const members: NativeMember[] = [narrow[0], { name: "other", type: "core::integer::u8" }];
    expect(decodeMembers(schema, members, ["2", "3"])).toEqual({ count: 2n, other: 3n });
    expect(decodeMembers(schema, [...members].reverse(), ["2", "3"])).toEqual({ other: 2n, count: 3n });
  });

  it("uses each release's definition of the same named type", () => {
    const type = "test::VersionedRow";
    const release = (name: string): NativeSchema => ({
      ...schema,
      types: {
        ...schema.types,
        [type]: { type: "struct", name: type, members: [{ name, type: "core::integer::u32" }] },
      },
    });
    const oldSchema = release("old_value");
    const newSchema = release("new_value");
    const members = [{ name: "row", type }];
    expect(decodeMembers(oldSchema, members, ["5"])).toEqual({ row: { old_value: 5n } });
    expect(decodeMembers(newSchema, members, ["8"])).toEqual({ row: { new_value: 8n } });
    expect(decodeMembers(oldSchema, members, ["9"])).toEqual({ row: { old_value: 9n } });
  });
});
