import { NEUTRAL_OWNER_NAME } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { displayPlayerName } from "./entities";

describe("displayPlayerName", () => {
  it("names the zero address, the owner of every structure no player holds, the Vanguard, never Lord 0000", () => {
    expect(NEUTRAL_OWNER_NAME).toBe("The Vanguard");
    for (const zero of ["0x0", "0x000", 0n.toString()]) expect(displayPlayerName(zero, null)).toBe("The Vanguard");
    expect(displayPlayerName("0x0", "a stored name")).toBe("The Vanguard");
  });

  it("names a player by the claimed name, else Lord and the account's last four", () => {
    expect(displayPlayerName("0x52c9ab2a4a", "djizus")).toBe("djizus");
    expect(displayPlayerName("0x52c9ab2a4a", null)).toBe("Lord 2a4a");
  });
});
