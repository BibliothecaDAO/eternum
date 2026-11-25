import { expect, it } from "vitest";

import { readGraphicsPreferences, writeGraphicsPreferences } from "./graphics-preferences";

const storageWith = (entries: Record<string, string>) => {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

it("draws a first visit at High with shadows, and keeps a chosen quality and shadows across reloads", () => {
  const storage = storageWith({});
  expect(readGraphicsPreferences(storage)).toEqual({ quality: "high", shadows: true });
  writeGraphicsPreferences(storage, { quality: "low", shadows: false });
  expect(readGraphicsPreferences(storage)).toEqual({ quality: "low", shadows: false });
});

it("keeps a player's stored choice under its name", () => {
  expect(readGraphicsPreferences(storageWith({ "eternum-graphics": '{"quality":"high","shadows":true}' }))).toEqual({
    quality: "high",
    shadows: true,
  });
  expect(
    readGraphicsPreferences(storageWith({ "eternum-graphics": '{"quality":"balanced","shadows":false}' })),
  ).toEqual({
    quality: "balanced",
    shadows: false,
  });
});

it("falls back to High on an unknown or unreadable stored value", () => {
  expect(readGraphicsPreferences(storageWith({ "eternum-graphics": '{"quality":"ultra"}' })).quality).toBe("high");
  expect(readGraphicsPreferences(storageWith({ "eternum-graphics": "{" }))).toEqual({ quality: "high", shadows: true });
  expect(readGraphicsPreferences(null)).toEqual({ quality: "high", shadows: true });
});
