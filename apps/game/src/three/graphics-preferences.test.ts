import { expect, it } from "vitest";
import { readGraphicsPreferences, writeGraphicsPreferences } from "./graphics-preferences";
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
