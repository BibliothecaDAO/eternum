import { expect, it } from "vitest";

import { GRAPHICS_QUALITIES } from "./graphics-preferences";
import { createRenderProfile } from "./render-profile";

it("draws High as today's picture, Balanced as the old Balanced (ratio 1, 512 shadows), and Low at 30 fps without the post chain", () => {
  expect(createRenderProfile("high", true)).toMatchObject({
    maxFps: null,
    visuals: { pixelRatio: 1.25, postProcessing: true, shadowMapSize: 1024, shadows: true },
  });
  expect(createRenderProfile("balanced", true)).toMatchObject({
    maxFps: null,
    visuals: { pixelRatio: 1, postProcessing: true, shadowMapSize: 512, shadows: true },
  });
  expect(createRenderProfile("low", true)).toMatchObject({
    maxFps: 30,
    visuals: { pixelRatio: 1, postProcessing: false, shadows: true },
  });
});

it("leaves shadows to their own switch at every level", () => {
  for (const quality of GRAPHICS_QUALITIES) {
    expect(createRenderProfile(quality, false).visuals.shadows).toBe(false);
    expect(createRenderProfile(quality, true).visuals.shadows).toBe(true);
  }
});

it("asks no more of the device at a lower level", () => {
  const [low, balanced, high] = GRAPHICS_QUALITIES.map((quality) => createRenderProfile(quality, true).visuals);
  expect(low.pixelRatio).toBeLessThanOrEqual(balanced.pixelRatio);
  expect(balanced.pixelRatio).toBeLessThanOrEqual(high.pixelRatio);
  expect(low.shadowMapSize).toBeLessThanOrEqual(balanced.shadowMapSize);
});
