import { describe, expect, it } from "vitest";
import { getScopedGameId, namespaceForChain, setGameScope } from "./game-scope";

describe("active game scope", () => {
  it("updates the selected game without carrying a previous game's identity", () => {
    setGameScope("s2", 7);
    expect(getScopedGameId()).toBe(7);
    setGameScope("s2", 8);
    expect(getScopedGameId()).toBe(8);
  });
  it("uses the deployment namespace on both chains", () => {
    expect(namespaceForChain("appchain")).toBe("s2");
    expect(namespaceForChain("madara")).toBe("s2");
  });
});
