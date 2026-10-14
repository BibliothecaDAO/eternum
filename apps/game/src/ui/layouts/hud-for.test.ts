import { describe, expect, it } from "vitest";
import { hudFor } from "./hud-for";

describe("a game's HUD", () => {
  it("is Frontier's own in a Frontier game, and never War room with its deploy modal, rules known or not", () => {
    expect(hudFor("frontier", true)).toBe("frontier");
    expect(hudFor("frontier", false)).toBe("none");
  });

  it("is War room in Blitz and in Eternum", () => {
    expect(hudFor("blitz", false)).toBe("war-room");
    expect(hudFor("eternum", true)).toBe("war-room");
  });
});
