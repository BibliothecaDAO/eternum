import { expect, it } from "vitest";

import { readGraphicsQuality, writeGraphicsQuality } from "./graphics-preferences";

const storageWith = (entries: Record<string, string>) => {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

it("keeps the chosen quality across reloads, Balanced on a first visit", () => {
  const storage = storageWith({});
  expect(readGraphicsQuality(storage)).toBe("balanced");
  writeGraphicsQuality(storage, "low");
  expect(readGraphicsQuality(storage)).toBe("low");
  writeGraphicsQuality(storage, "high");
  expect(readGraphicsQuality(storage)).toBe("high");
});

it.each([
  [{ quality: "high", shadows: true }, "balanced"],
  [{ quality: "balanced", shadows: true }, "low"],
  [{ quality: "high", shadows: false }, "low"],
])("reads the retired Quality %j and Frame rate once as %s, then forgets them", (retired, quality) => {
  const storage = storageWith({ "eternum-graphics": JSON.stringify(retired), RENDER_MODE: "capped" });
  expect(readGraphicsQuality(storage)).toBe(quality);
  expect([...storage.values]).toEqual([["eternum-quality", quality]]);
});

it("draws a page with no storage at Balanced", () => {
  expect(readGraphicsQuality(null)).toBe("balanced");
});
