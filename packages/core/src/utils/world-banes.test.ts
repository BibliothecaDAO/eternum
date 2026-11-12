import { describe, expect, it } from "vitest";
import { worldBane, baneQuest } from "./world-banes";
import {
  nativeBaneConstants as bane,
  nativeQuestConstants as quest,
} from "../../../../contracts/l3/world-native/schema/client.gen";

describe("the world's bane calendar", () => {
  it("matches the contract's 25-day vector", () => {
    expect(Array.from({ length: 25 }, (_, day) => worldBane(5n, day, null, 20))).toEqual([
      null,
      null,
      3,
      null,
      null,
      null,
      3,
      null,
      null,
      1,
      null,
      1,
      null,
      null,
      3,
      null,
      null,
      2,
      null,
      null,
      3,
      null,
      null,
      null,
      null,
    ]);
  });
  it("starts on day two and always leaves the day after a bane clear", () => {
    for (let seed = 0n; seed < 20n; seed++) {
      const days = Array.from({ length: 50 }, (_, day) => worldBane(seed, day, null, 20));
      expect(days[0]).toBeNull();
      for (let day = 1; day < days.length; day++) if (days[day - 1] !== null) expect(days[day]).toBeNull();
    }
  });
  it("keeps today's roll and stops every later roll at first team issuance", () => {
    expect(worldBane(14n, 1, 1, 20)).toBe(bane.MIST_TIDE);
    for (let day = 2; day < 50; day++) expect(worldBane(14n, day, 1, 20)).toBeNull();
  });
  it("selects the single replacement quest for each effect", () => {
    expect([bane.BLOOD_MOON, bane.MIST_TIDE, bane.ASH_FALL].map(baneQuest)).toEqual([
      quest.STAND,
      quest.LIGHTS,
      quest.CULL,
    ]);
    expect(() => baneQuest(0)).toThrow("Unknown world bane");
  });
});
