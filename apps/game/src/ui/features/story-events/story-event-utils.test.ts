// @vitest-environment node
import { describe, expect, it } from "vitest";
import { battleRollsOf } from "./story-event-utils";

describe("battle rolls", () => {
  it("reads both d20 rolls from a battle description and nothing from a battle without dice", () => {
    const rolled =
      "Attacker [ana]: Army · Attacker d20: 17 (+17% damage) · Defender d20: 3 (+3% damage) · Winner: Attacker [ana]";
    expect(battleRollsOf(rolled)).toEqual({ attacker: "17", defender: "3" });
    expect(battleRollsOf("Attacker [ana]: Army · Winner: Attacker [ana]")).toBeUndefined();
  });
});
