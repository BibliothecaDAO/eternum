import { describe, expect, it } from "vitest";
import { getScopedGameId, setGameScope } from "./game-scope";

describe("active game scope", () => {
  it("updates the selected game without carrying a previous game's identity", () => {
    setGameScope(7);
    expect(getScopedGameId()).toBe(7);
    setGameScope(8);
    expect(getScopedGameId()).toBe(8);
  });
});
