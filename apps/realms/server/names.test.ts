import { describe, expect, it } from "vitest";

import { nameRuleViolation } from "./name-rules";

describe("nameRuleViolation", () => {
  it("accepts names within the rules", () => {
    for (const name of ["Redbeard", "1337 W1Z4RD", "a-b", "Lord_of_Wheat", "abc"]) {
      expect(nameRuleViolation(name)).toBeNull();
    }
  });

  it("rejects lengths outside 3-20", () => {
    expect(nameRuleViolation("ab")).not.toBeNull();
    expect(nameRuleViolation("a".repeat(21))).not.toBeNull();
  });

  it("rejects leading or trailing spaces and stray characters", () => {
    for (const name of [" Redbeard", "Redbeard ", "Red@beard", "Réalm", "0x" + "a".repeat(40)]) {
      expect(nameRuleViolation(name)).not.toBeNull();
    }
  });
});
