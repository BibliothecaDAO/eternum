import { shortString } from "starknet";
import { describe, expect, it } from "vitest";

import { resolvePlayerName, resolvePlayerNameFelt } from "./player-name";

describe("player name", () => {
  it("keeps a valid preferred name", () => {
    expect(resolvePlayerName("0x123456", " Alice ")).toBe("Alice");
  });

  it("derives a stable name from the gameplay address", () => {
    expect(resolvePlayerName("0x123456789abc")).toBe("Player-789abc");
    expect(shortString.decodeShortString(resolvePlayerNameFelt("0x123456789abc"))).toBe("Player-789abc");
  });

  it("keeps preferred names within the short-string limit", () => {
    expect(resolvePlayerName("0x123456789abc", "a".repeat(40))).toBe("a".repeat(31));
  });
});
