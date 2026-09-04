import { describe, expect, it, vi } from "vitest";
import {
  createRenderProfile,
  readRenderMode,
  RENDERER_PIXEL_RATIO_CAP,
  RENDER_MODE_STORAGE_KEY,
  writeRenderMode,
} from "./render-profile";

describe("render profile", () => {
  it("keeps Quality and Battery pixels identical", () => {
    expect(createRenderProfile("battery").visuals).toEqual(createRenderProfile("quality").visuals);
  });

  it("uses the renderer pixel-ratio cap as the visual profile value", () => {
    expect(createRenderProfile("quality").visuals.pixelRatio).toBe(RENDERER_PIXEL_RATIO_CAP);
    expect(RENDERER_PIXEL_RATIO_CAP).toBe(1.25);
  });

  it("changes only temporal pacing knobs in Battery", () => {
    const quality = createRenderProfile("quality");
    const battery = createRenderProfile("battery");

    expect(quality.pacing.idleFps).toBeNull();
    expect(battery.pacing.idleFps).toBe(30);
    expect(quality.pacing.maxFps).toBe(60);
    expect(battery.pacing.maxFps).toBe(60);
    expect(battery.animation.distantIntervalMultiplier).toBeGreaterThan(quality.animation.distantIntervalMultiplier);
    expect(battery.prefetch.sideRadiusLimit).toBeLessThan(quality.prefetch.sideRadiusLimit);
    expect(battery.shadows.minimumRefreshIntervalMs).toBeGreaterThan(quality.shadows.minimumRefreshIntervalMs);
  });

  it("migrates every retired tier to Quality and removes the old keys", () => {
    const values = new Map<string, string>([[["GRAPHICS", "SETTING"].join("_"), "LOW"]]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    expect(readRenderMode(storage)).toBe("quality");
    expect(values.get(RENDER_MODE_STORAGE_KEY)).toBe("quality");
    expect(values.has(["GRAPHICS", "SETTING"].join("_"))).toBe(false);
  });

  it("persists an explicit mode choice", () => {
    const setItem = vi.fn();
    writeRenderMode({ setItem }, "battery");
    expect(setItem).toHaveBeenCalledWith(RENDER_MODE_STORAGE_KEY, "battery");
  });

  it("cleans retired preferences without replacing an explicit Battery choice", () => {
    const removeItem = vi.fn();
    const storage = {
      getItem: vi.fn((key: string) => (key === RENDER_MODE_STORAGE_KEY ? "battery" : "HIGH")),
      removeItem,
      setItem: vi.fn(),
    };

    expect(readRenderMode(storage)).toBe("battery");
    expect(removeItem).toHaveBeenCalledWith(["GRAPHICS", "SETTING"].join("_"));
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
