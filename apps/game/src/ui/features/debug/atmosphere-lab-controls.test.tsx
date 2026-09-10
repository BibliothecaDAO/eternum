// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { expect, it, vi } from "vitest";
import { AtmosphereLabControls } from "./atmosphere-lab-controls";
import { WORLD_ATMOSPHERE_PRESETS } from "@/three/effects/world-atmosphere-presets";

it("offers all seven phases, a moon toggle, and edits the shared world preset", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  const onPhase = vi.fn();
  const onMoon = vi.fn();
  const original = WORLD_ATMOSPHERE_PRESETS.deepNight.hemisphereIntensity;
  await act(async () => root.render(<AtmosphereLabControls onPhase={onPhase} onMoon={onMoon} />));
  expect(container.querySelectorAll("option")).toHaveLength(7);
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = "deepNight";
    Simulate.change(select);
  });
  expect(onPhase).toHaveBeenLastCalledWith(0);
  await act(async () => container.querySelector<HTMLInputElement>('[type="checkbox"]')!.click());
  expect(onMoon).toHaveBeenLastCalledWith(false);
  const slider = container.querySelector<HTMLInputElement>('[aria-label="Hemisphere fill"]')!;
  await act(async () => {
    slider.value = "1.8";
    Simulate.change(slider);
  });
  expect(WORLD_ATMOSPHERE_PRESETS.deepNight.hemisphereIntensity).toBe(1.8);
  WORLD_ATMOSPHERE_PRESETS.deepNight.hemisphereIntensity = original;
  await act(async () => root.unmount());
});
it("keeps night and evening fill below daylight and preserves directional shading", () => {
  for (const preset of [WORLD_ATMOSPHERE_PRESETS.deepNight, WORLD_ATMOSPHERE_PRESETS.evening]) {
    expect(preset.ambientIntensity).toBeLessThan(WORLD_ATMOSPHERE_PRESETS.day.ambientIntensity);
    expect(preset.hemisphereIntensity).toBeLessThan(WORLD_ATMOSPHERE_PRESETS.day.hemisphereIntensity);
    expect(preset.sunIntensity).toBeGreaterThan(preset.hemisphereIntensity);
  }
  expect(WORLD_ATMOSPHERE_PRESETS.dawn.ambientIntensity).toBeGreaterThan(0.6);
  expect(WORLD_ATMOSPHERE_PRESETS.dusk.ambientIntensity).toBeGreaterThan(0.6);
  expect(WORLD_ATMOSPHERE_PRESETS.day).toEqual({
    skyColor: 0xb8d8f2,
    groundColor: 0xd6c7ad,
    sunColor: 0xfff2dc,
    ambientColor: 0xf2dfc7,
    fogColor: 0xd2e2f0,
    hemisphereIntensity: 1.9,
    sunIntensity: 3.0,
    ambientIntensity: 0.62,
    fogNear: 32,
    fogFar: 82,
  });
});
