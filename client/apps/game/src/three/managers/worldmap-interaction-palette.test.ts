import { describe, expect, it } from "vitest";
import {
  resolveHighlightLayerPalette,
  resolveHoverVisualPalette,
  resolveSelectionPulsePalette,
} from "./worldmap-interaction-palette";

describe("worldmap interaction palette", () => {
  it("keeps army and structure pulse palettes distinct", () => {
    const army = resolveSelectionPulsePalette("army");
    const structure = resolveSelectionPulsePalette("structure");

    expect(army.baseColor).not.toBe(structure.baseColor);
    expect(army.pulseColor).not.toBe(structure.pulseColor);
    expect(army.intensity).not.toBe(structure.intensity);
  });

  it("returns contextual outline hover for actionable selected hexes", () => {
    expect(resolveHoverVisualPalette({ hasSelection: true, actionType: "explore" })).toEqual({
      baseColor: 0x4de3ff,
      rimColor: 0x84f1ff,
      intensity: 0.48,
      visualMode: "outline",
    });
  });

  it("falls back to the generic fill hover when nothing actionable is selected", () => {
    expect(resolveHoverVisualPalette({ hasSelection: false })).toEqual({
      baseColor: 0x3399ff,
      rimColor: 0x7ed7ff,
      intensity: 0.32,
      visualMode: "fill",
    });
  });

  it("shares the frontier palette across highlight layers and hover emphasis", () => {
    const frontier = resolveHighlightLayerPalette("explore");

    expect(frontier.routeColor).toBe(0x4de3ff);
    expect(frontier.endpointColor).toBe(0x84f1ff);
    expect(resolveHoverVisualPalette({ hasSelection: true, actionType: "explore" }).baseColor).toBe(
      frontier.routeColor,
    );
  });
});
