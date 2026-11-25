import { ResourcesIds } from "../constants/resource-ids";
import { questCatalog } from "../constants/quests";
import { StructureType } from "../constants/structure-type";
import { GuardSlot } from "../constants/troops";
import { describe, expect, it } from "vitest";

import {
  formatAmount,
  formatDollars,
  formatGain,
  formatCharge,
  formatExact,
  formatFigure,
  formatHeldAgainst,
  formatOrdinal,
  formatPercent,
  formatPoints,
  formatPopulation,
  formatPopulationInWords,
  formatRate,
  formatShort,
  formatShortChange,
  formatTypedNumber,
  readTypedNumber,
  typedNumberText,
} from "./amount";
import { formatCount } from "./count";
import { ageLine } from "./modes";
import {
  asRanked,
  buildingName,
  frontierTroopName,
  guardSlotName,
  LAYER_NAMES,
  rankedText,
  rankName,
  resourceName,
  questLine,
  questObjective,
  structureName,
  troopPlural,
} from "./nouns";
import { TROOP_TIERS, TROOP_TYPES, TroopType, troopTierIndex } from "../types/common";
import { BuildingType, BuildingTypeToString } from "../constants/structures";
import {
  formatAgo,
  formatClockTime,
  formatDate,
  formatDuration,
  formatGameClock,
  formatLongDate,
  formatMoment,
  formatShortDuration,
} from "./time";
import { BANNED_WORDS, PLAIN_WORDS, VOICE_RULES } from "./voice";

