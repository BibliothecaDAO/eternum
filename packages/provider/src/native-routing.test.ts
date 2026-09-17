import { describe, expect, it } from "vitest";
import { getContractByName } from "./index";
import schema from "../../../contracts/l3/world-native/schema/schema.json";

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
    expect(() => getContractByName(manifest, "s2-undeclared_commands")).toThrow("not declared in the native manifest");
  });

  it.each([
    "production_systems",
    "blitz_realm_systems",
    "village_systems",
    "bitcoin_mine_systems",
    "trade_systems",
    "swap_systems",
    "liquidity_systems",
    "faith_systems",
    "guild_systems",
  ])("routes %s through the generated season command surface", (system) => {
    const manifest = {
      native: { version: 1 },
      world: { address: "0x101" },
      contracts: [{ address: "0x101", systems: schema.domains.season.systems }],
    } as unknown as Parameters<typeof getContractByName>[0];
    expect(getContractByName(manifest, `s2-${system}`)).toBe("0x101");
  });
});
