import { describe, expect, it } from "vitest";
import { getContractByName } from "./index";

describe("native manifest system routing", () => {
  it("uses the declared target for any system and rejects undeclared systems", () => {
    const manifest = {
      native: { version: 1 },
      world: { address: "0x101" },
      contracts: [
        { address: "0x202", systems: ["settlement_commands"] },
        { address: "0x303", systems: ["troop_management_systems"] },
      ],
    } as unknown as Parameters<typeof getContractByName>[0];
    expect(getContractByName(manifest, "s2-settlement_commands")).toBe("0x202");
    expect(getContractByName(manifest, "s2-troop_management_systems")).toBe("0x303");
    expect(() => getContractByName(manifest, "s2-undeclared_commands")).toThrow("outside the native slice");
  });
});
