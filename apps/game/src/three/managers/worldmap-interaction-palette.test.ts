import { BiomeType } from "@bibliothecadao/types";
import { Color, SRGBColorSpace } from "three";
import { describe, expect, it } from "vitest";
import { requireBiomeColor } from "./biome-colors";
import {
  HIGHLIGHT_LAYER_PALETTES,
  plotLookOn,
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

  it("draws a realm's open plots in its ground's own colour: lighter on dark ground, darker on light ground", () => {
    const lightness = (rgb: readonly number[]) => {
      const { r, g, b } = new Color(rgb[0], rgb[1], rgb[2]).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const groundOf = (biome: BiomeType) => {
      const { r, g, b } = requireBiomeColor(biome);
      return lightness([r, g, b]);
    };
    for (const biome of [
      BiomeType.Grassland,
      BiomeType.Taiga,
      BiomeType.TemperateDesert,
      BiomeType.TropicalRainForest,
    ]) {
      const look = plotLookOn(biome);
      expect(lightness(look.rim)).toBeGreaterThan(lightness(look.fill));
      expect(lightness(look.fill)).toBeGreaterThan(groundOf(biome));
    }
    for (const biome of [BiomeType.Snow, BiomeType.Tundra]) {
      const look = plotLookOn(biome);
      expect(lightness(look.rim)).toBeLessThan(lightness(look.fill));
      expect(lightness(look.fill)).toBeLessThan(groundOf(biome));
    }
    const grass = plotLookOn(BiomeType.Grassland);
    expect(grass.rim[3]).toBeGreaterThan(grass.fill[3]);
    expect(grass.hover.baseColor).toBe(grass.lit.routeColor);
    expect(plotLookOn(BiomeType.Snow).lit.routeColor).not.toBe(grass.lit.routeColor);
  });

  it("gives the teach highlight a distinct luminous colour that collides with no existing map meaning", () => {
    const teach = resolveHighlightLayerPalette("teach");
    expect(teach).toEqual({
      routeColor: 0xfff5d6,
      endpointColor: 0xfffdf5,
    });
    for (const [kind, other] of Object.entries(HIGHLIGHT_LAYER_PALETTES)) {
      if (kind === "teach") continue;
      expect(teach.routeColor).not.toBe(other.routeColor);
      expect(teach.routeColor).not.toBe(other.endpointColor);
      expect(teach.endpointColor).not.toBe(other.routeColor);
      expect(teach.endpointColor).not.toBe(other.endpointColor);
    }
    const hover = resolveHoverVisualPalette({ hasSelection: false });
    expect(teach.routeColor).not.toBe(hover.baseColor);
    expect(teach.routeColor).not.toBe(hover.rimColor);
    expect(teach.endpointColor).not.toBe(hover.baseColor);
    expect(teach.endpointColor).not.toBe(hover.rimColor);
  });
});
