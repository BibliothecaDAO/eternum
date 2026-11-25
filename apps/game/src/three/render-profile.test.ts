import { expect, it } from "vitest";

import { GRAPHICS_QUALITIES } from "./graphics-preferences";
import { RENDER_PROFILES } from "./render-profile";

it("draws Low at a 30 fps cap and ratio 1 with neither shadows nor the post chain, and the others at the display's rate", () => {
  expect(RENDER_PROFILES.low).toMatchObject({
    maxFps: 30,
    visuals: { pixelRatio: 1, postProcessing: false, shadows: false },
  });
  expect(RENDER_PROFILES.balanced).toMatchObject({
    maxFps: null,
    visuals: { pixelRatio: 1.25, postProcessing: true, shadowMapSize: 1024, shadows: true },
  });
  expect(RENDER_PROFILES.high).toMatchObject({
    maxFps: null,
    visuals: { pixelRatio: 2, postProcessing: true, shadowMapSize: 2048, shadows: true },
  });
});

it("asks more of the device at each level up, never less", () => {
  const [low, balanced, high] = GRAPHICS_QUALITIES.map((quality) => RENDER_PROFILES[quality].visuals);
  expect(low.pixelRatio).toBeLessThan(balanced.pixelRatio);
  expect(balanced.pixelRatio).toBeLessThan(high.pixelRatio);
  expect(low.shadowMapSize).toBeLessThan(balanced.shadowMapSize);
  expect(balanced.shadowMapSize).toBeLessThan(high.shadowMapSize);
});
