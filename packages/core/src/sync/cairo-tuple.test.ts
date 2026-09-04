import { describe, expect, it } from "vitest";

import { cairoTupleMembers } from "./cairo-tuple";

describe("cairoTupleMembers", () => {
  it("reads starknet.js numeric-key tuple records in member order", () => {
    expect(cairoTupleMembers({ 0: "0xa", 1: "0x1388" }, 2)).toEqual(["0xa", "0x1388"]);
  });

  it.each([
    [["0xa", "0x1388"]],
    [{ value: ["0xa", "0x1388"] }],
    [{ 0: "0xa" }],
    [{ 0: "0xa", 1: "0x1388", 2: "extra" }],
    [{ 0: "0xa", 2: "0x1388" }],
  ])("rejects values outside the Herald tuple wire shape", (value) => {
    expect(() => cairoTupleMembers(value, 2)).toThrow("Cairo tuple must contain 2 numeric-key members");
  });
});
