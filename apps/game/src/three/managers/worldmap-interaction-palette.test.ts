import { Color } from "three";
import { describe, expect, it } from "vitest";
import {
  REALM_PLOT_HOVER_PALETTE,
  REALM_PLOT_PALETTE,
  resolveHighlightLayerPalette,
  resolveHoverVisualPalette,
} from "./worldmap-interaction-palette";

describe("worldmap interaction palette", () => {
  it("returns contextual pink hover for actionable selected hexes", () => {
    expect(resolveHoverVisualPalette({ hasSelection: true, actionType: "explore" })).toEqual({
      baseColor: 0xff4fd8,
      rimColor: 0xffb3f5,
      intensity: 0.48,
      visualMode: "fill",
    });
  });

  it("falls back to the generic pink hover when nothing actionable is selected", () => {
    expect(resolveHoverVisualPalette({ hasSelection: false })).toEqual({
      baseColor: 0xff4fd8,
      rimColor: 0xffb3f5,
      intensity: 0.32,
      visualMode: "fill",
    });
  });

  it("keeps hover styling independent from frontier highlight colors", () => {
    const frontier = resolveHighlightLayerPalette("explore");

    expect(frontier.routeColor).toBe(0x4de3ff);
    expect(frontier.endpointColor).toBe(0x84f1ff);
    expect(resolveHoverVisualPalette({ hasSelection: true, actionType: "explore" }).baseColor).not.toBe(
      frontier.routeColor,
    );
  });

  it("uses a green-dominant palette for Realm open plots, build highlights and plot hover", () => {
    const build = resolveHighlightLayerPalette("build");
    for (const hex of [
      REALM_PLOT_PALETTE.fill,
      REALM_PLOT_PALETTE.rim,
      build.routeColor,
      build.endpointColor,
      REALM_PLOT_HOVER_PALETTE.baseColor,
      REALM_PLOT_HOVER_PALETTE.rimColor,
    ]) {
      const color = new Color(hex);
      expect(color.g).toBeGreaterThan(color.r);
      expect(color.g).toBeGreaterThan(color.b);
    }
    expect(REALM_PLOT_PALETTE.rimOpacity).toBeGreaterThan(REALM_PLOT_PALETTE.fillOpacity);
  });
});
