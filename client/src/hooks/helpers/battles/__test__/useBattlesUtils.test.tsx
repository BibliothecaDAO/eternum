import { BattleSide } from "@bibliothecadao/eternum";
import { Component, Entity, runQuery } from "@dojoengine/recs";
import { describe, expect, it, vi } from "vitest";
import { BattleInfo, filterBattles } from "../useBattles";
import * as testedModule from "../useBattlesUtils";
import { generateMockArmy, generateMockBattle } from "./__mock__";

vi.mock("@dojoengine/recs", async () => {
  const actual = await vi.importActual("@dojoengine/recs");
  return {
    ...actual,
    runQuery: vi.fn(),
  };
});

describe("protectorStillInBattle test", () => {
  it("should return true for a single protector in the battle", () => {
    const protectors = new Set(["0x0" as Entity]);
    vi.mocked(runQuery).mockReturnValue(protectors);

    const isInBattle = testedModule.protectorStillInBattle({} as any, {} as any, {} as any);
    expect(isInBattle).toBe(true);
  });

  it("should return false for no protector in the battle", () => {
    const protectors = new Set([]);
    vi.mocked(runQuery).mockReturnValue(protectors);

    const isInBattle = testedModule.protectorStillInBattle({} as any, {} as any, {} as any);
    expect(isInBattle).toBe(false);
  });

  it("should return true for multiple protectors in the battle", () => {
    const protectors = new Set(["0x1" as Entity, "0x2" as Entity]);
    vi.mocked(runQuery).mockReturnValue(protectors);

    const isInBattle = testedModule.protectorStillInBattle({} as any, {} as any, {} as any);
    expect(isInBattle).toBe(true);
  });
});

describe("armyHasLost test", () => {
  it("should return false for an ongoing battle", () => {
    const battle = generateMockBattle(true, true, false);
    const army = generateMockArmy(BattleSide.Attack);

    const isLosingSide = testedModule.armyHasLost(army, battle);
    expect(isLosingSide).toBe(false);
  });

  it("should return true for an ongoing battle", () => {
    const battle = generateMockBattle(false, true, false);
    const army = generateMockArmy(BattleSide.Attack);

    const isLosingSide = testedModule.armyHasLost(army, battle);
    expect(isLosingSide).toBe(true);
  });

  it("should return false for an empty battle", () => {
    const battle = generateMockBattle(false, true, false);
    const army = generateMockArmy(BattleSide.Attack);

    const isLosingSide = testedModule.armyHasLost(army, battle);
    expect(isLosingSide).toBe(true);
  });
});

describe("battleIsEmpty test", () => {
  it("should return true when there are no attackers and defenders", () => {
    const battle = generateMockBattle(true, true, false);
    const Army = {} as Component;

    vi.mocked(runQuery).mockReturnValueOnce(new Set([])).mockReturnValueOnce(new Set([]));

    const isEmpty = testedModule.battleIsEmpty(Army, battle);
    expect(isEmpty).toBe(true);
  });

  it("should return false when there are attackers", () => {
    const battle = generateMockBattle(true, true, false);
    const Army = {} as Component;

    vi.mocked(runQuery)
      .mockReturnValueOnce(new Set(["0x1" as Entity]))
      .mockReturnValueOnce(new Set([]));

    const isEmpty = testedModule.battleIsEmpty(Army, battle);
    expect(isEmpty).toBe(false);
  });

  it("should return false when there are defenders", () => {
    const battle = generateMockBattle(true, true, false);
    const Army = {} as Component;

    vi.mocked(runQuery)
      .mockReturnValueOnce(new Set([]))
      .mockReturnValueOnce(new Set(["0x2" as Entity]));

    const isEmpty = testedModule.battleIsEmpty(Army, battle);
    expect(isEmpty).toBe(false);
  });

  it("should return false when there are both attackers and defenders", () => {
    const battle = generateMockBattle(true, true, false);
    const Army = {} as Component;

    vi.mocked(runQuery)
      .mockReturnValueOnce(new Set(["0x1" as Entity]))
      .mockReturnValueOnce(new Set(["0x2" as Entity]));

    const isEmpty = testedModule.battleIsEmpty(Army, battle);
    expect(isEmpty).toBe(false);
  });
});

describe("filterBattles", () => {
  const mockArmy = {} as Component;
  const mockProtectee = {} as Component;

  it("should return true when battle is not finished", () => {
    const mockBattle = {} as BattleInfo;
    const spy = vi.spyOn(testedModule, "battleIsFinished");
    spy.mockReturnValue(false);

    const result = filterBattles(mockBattle, mockArmy, mockProtectee);
    expect(result).toBe(true);
    expect(spy).toHaveBeenCalledWith(mockArmy, mockBattle);
  });

  it("should return true when battle is finished but structure battle and protector is still inside", () => {
    const mockBattle = { isStructureBattle: true } as BattleInfo;
    const spyBattleIsFinished = vi.spyOn(testedModule, "battleIsFinished");
    spyBattleIsFinished.mockReturnValue(true);

    const spyProtectorStillInBattle = vi.spyOn(testedModule, "protectorStillInBattle");
    spyProtectorStillInBattle.mockReturnValue(true);

    const result = filterBattles(mockBattle, mockArmy, mockProtectee);
    expect(result).toBe(true);

    expect(spyBattleIsFinished).toHaveBeenCalledWith(mockArmy, mockBattle);
  });

  it("should return false when battle is finished and it's not a structure battle", () => {
    const mockBattle = { isStructureBattle: false } as BattleInfo;
    vi.spyOn(testedModule, "battleIsFinished").mockReturnValue(true);
    vi.spyOn(testedModule, "protectorStillInBattle").mockReturnValue(true);

    const result = filterBattles(mockBattle, mockArmy, mockProtectee);
    expect(result).toBe(false);
  });

  it("should return false when battle is finished, it's a structure battle and protector is not in battle", () => {
    const mockBattle = { isStructureBattle: true } as BattleInfo;
    vi.spyOn(testedModule, "battleIsFinished").mockReturnValue(true);
    vi.spyOn(testedModule, "protectorStillInBattle").mockReturnValue(false);

    const result = filterBattles(mockBattle, mockArmy, mockProtectee);
    expect(result).toBe(false);
  });
});
