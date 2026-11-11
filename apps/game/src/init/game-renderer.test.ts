import { describe, expect, it, vi } from "vitest";

vi.mock("@/three/game-renderer", () => ({ default: class {} }));

import { mapClientDraws } from "./game-renderer";

const at = (pathname: string, search = "") => ({ pathname, search });
const SURFACE = false;
const ANOTHER_LAYER = true;

describe("mapClientDraws", () => {
  it("draws the world map's surface", () => {
    expect(mapClientDraws(at("/g/0xa1/3/map"), SURFACE)).toBe(true);
    expect(mapClientDraws(at("/g/0xa1/3/map", "?col=4&row=9&spectate=true"), SURFACE)).toBe(true);
  });

  it("leaves the realm view to the game's own renderer", () => {
    expect(mapClientDraws(at("/g/0xa1/3/hex"), SURFACE)).toBe(false);
    expect(mapClientDraws(at("/g/0xa1/3/hex", "?col=4&row=9"), SURFACE)).toBe(false);
  });

  it("leaves the Ethereal layers and the Deep to the game's own renderer, on the map as in the realm view", () => {
    expect(mapClientDraws(at("/g/0xa1/3/map"), ANOTHER_LAYER)).toBe(false);
    expect(mapClientDraws(at("/g/0xa1/3/hex"), ANOTHER_LAYER)).toBe(false);
  });

  it("draws the surface for a game that has not yet reached a scene's address", () => {
    expect(mapClientDraws(at("/g/0xa1/3"), SURFACE)).toBe(true);
    expect(mapClientDraws(at("/lab/game", "?scenario=explore"), SURFACE)).toBe(true);
  });
});
