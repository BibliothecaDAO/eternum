import { describe, expect, it } from "bun:test";
import { classifyBattleOutcome, pickBattle, summarizeBattles, type BattleCandidate } from "./combat";
import { isThresholdBlockingFailure } from "./report";

const candidate = (overrides: Partial<BattleCandidate>): BattleCandidate => ({
  explorerId: 1,
  targetId: 10,
  target: "structure",
  distance: 1,
  ...overrides,
});

const rejected = (reason: string) => ({
  kind: "attack",
  outcome: "rejected" as const,
  error: `Error: Player action rejected: ${reason}`,
});

describe("battle target pick", () => {
  it("attacks an enemy explorer before a nearer structure, then the nearest", () => {
    const camp = candidate({ targetId: 7, target: "structure", distance: 1 });
    const far = candidate({ targetId: 8, target: "explorer", distance: 3 });
    const near = candidate({ explorerId: 2, targetId: 9, target: "explorer", distance: 2 });
    expect(pickBattle([camp, far, near])).toEqual(near);
    expect(pickBattle([camp])).toEqual(camp);
    expect(pickBattle([])).toBeUndefined();
  });

  it("breaks ties the same way every run", () => {
    const later = candidate({ explorerId: 5, targetId: 3 });
    const earlier = candidate({ explorerId: 4, targetId: 6 });
    expect(pickBattle([later, earlier])).toEqual(earlier);
    expect(pickBattle([earlier, later])).toEqual(earlier);
  });
});

describe("battle outcome", () => {
  it("counts the game's legal refusals by reason", () => {
    const refusals: Array<[string, string]> = [
      ["insufficient stamina, you need: 30, and have: 12", "stamina"],
      ["you have 12 stamina, but need 30 to launch attack", "stamina"],
      ["explorers are not adjacent", "out_of_range"],
      ["you need to wait 14 seconds before you can attack", "cooldown"],
      ["missing explorer", "combatant_gone"],
      ["dead combatant", "combatant_gone"],
      ["explorers out of range", "out_of_range"],
      ["structure is out of range", "out_of_range"],
      ["target explorer is dead", "target_gone"],
      ["the defender has no troops", "target_gone"],
      ["aggressor has no troops", "attacker_gone"],
      ["season immunity", "immunity"],
    ];
    for (const [reason, refusal] of refusals)
      expect(classifyBattleOutcome(rejected(reason))).toEqual({ result: "refused", reason: refusal as never });
  });

  it("fails a battle the bot caused or that never reached the game", () => {
    expect(classifyBattleOutcome(rejected("actor owns defender"))).toEqual({ result: "failed" });
    expect(classifyBattleOutcome(rejected("realm pool index out of range"))).toEqual({ result: "failed" });
    expect(classifyBattleOutcome({ outcome: "submit_failed", error: "fetch failed" })).toEqual({ result: "failed" });
    expect(classifyBattleOutcome({ outcome: "confirmation_timeout", error: "no receipt" })).toEqual({
      result: "failed",
    });
    expect(classifyBattleOutcome({ outcome: "reverted", error: "Transaction reverted" })).toEqual({ result: "failed" });
    expect(classifyBattleOutcome({ outcome: "completed" })).toEqual({ result: "succeeded" });
  });

  it("summarizes attacks alone, and a legal refusal never blocks the run", () => {
    const actions = [
      { kind: "attack", outcome: "completed" as const },
      rejected("explorers out of range"),
      rejected("explorers out of range"),
      rejected("actor owns defender"),
      { kind: "move", outcome: "completed" as const },
    ];
    expect(summarizeBattles(actions)).toEqual({ attempted: 4, succeeded: 1, refused: { out_of_range: 2 }, failed: 1 });
    const refused = {
      ...rejected("season immunity"),
      battle: { ...candidate({}), result: "refused" as const, reason: "immunity" as const },
    };
    const caused = { ...rejected("actor owns defender"), battle: { ...candidate({}), result: "failed" as const } };
    expect(isThresholdBlockingFailure(refused)).toBe(false);
    expect(isThresholdBlockingFailure(caused)).toBe(true);
  });
});
