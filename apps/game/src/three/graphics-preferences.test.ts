import { expect, it } from "vitest";
import {
  GRAPHICS_QUALITIES,
  readGraphicsPreferences,
  resolveGraphicsQuality,
  writeGraphicsPreferences,
} from "./graphics-preferences";
it("persists quality and shadows independently across reload", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  expect(readGraphicsPreferences(storage)).toEqual({ quality: "high", shadows: true });
  writeGraphicsPreferences(storage, { quality: "balanced", shadows: false });
  expect(readGraphicsPreferences(storage)).toEqual({ quality: "balanced", shadows: false });
});

it("resolves every known quality and falls back to high for unknown values", () => {
  for (const quality of GRAPHICS_QUALITIES) expect(resolveGraphicsQuality(quality)).toBe(quality);
  expect(resolveGraphicsQuality("detail")).toBe("high");
  expect(resolveGraphicsQuality(null)).toBe("high");
});
