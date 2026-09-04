import { describe, expect, it } from "vitest";
import { resolveHighlightViewTuning } from "./worldmap-highlight-view-policy";

describe("resolveHighlightViewTuning", () => {
  it("keeps far-view highlights stronger than close-view highlights", () => {
    const close = resolveHighlightViewTuning(1);
    const far = resolveHighlightViewTuning(3);

    expect(far.routeOpacity).toBeGreaterThan(close.routeOpacity);
    expect(far.frontierOpacity).toBeGreaterThan(close.frontierOpacity);
    expect(far.frontierScale).toBeGreaterThan(close.frontierScale);
  });

  it("preserves a stable medium baseline between close and far", () => {
    const close = resolveHighlightViewTuning(1);
    const medium = resolveHighlightViewTuning(2);
    const far = resolveHighlightViewTuning(3);

    expect(medium.routeOpacity).toBeGreaterThan(close.routeOpacity);
    expect(medium.routeOpacity).toBeLessThan(far.routeOpacity);
    expect(medium.endpointScale).toBeGreaterThan(close.endpointScale);
    expect(medium.endpointScale).toBeLessThan(far.endpointScale);
  });
});
