import { describe, expect, it } from "vitest";
import { hudFor, hudModeOf } from "./hud-for";

describe("a game's HUD", () => {
  it("is Frontier's own in a Frontier game, and never the shared one with its deploy modal, rules known or not", () => {
    expect(hudFor("frontier", true)).toBe("frontier");
    expect(hudFor("frontier", false)).toBe("none");
    expect(hudFor("blitz", false)).toBe("shared");
    expect(hudFor("eternum", true)).toBe("shared");
  });

  it("wears its game's age: Frontier's and Eternum's own, Blitz's for a Blitz game and a duel", () => {
    expect(hudModeOf("frontier")).toBe("frontier");
    expect(hudModeOf("eternum")).toBe("eternum");
    expect(hudModeOf("blitz")).toBe("blitz");
    expect(hudModeOf("duel")).toBe("blitz");
  });
});
