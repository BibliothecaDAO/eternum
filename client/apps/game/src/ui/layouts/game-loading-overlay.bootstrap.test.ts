// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/eternum", () => ({
  Position: class MockPosition {
    constructor(private readonly coords: { x: number; y: number }) {}

    getNormalized() {
      return this.coords;
    }
  },
}));

import { resolveBootstrapGameUrl, resolvePlayerBootstrapHandoff } from "./game-loading-overlay.utils";

describe("resolveBootstrapGameUrl", () => {
  it("keeps player bootstrap on the world map until a structure is known", () => {
    expect(resolveBootstrapGameUrl({ isSpectating: false })).toBe("/play/map?col=0&row=0");
  });

  it("preserves spectator bootstrap on the world map with spectate enabled", () => {
    expect(resolveBootstrapGameUrl({ isSpectating: true })).toBe("/play/map?col=0&row=0&spectate=true");
  });

  it("resolves the player handoff from map bootstrap to the matching hex once structures are available", () => {
    expect(resolvePlayerBootstrapHandoff({ entityId: 42, position: { x: 12, y: 34 } })).toEqual({
      structureEntityId: 42,
      targetUrl: "/play/hex?col=12&row=34",
      worldMapPosition: { col: 12, row: 34 },
    });
  });
});
