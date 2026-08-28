import { describe, expect, it } from "vitest";

import { StoreLayout } from "./store-layout";
import type { ManifestAbiEntry } from "./types";

const OPTION_ADDRESS = "core::option::Option::<core::starknet::contract_address::ContractAddress>";

const abi: ManifestAbiEntry[] = [
  {
    type: "enum",
    name: OPTION_ADDRESS,
    variants: [
      { name: "Some", type: "core::starknet::contract_address::ContractAddress" },
      { name: "None", type: "()" },
    ],
  },
  {
    type: "enum",
    name: "s2::Side",
    variants: [
      { name: "Left", type: "()" },
      { name: "Right", type: "()" },
    ],
  },
];

describe("StoreLayout enums", () => {
  const layout = new StoreLayout(abi);

  it("reads event messages as Cairo serde: zero-based enums, Option Some = 0 / None = 1", () => {
    expect(layout.normalizeMembers([{ name: "owner", type: OPTION_ADDRESS }], ["0x0", "0xabc"], "serde")).toEqual([
      "0x0",
      "0xabc",
    ]);
    expect(layout.normalizeMembers([{ name: "owner", type: OPTION_ADDRESS }], ["0x1"], "serde")).toEqual(["0x1"]);
    expect(layout.normalizeMembers([{ name: "side", type: "s2::Side" }], ["0x0"], "serde")).toEqual(["0x0"]);
    expect(layout.normalizeMembers([{ name: "side", type: "s2::Side" }], ["0x1"], "serde")).toEqual(["0x1"]);
  });

  it("reads store records with Dojo's one-based enum selectors", () => {
    expect(layout.normalizeMembers([{ name: "side", type: "s2::Side" }], ["0x1"], "store")).toEqual(["0x0"]);
    expect(layout.normalizeMembers([{ name: "side", type: "s2::Side" }], ["0x2"], "store")).toEqual(["0x1"]);
    expect(() => layout.normalizeMembers([{ name: "side", type: "s2::Side" }], ["0x0"], "store")).toThrow(
      /invalid selector/,
    );
  });
});
