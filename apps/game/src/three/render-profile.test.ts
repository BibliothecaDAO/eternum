import { describe, expect, it, vi } from "vitest";
import {
  createRenderProfile,
  readRenderMode,
  RENDERER_PIXEL_RATIO_CAP,
  RENDER_MODE_STORAGE_KEY,
  writeRenderMode,
} from "./render-profile";

describe("render profile", () => {
  it("changes only the frame limit between modes", () => {
    const uncapped = createRenderProfile("uncapped");
    const capped = createRenderProfile("capped");
    expect(uncapped.maxFps).toBeNull();
    expect(capped.maxFps).toBe(60);
    expect(capped.visuals).toEqual(uncapped.visuals);
    expect(uncapped.visuals.pixelRatio).toBe(RENDERER_PIXEL_RATIO_CAP);
  });

  it("migrates every retired tier to Uncapped and removes the old keys", () => {
    const values = new Map<string, string>([[["GRAPHICS", "SETTING"].join("_"), "LOW"]]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      removeItem: vi.fn((key: string) => values.delete(key)),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    expect(readRenderMode(storage)).toBe("uncapped");
    expect(values.get(RENDER_MODE_STORAGE_KEY)).toBe("uncapped");
    expect(values.has(["GRAPHICS", "SETTING"].join("_"))).toBe(false);
  });

  it.each(["uncapped", "capped"] as const)("retains an explicit %s choice", (mode) => {
    const storage = { getItem: () => mode, removeItem: vi.fn(), setItem: vi.fn() };
    expect(readRenderMode(storage)).toBe(mode);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("migrates the former Quality mode to Uncapped", () => {
    const storage = { getItem: () => "quality", removeItem: vi.fn(), setItem: vi.fn() };
    expect(readRenderMode(storage)).toBe("uncapped");
    expect(storage.setItem).toHaveBeenCalledWith(RENDER_MODE_STORAGE_KEY, "uncapped");
    expect(readRenderMode(null)).toBe("uncapped");
  });

  it("persists an explicit mode choice", () => {
    const setItem = vi.fn();
    writeRenderMode({ setItem }, "capped");
    expect(setItem).toHaveBeenCalledWith(RENDER_MODE_STORAGE_KEY, "capped");
  });

  it("migrates Battery to the 60 FPS limit and removes retired preferences", () => {
    const removeItem = vi.fn();
    const storage = {
      getItem: vi.fn((key: string) => (key === RENDER_MODE_STORAGE_KEY ? "battery" : "HIGH")),
      removeItem,
      setItem: vi.fn(),
    };

    expect(readRenderMode(storage)).toBe("capped");
    expect(removeItem).toHaveBeenCalledWith(["GRAPHICS", "SETTING"].join("_"));
    expect(storage.setItem).toHaveBeenCalledWith(RENDER_MODE_STORAGE_KEY, "capped");
  });
});
