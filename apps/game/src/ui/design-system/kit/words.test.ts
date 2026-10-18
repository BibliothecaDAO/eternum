import { GuardSlot, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { formatOrdinal, formatPercent, formatPoints, formatRate } from "./amount";
import { formatAgo } from "./time";
import { VOICE_RULES } from "./voice";
import { ageLine, guardSlotName, rankName, resourceName, structureName } from "./words";

describe("numbers", () => {
  it("writes a percent whole from ten up, to one place below, signed only as a bonus", () => {
    expect(formatPercent(0.45)).toBe("45%");
    expect(formatPercent(0.025)).toBe("2.5%");
    expect(formatPercent(0.1, { signed: true })).toBe("+10%");
    expect(formatPercent(-0.05, { signed: true })).toBe("-5%");
    expect(formatPercent(0, { signed: true })).toBe("0%");
    expect(formatPercent(undefined)).toBe("—");
  });

  it("writes a rate a second from one a second up, a minute below, never an hour", () => {
    expect(formatRate(2.5)).toBe("+2.5/s");
    expect(formatRate(12.4)).toBe("+12/s");
    expect(formatRate(0.5)).toBe("+30/min");
    expect(formatRate(0.01)).toBe("+0.6/min");
    expect(formatRate(-0.25)).toBe("-15/min");
    expect(formatRate(0)).toBe("0/min");
    expect(formatRate(undefined)).toBe("—");
  });

  it("writes a place in a ranking as an ordinal", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(formatOrdinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "101st",
    ]);
  });

  it("writes points exact, in the singular for one", () => {
    expect(formatPoints(1)).toBe("1 point");
    expect(formatPoints(125_430)).toBe("125,430 points");
    expect(formatPoints(undefined)).toBe("— points");
  });
});

describe("times", () => {
  it("says how long ago a moment was, and its date from a day back", () => {
    const now = new Date(2026, 9, 18, 12, 0).getTime() / 1000;
    expect(formatAgo(now - 3, now)).toBe("just now");
    expect(formatAgo(now - 24, now)).toBe("24s ago");
    expect(formatAgo(now - 5 * 60, now)).toBe("5m ago");
    expect(formatAgo(now - 3 * 3600, now)).toBe("3h ago");
    expect(formatAgo(now - 2 * 86_400, now)).toBe("16 Oct");
  });
});

describe("nouns", () => {
  it("names a resource as a player reads it, never by its table key", () => {
    expect(resourceName(ResourcesIds.AncientFragment)).toBe("Ancient Fragment");
    expect(resourceName(ResourcesIds.KnightT2)).toBe("Knight T2");
    expect(resourceName(ResourcesIds.Paladin)).toBe("Paladin T1");
    expect(resourceName(ResourcesIds.Lords)).toBe("LORDS");
    expect(resourceName(ResourcesIds.Wheat)).toBe("Wheat");
    expect(resourceName(9_999)).toBe("—");
  });

  it("names a rank, a structure, a guard wall and an age", () => {
    expect([0, 1, 2, 3, 9].map(rankName)).toEqual(["Settlement", "City", "Kingdom", "Empire", "—"]);
    expect(structureName(StructureType.Camp)).toBe("Camp");
    expect(structureName(StructureType.Mine, 1)).toBe("Essence Rift");
    expect(guardSlotName(GuardSlot.Gamma)).toBe("Castle Wall");
    expect(ageLine("frontier")).toBe("Frontier · Age II");
  });
});

describe("the voice rules", () => {
  it("each find their own bad example and pass their good one", () => {
    for (const { rule, bad, good, forbidden } of VOICE_RULES.filter((each) => each.forbidden)) {
      expect({ rule, bad: forbidden!.test(bad) }).toEqual({ rule, bad: true });
      expect({ rule, good: forbidden!.test(good) }).toEqual({ rule, good: false });
    }
  });
});
