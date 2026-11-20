import { expect, it } from "vitest";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { readQuestWeek } from "./quest-week";

const store = (taken: ReadonlySet<number>) =>
  ({
    require: () => ({ seed: 42n }),
    get: (_model: string, key: { day: number }) => (taken.has(key.day) ? { claimed: true } : undefined),
  }) as unknown as NativeFactStore;

it("lists the seven days of the week today falls in, with today marked and the rewards taken ticked", () => {
  const week = readQuestWeek(store(new Set([7, 8])), 1, 5n, 9);
  expect(week.map(({ day }) => day)).toEqual([8, 9, 10, 11, 12, 13, 14]);
  expect(week.map(({ when }) => when)).toEqual(["past", "past", "today", "ahead", "ahead", "ahead", "ahead"]);
  expect(week.map(({ collected }) => collected)).toEqual([true, true, false, false, false, false, false]);
});

it("draws every quest once in a week", () => {
  const names = readQuestWeek(store(new Set()), 1, 5n, 0).map(({ quest }) => quest.name);
  expect(new Set(names).size).toBe(7);
});