describe("numbers", () => {
  it("writes an amount held but under a unit as <1, never as nothing", () => {
    expect(formatAmount(0.05)).toBe("<1");
    expect(formatAmount(-0.4)).toBe("-<1");
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1.4)).toBe("1");
  });

  it("writes a gain signed, and one under a unit as under 1, never as +<1 or nothing", () => {
    expect(formatGain(12)).toBe("+12");
    expect(formatGain(12_400)).toBe("+12.4K");
    expect(formatGain(0.4)).toBe("under 1");
    expect(formatGain(0)).toBe("+0");
    expect(formatGain(undefined)).toBe("—");
  });

  it("writes a chip's number short from a thousand, signed for a gain", () => {
    expect(formatShort(1_000, { signed: true })).toBe("+1K");
    expect(formatShort(1_000)).toBe("1K");
    expect(formatShort(13_940)).toBe("13.9K");
    expect(formatShort(999)).toBe("999");
    expect(formatShort(12, { signed: true })).toBe("+12");
    expect(formatShort(0.4, { signed: true })).toBe("under 1");
    expect(formatShort(0.4)).toBe("<1");
    expect(formatShort(undefined)).toBe("—");
  });

  it("writes a chip's before and after short, exact where short would read as no change", () => {
    expect(formatShortChange(1_240, 1_000)).toBe("1.2K → 1K");
    expect(formatShortChange(1_240, 1_230)).toBe("1,240 → 1,230");
    expect(formatShortChange(7, 140)).toBe("7 → 140");
    expect(formatShortChange(2_000, 2_000)).toBe("2K → 2K");
    expect(formatShortChange(500, undefined)).toBe("500 → —");
  });

  it("writes a percent whole from ten up, to one place below, signed only as a bonus", () => {
    expect(formatPercent(0.45)).toBe("45%");
    expect(formatPercent(0.025)).toBe("2.5%");
    expect(formatPercent(0.1, { signed: true })).toBe("+10%");
    expect(formatPercent(-0.05, { signed: true })).toBe("-5%");
    expect(formatPercent(0, { signed: true })).toBe("0%");
    expect(formatPercent(undefined)).toBe("—");
  });

  it("writes a price in cents as dollars and cents", () => {
    expect([660, 90, 1, 100_000].map(formatDollars)).toEqual(["$6.60", "$0.90", "$0.01", "$1,000.00"]);
  });

  it("writes a minute's rate as precisely as it is read, so 1.6 a minute never shows as 2", () => {
    expect([6.3, 8.6, 12.4, 1, 1.4, 1.6, 66].map((perMinute) => formatRate(perMinute / 60))).toEqual([
      "+6.3/min",
      "+8.6/min",
      "+12/min",
      "+1/min",
      "+1.4/min",
      "+1.6/min",
      "+66/min",
    ]);
    expect([0.6, 0.25, 0.05].map((perMinute) => formatRate(perMinute / 60))).toEqual([
      "+0.6/min",
      "+0.25/min",
      "+0.05/min",
    ]);
    expect(formatRate(-0.25)).toBe("-15/min");
  });

  it("writes every rate a minute's, never a second's or an hour's", () => {
    // The owner's two screenshots read +1.1/s and +54/min side by side (3 November).
    expect(formatRate(1.1)).toBe("+66/min");
    expect(formatRate(54 / 60)).toBe("+54/min");
    expect(formatRate(2.5)).toBe("+150/min");
    expect(formatRate(1_000)).toBe("+60,000/min");
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

  it("writes a day short in a line and spelled out in a title, with the year only when it is not this year's", () => {
    const opening = new Date(2026, 11, 1, 18).getTime() / 1000;
    const thisYear = new Date(2026, 10, 18).getTime() / 1000;
    const lastYear = new Date(2025, 10, 18).getTime() / 1000;
    expect(formatDate(opening, thisYear)).toBe("1 Dec");
    expect(formatLongDate(opening, thisYear)).toBe("1 December");
    expect(formatLongDate(opening, lastYear)).toBe("1 December 2026");
  });

  it("writes days from a day up, and Frontier's durations in hours", () => {
    expect(formatDuration(3 * 86_400 + 4 * 3600 + 120)).toBe("3d 5h");
    expect(formatDuration(2 * 86_400)).toBe("2d");
    expect(formatDuration(30 * 3600)).toBe("1d 6h");
    expect(formatDuration(30 * 3600, { days: false })).toBe("30h");
    expect(formatDuration(7 * 3600 + 14 * 60)).toBe("7h 14m");
  });

  it("writes a duration in three characters at most where only a glance fits, never a smaller number", () => {
    const day = 86_400;
    expect(formatShortDuration(17 * 60 + 5)).toBe("18m");
    expect(formatShortDuration(23 * 3600 + 59 * 60)).toBe("23h");
    expect(formatShortDuration(2 * day - 60)).toBe("2d");
    expect(formatShortDuration(99 * day)).toBe("99d");
    expect(formatShortDuration(100 * day)).toBe("14w");
    expect(formatShortDuration(699 * day)).toBe("99w");
    expect(formatShortDuration(1000 * day)).toBe("2y");
    expect(formatShortDuration(99 * 365 * day)).toBe("99y");
    expect(formatShortDuration(100 * 365 * day)).toBe("99y+");
    // Its first unit is the full duration's first unit, below a hundred days.
    for (const seconds of [61, 3599, 3600, 7 * 3600 + 14 * 60, 30 * 3600, 3 * day + 4 * 3600 + 120, 47.99 * 3600]) {
      expect(formatShortDuration(seconds)).toBe(formatDuration(seconds).split(" ")[0]);
    }
    for (const seconds of [0, 59, 61, 3600, day, 99 * day, 100 * day, 1000 * day, 1e12]) {
      expect(formatShortDuration(seconds).length).toBeLessThanOrEqual(seconds >= 100 * 365 * day ? 4 : 3);
    }
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
  it("says ranked words as plain text, each rank by its numeral and untrained as 0", () => {
    expect(rankedText(["Battle ", { rank: 2 }])).toBe("Battle II");
    expect(rankedText([{ rank: 0 }, " → ", { rank: 1 }])).toBe("0 → I");
    expect(rankedText("Well used")).toBe("Well used");
    expect(() => rankedText([{ rank: 6 }])).toThrow("Invalid rank 6");
  });

  it("joins plain words with ranked ones as ranked words", () => {
    expect([...asRanked("Research "), ...asRanked(["War hall ", { rank: 2 }])]).toEqual([
      "Research ",
      "War hall ",
      { rank: 2 },
    ]);
  });

  it("names a resource as a player reads it, never by its table key", () => {
    expect(resourceName(ResourcesIds.AncientFragment)).toBe("Ancient Fragment");
    expect(resourceName(ResourcesIds.KnightT2)).toBe("Knight T2");
    expect(resourceName(ResourcesIds.Paladin)).toBe("Paladin T1");
    expect(resourceName(ResourcesIds.Lords)).toBe("LORDS");
    expect(resourceName(ResourcesIds.Wheat)).toBe("Wheat");
    expect(resourceName(9_999)).toBe("—");
  });

  it("writes a quest's objective by its verb and many of its unit, and its line one or many by the target", () => {
    for (const quest of questCatalog) {
      expect(questObjective(quest)).toBe([quest.verb, quest.unit.many].join(" "));
      expect(questLine(quest, 1)).toBe([quest.verb, "1", quest.unit.one].join(" "));
      expect(questLine(quest, 2_500)).toBe([quest.verb, "2,500", quest.unit.many].join(" "));
      expect(quest.unit.one).not.toBe(quest.unit.many);
    }
  });

  it("names a rank, a structure, a guard wall and an age", () => {
    expect([0, 1, 2, 3, 9].map(rankName)).toEqual(["Settlement", "City", "Kingdom", "Empire", "—"]);
    expect(structureName(StructureType.Camp)).toBe("Camp");
    expect(structureName(StructureType.Mine, 1)).toBe("Rift");
    expect(guardSlotName(GuardSlot.Gamma)).toBe("Castle Wall");
    expect(ageLine("frontier")).toBe("Frontier · Age II");
  });

  it("names a building as its game does, one name for each", () => {
    expect(buildingName(BuildingType.ResourceKnightT1, true)).toBe("Barracks");
    expect(buildingName(BuildingType.ResourceKnightT1, false)).toBe("Knight T1");
    for (const type of [BuildingType.RationsDepot, BuildingType.ConscriptionCamp])
      expect(buildingName(type, true)).toBe(BuildingTypeToString[type]);
    expect(buildingName(BuildingType.ResourceCrossbowmanT1, true)).toBe("Range");
    expect([true, false].map((frontier) => buildingName(BuildingType.WorkersHut, frontier))).toEqual([
      "Workers Hut",
      "Workers Hut",
    ]);
    expect([true, false].map((frontier) => buildingName(BuildingType.ResourceLabor, frontier))).toEqual([
      "Workshop",
      "Workshop",
    ]);
    expect(buildingName(999, true)).toBe("—");
  });
});

describe("the voice rules", () => {
  it("each find their own bad example and pass their good one", () => {
    for (const { rule, bad, good, forbidden } of VOICE_RULES.filter((each) => each.forbidden)) {
      expect({ rule, bad: forbidden!.test(bad) }).toEqual({ rule, bad: true });
      expect({ rule, good: forbidden!.test(good) }).toEqual({ rule, good: false });
    }
  });

  it("refuse a rate in any unit but the minute, each form on its own", () => {
    const { forbidden } = VOICE_RULES.find((each) => each.rule === "Rates per minute")!;
    const refused = (words: string) => ({ words, refused: forbidden!.test(words) });
    for (const words of [
      "+1.1/s",
      "2 points/s",
      "FP/s",
      "FP/sec",
      "Total FP / sec",
      "then per second",
      "44.6K/h",
      "+302/hr",
      "per hour",
      "+302 an hour",
    ])
      expect(refused(words)).toEqual({ words, refused: true });
    for (const words of ["+66/min", "points +120/min", "FP rate", "then per minute", "a second press", "3/4 · 13m"])
      expect(refused(words)).toEqual({ words, refused: false });
  });

  it("refuse numeric and old layer names, each form on its own", () => {
    const { forbidden } = VOICE_RULES.find((each) => each.rule === "A layer by its name")!;
    const refused = (words: string) => ({ words, refused: forbidden!.test(words) });
    for (const words of [
      "Depth 1",
      "Depth 2",
      "Depth 3",
      "depth 0",
      "depth 2",
      "Layer 1",
      "Layer 2",
      "layer 3",
      "Depth II",
      "Layer III",
      "Deep I",
      "Deep I–III",
      "Ethereal I",
      "Ethereal II",
      "Ethereal reach III",
    ])
      expect(refused(words)).toEqual({ words, refused: true });
    for (const words of [...LAYER_NAMES, "Ethereal Layer", "Map depth", "deepest depth", "depth-1"])
      expect(refused(words)).toEqual({ words, refused: false });
  });

  it("matches every banned word on its bad example and passes its good one", () => {
    expect(BANNED_WORDS[0]?.banned).toBe("found (a Realm)");
    expect(BANNED_WORDS[0]?.use).toBe("create");
    expect(BANNED_WORDS[0]?.bad).toBe("Found your home");
    expect(BANNED_WORDS[0]?.good).toBe("Create your Realm");
    expect(BANNED_WORDS[0]?.zeroTolerance).toBe(true);
    expect(BANNED_WORDS.find((entry) => entry.banned === "Far-Eye")?.zeroTolerance).toBe(true);
    for (const { banned, bad, good, pattern } of BANNED_WORDS) {
      expect({ banned, bad: pattern.test(bad) }).toEqual({ banned, bad: true });
      expect({ banned, good: pattern.test(good) }).toEqual({ banned, good: false });
    }
    const foundRule = BANNED_WORDS[0]!;
    for (const allowed of ["Not found", "Sites are found at 100%", "No Realm found", "Create your Realm"])
      expect({ allowed, refused: foundRule.pattern.test(allowed) }).toEqual({ allowed, refused: false });
    const plainTokens = new Set(
      PLAIN_WORDS.flatMap(({ word }) => word.split(" / ").map((token) => token.trim().toLowerCase())),
    );
    for (const entry of PLAIN_WORDS) {
      expect(entry.concept.length).toBeGreaterThan(0);
      expect(entry.word.length).toBeGreaterThan(0);
      for (const banned of BANNED_WORDS) {
        expect({ word: entry.word, banned: banned.banned, matched: banned.pattern.test(entry.word) }).toEqual({
          word: entry.word,
          banned: banned.banned,
          matched: false,
        });
      }
    }
    for (const banned of BANNED_WORDS) {
      if (banned.use.startsWith("(")) continue;
      for (const token of banned.use.split(" / ").map((part) => part.trim().toLowerCase())) {
        expect({ banned: banned.banned, token, inPlainWords: plainTokens.has(token) }).toEqual({
          banned: banned.banned,
          token,
          inPlainWords: true,
        });
      }
    }
    for (const voiceRule of VOICE_RULES) {
      for (const banned of BANNED_WORDS) {
        if (voiceRule.forbidden) {
          expect({
            voice: voiceRule.rule,
            banned: banned.banned,
            overlap: voiceRule.forbidden.test(banned.bad),
          }).toEqual({ voice: voiceRule.rule, banned: banned.banned, overlap: false });
        }
        expect({ voice: voiceRule.rule, banned: banned.banned, duplicate: banned.pattern.test(voiceRule.bad) }).toEqual(
          { voice: voiceRule.rule, banned: banned.banned, duplicate: false },
        );
        expect({ voice: voiceRule.rule, banned: banned.banned, conflict: banned.pattern.test(voiceRule.good) }).toEqual(
          { voice: voiceRule.rule, banned: banned.banned, conflict: false },
        );
      }
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

  it("writes a realm's population one way: used of all it can hold, whole, never below none", () => {
    expect(formatPopulation(5, 6)).toBe("5/6");
    expect(formatPopulation(1_250, 2_000)).toBe("1,250/2,000");
    expect(formatPopulation(-1, Number.NaN)).toBe("0/0");
    expect(formatPopulationInWords(5, 6)).toBe("Population 5 of 6");
  });

  it("writes a charge rounded: whole from one, compact past ten thousand, <1 under one, never nothing", () => {
    expect([28.15, 12.5, 2.5, 2.4, 1_250.6, 12_400, 1_234_567.125].map(formatCharge)).toEqual([
      "28",
      "13",
      "3",
      "2",
      "1,251",
      "12.4K",
      "1.2M",
    ]);
    expect([0.25, 0.6, 0.0125, 0.000000001, -0.25, 0].map(formatCharge)).toEqual(["<1", "<1", "<1", "<1", "-<1", "0"]);
    expect(formatCharge(undefined)).toBe("—");
  });

  it("writes what is held against what is needed so a shortfall never reads as met", () => {
    // Short, on both sides of a fractional boundary: never an equal pair.
    expect(formatHeldAgainst(28, 28.15)).toEqual({ held: "28", need: "28.2" });
    expect(formatHeldAgainst(28.1, 28.15)).toEqual({ held: "28.1", need: "28.2" });
    expect(formatHeldAgainst(28.149, 28.15)).toEqual({ held: "28.1", need: "28.2" });
    // Covered, at and above the boundary: rounded as every charge reads.
    expect(formatHeldAgainst(28.15, 28.15)).toEqual({ held: "28", need: "28" });
    expect(formatHeldAgainst(28.2, 28.15)).toEqual({ held: "28", need: "28" });
    expect(formatHeldAgainst(28.99, 28.15)).toEqual({ held: "29", need: "28" });
    // A compact rounding boundary, short and covered.
    expect(formatHeldAgainst(12_440, 12_449)).toEqual({ held: "12,440", need: "12,449" });
    expect(formatHeldAgainst(12_449, 12_449)).toEqual({ held: "12.4K", need: "12.4K" });
    expect(formatHeldAgainst(9_640, 15_000)).toEqual({ held: "9,640", need: "15K" });
    // Under a unit.
    expect(formatHeldAgainst(0.555, 0.556)).toEqual({ held: "0.555", need: "0.556" });
    expect(formatHeldAgainst(0.5, 0.6)).toEqual({ held: "0.5", need: "0.6" });
    expect(formatHeldAgainst(0, 0.6)).toEqual({ held: "0", need: "<1" });
    expect(formatHeldAgainst(0.8, 0.6)).toEqual({ held: "<1", need: "<1" });
    expect(formatHeldAgainst(undefined, 30)).toEqual({ held: "—", need: "30" });
  });

  it("writes an amount field's number exactly, as typed", () => {
    expect([1_234.5, 0.25, 12_400, 0.000000001].map(formatTypedNumber)).toEqual([
      "1,234.5",
      "0.25",
      "12,400",
      "0.000000001",
    ]);
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

describe("troops", () => {
  it("names many of every troop type the schema allows, by its type or its table name", () => {
    expect(Object.fromEntries(TROOP_TYPES.map((troop) => [troop, troopPlural(troop)]))).toEqual({
      [TroopType.Knight]: "Knights",
      [TroopType.Paladin]: "Paladins",
      [TroopType.Crossbowman]: "Crossbowmen",
    });
    expect(troopPlural("Dragon")).toBeUndefined();
    expect(Object.fromEntries(TROOP_TYPES.map((troop) => [troop, frontierTroopName(troop)]))).toEqual({
      [TroopType.Knight]: "Knights",
      [TroopType.Paladin]: "Scouts",
      [TroopType.Crossbowman]: "Crossbows",
    });
    expect(frontierTroopName("Dragon")).toBeUndefined();
    expect(resourceName(ResourcesIds.CrossbowmanT2)).toBe("Crossbowman T2");
  });

  it("numbers every tier by its place in the catalog, and refuses one it does not hold", () => {
    expect(TROOP_TIERS.map(troopTierIndex)).toEqual([0, 1, 2]);
    expect(() => troopTierIndex("T4" as never)).toThrow("Unknown troop tier T4");
  });
});
