import { describe, expect, test } from "bun:test";
import { resolveCommonAddressKeys } from "./commands.js";

describe("resolveCommonAddressKeys", () => {
  test("writes both the legacy and canonical ledger keys", () => {
    expect(resolveCommonAddressKeys("Collectibles: Realms: Loot Chest")).toEqual([
      "Collectibles: Realms: Loot Chest",
      "lootChests",
    ]);
    expect(resolveCommonAddressKeys("Collectibles: Realms: Elite Invite")).toEqual([
      "Collectibles: Realms: Elite Invite",
      "eliteInvite",
    ]);
    expect(resolveCommonAddressKeys("Collectibles: Realms: Cosmetic Items")).toEqual([
      "Collectibles: Realms: Cosmetic Items",
      "cosmetics",
    ]);
  });

  test("keeps unrelated collectible names unchanged", () => {
    expect(resolveCommonAddressKeys("Collectibles: Timelock Maker")).toEqual(["Collectibles: Timelock Maker"]);
  });
});
