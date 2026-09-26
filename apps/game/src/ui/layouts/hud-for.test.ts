import { describe, expect, it } from "vitest";
import { hudFor } from "./hud-for";

describe("a game's HUD", () => {
  it("is Frontier's own in a Frontier game, and never the shared one with its deploy modal, rules known or not", () => {
    expect(hudFor("frontier", true)).toBe("frontier");
    expect(hudFor("frontier", false)).toBe("none");
    expect(hudFor("blitz", false)).toBe("shared");
    expect(hudFor("eternum", true)).toBe("shared");
  });
});
