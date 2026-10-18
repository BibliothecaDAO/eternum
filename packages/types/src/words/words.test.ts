import { ResourcesIds } from "../constants/resource-ids";
import { StructureType } from "../constants/structure-type";
import { GuardSlot } from "../constants/troops";
import { describe, expect, it } from "vitest";

import {
  formatAmount,
  formatCharge,
  formatExact,
  formatFigure,
  formatOrdinal,
  formatPercent,
  formatPoints,
  formatRate,
  readTypedNumber,
  typedNumberText,
} from "./amount";
import { formatCount } from "./count";
import { ageLine, guardSlotName, rankName, resourceName, structureName } from "./nouns";
import { formatAgo, formatClockTime, formatDuration, formatGameClock, formatMoment } from "./time";
import { VOICE_RULES } from "./voice";

describe("numbers", () => {
  it("writes an amount held but under a unit as <1, never as nothing", () => {
    expect(formatAmount(0.05)).toBe("<1");
    expect(formatAmount(-0.4)).toBe("-<1");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1.4)).toBe("1");
  });

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

  it("writes a figure as precisely as it is read, signed as a change", () => {
    expect([1_250, 12.4, 2.55, 0.256, 0].map((value) => formatFigure(value))).toEqual([
      "1,250",
      "12",
      "2.6",
      "0.26",
      "0",
    ]);
    expect(formatFigure(2.5, { signed: true })).toBe("+2.5");
    expect(formatFigure(-0.25, { signed: true })).toBe("-0.25");
    expect(formatFigure(undefined)).toBe("—");
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
    expect(formatPoints(0)).toBe("0 points");
    expect(formatPoints(undefined)).toBe("— points");
  });

  it("counts a noun in its right number, through the one plural rule", () => {
    expect(formatCount(1, "field army slot")).toBe("1 field army slot");
    expect(formatCount(0, "field army slot")).toBe("0 field army slots");
    expect(formatCount(3, "army", "armies")).toBe("3 armies");
    expect(formatCount(12_500, "relic")).toBe("12,500 relics");
    expect(formatCount(1, "slot is", "slots are")).toBe("1 slot is");
    expect(formatCount(2, "slot is", "slots are")).toBe("2 slots are");
  });
});

describe("times", () => {
  it("writes the top bar's game clock to the second, and short on a phone", () => {
    expect(formatGameClock(4328)).toBe("1h 12m 08s");
    expect(formatGameClock(68)).toBe("1m 08s");
    expect(formatGameClock(90000)).toBe("1d 01h 0m 00s");
    expect(formatGameClock(90000, { compact: true })).toBe("1d 1h");
    expect(formatGameClock(4328, { compact: true })).toBe("1h 12m");
    expect(formatGameClock(68, { compact: true })).toBe("1m 08s");
  });

  it("writes a moment as the device's 24-hour clock, two digits each", () => {
    expect(formatClockTime(new Date(2026, 8, 9, 14, 5).getTime() / 1000)).toBe("14:05");
    expect(formatClockTime(new Date(2026, 8, 9, 9, 7).getTime() / 1000)).toBe("09:07");
  });

  it("writes days from a day up, and Frontier's durations in hours", () => {
    expect(formatDuration(3 * 86_400 + 4 * 3600 + 120)).toBe("3d 5h");
    expect(formatDuration(2 * 86_400)).toBe("2d");
    expect(formatDuration(30 * 3600)).toBe("1d 6h");
    expect(formatDuration(30 * 3600, { days: false })).toBe("30h");
    expect(formatDuration(7 * 3600 + 14 * 60)).toBe("7h 14m");
  });

  it("writes a duration's largest unit alone where only a glance fits", () => {
    expect(formatDuration(3 * 86_400 + 4 * 3600 + 120, { largest: true })).toBe("3d");
    expect(formatDuration(23 * 3600 + 59 * 60, { largest: true })).toBe("23h");
    expect(formatDuration(7 * 3600 + 14 * 60, { largest: true })).toBe("7h");
    expect(formatDuration(17 * 60 + 5, { largest: true })).toBe("18m");
    expect(formatDuration(30 * 3600, { days: false, largest: true })).toBe("30h");
  });

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

describe("amounts", () => {
  it("shows an unknown amount as a dash, never zero, and compacts past ten thousand", () => {
    expect(formatAmount(undefined)).toBe("—");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1_498)).toBe("1,498");
    expect(formatAmount(12_400)).toBe("12.4K");
  });

  it("keeps a whole count exact at any size, rounded to the unit", () => {
    expect(formatExact(24_000)).toBe("24,000");
    expect(formatExact(2.6)).toBe("3");
    expect(formatExact(123_456_789_012_345_678_901_234_567_890n)).toBe("123,456,789,012,345,678,901,234,567,890");
    expect(formatExact(-9_007_199_254_740_993n)).toBe("-9,007,199,254,740,993");
    expect(formatExact(0n)).toBe("0");
    expect(formatExact(undefined)).toBe("—");
  });

  it("reads a number as a player types it: grouped, with its fraction, whole where the field is", () => {
    expect(readTypedNumber("1,250.5")).toBe(1250.5);
    expect(readTypedNumber("12,400")).toBe(12_400);
    expect(readTypedNumber("0.25 LORDS")).toBe(0.25);
    expect(readTypedNumber("1,250.5", { whole: true })).toBe(1_250);
    expect(readTypedNumber("-3")).toBe(-3);
    expect(readTypedNumber("   ")).toBeNull();
    expect(readTypedNumber("abc")).toBeNaN();
    expect(typedNumberText("0.")).toBe("0.");
    expect(typedNumberText("x1,2y")).toBe("1,2");
    expect(typedNumberText("abc")).toBeUndefined();
  });

  it("writes a charge as the chain takes it: never rounded, never compacted, never nothing", () => {
    expect(formatCharge(0.25)).toBe("0.25");
    expect(formatCharge(2.5)).toBe("2.5");
    expect(formatCharge(12_400)).toBe("12,400");
    expect(formatCharge(1_234_567.125)).toBe("1,234,567.125");
    expect(formatCharge(0.000000001)).toBe("0.000000001");
    expect(formatCharge(undefined)).toBe("—");
  });
});

describe("time", () => {
  it("writes durations in hours and minutes, and Frontier's never in days, rounding up so time left never reads 0m", () => {
    expect(formatDuration(7 * 3600 + 14 * 60)).toBe("7h 14m");
    expect(formatDuration(12 * 3600)).toBe("12h");
    expect(formatDuration(42 * 60)).toBe("42m");
    expect(formatDuration(30 * 3600, { days: false })).toBe("30h");
    expect(formatDuration(1)).toBe("1m");
    expect(formatDuration(undefined)).toBe("—");
  });

  it("writes a moment as the local clock time, unknown as a dash", () => {
    const at = new Date(2026, 9, 7, 21, 40).getTime() / 1000;
    expect(formatClockTime(at)).toBe("21:40");
    expect(formatClockTime(undefined)).toBe("—");
  });

  it("writes a moment a day away with its day, so a clock time already gone today never reads as past", () => {
    const now = new Date(2026, 9, 10, 15, 0).getTime() / 1000;
    expect(formatMoment(new Date(2026, 9, 11, 14, 32).getTime() / 1000, now)).toBe("11 Oct 14:32");
    expect(formatMoment(undefined, now)).toBe("—");
  });
});
