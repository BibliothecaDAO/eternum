import { expect, it } from "vitest";

import { readGraphicsPreferences, writeGraphicsPreferences } from "./graphics-preferences";

const storageWith = (entries: Record<string, string>) => {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

it("keeps a chosen quality and shadows across reloads, and the device's default quality with shadows on a first visit", () => {
  const storage = storageWith({});
  expect(readGraphicsPreferences(storage, "high")).toEqual({ quality: "high", shadows: true });
  expect(readGraphicsPreferences(storage, "balanced")).toEqual({ quality: "balanced", shadows: true });
  writeGraphicsPreferences(storage, { quality: "low", shadows: false });
  expect(readGraphicsPreferences(storage, "high")).toEqual({ quality: "low", shadows: false });
});

it("reads a player's stored High as today's picture and the old Balanced as the new one", () => {
  expect(
    readGraphicsPreferences(storageWith({ "eternum-graphics": '{"quality":"high","shadows":true}' }), "low"),
  ).toEqual({ quality: "high", shadows: true });
  expect(
    readGraphicsPreferences(storageWith({ "eternum-graphics": '{"quality":"balanced","shadows":false}' }), "high"),
  ).toEqual({ quality: "balanced", shadows: false });
});

it("falls back to the device's default on an unknown or unreadable stored value", () => {
  expect(readGraphicsPreferences(storageWith({ "eternum-graphics": '{"quality":"ultra"}' }), "high").quality).toBe(
    "high",
  );
  expect(readGraphicsPreferences(storageWith({ "eternum-graphics": "{" }), "balanced")).toEqual({
    quality: "balanced",
    shadows: true,
  });
  expect(readGraphicsPreferences(null, "high")).toEqual({ quality: "high", shadows: true });
});
