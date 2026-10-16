import { displayPlayerName } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";
import { resolveOwnerDisplayName } from "./owner-display-name";

describe("resolveOwnerDisplayName", () => {
  it("names a structure no player holds the Vanguard, whatever name came with it", () => {
    expect(resolveOwnerDisplayName("", 0n)).toBe("The Vanguard");
    expect(resolveOwnerDisplayName("Alice", 0n)).toBe("The Vanguard");
  });

  it("names a player by the claimed name, else Lord and the account's last four", () => {
    expect(resolveOwnerDisplayName("Alice\0\0 ", 0x52c9n)).toBe("Alice");
    expect(resolveOwnerDisplayName("", 0x52c9n)).toBe("Lord 52c9");
  });

  it("shows only a cleaned name, or nothing, while the owner's address is unknown", () => {
    expect(resolveOwnerDisplayName(" Alice\0", undefined)).toBe("Alice");
    expect(resolveOwnerDisplayName(undefined, undefined)).toBe("");
  });

  it("agrees with the one owner rule for every known owner", () => {
    for (const [name, address] of [
      ["", 0n],
      ["Alice", 0n],
      ["Alice", 0x52c9n],
      ["", 0x52c9n],
    ] as const)
      expect(resolveOwnerDisplayName(name, address)).toBe(displayPlayerName(address.toString(), name || null));
  });
});
