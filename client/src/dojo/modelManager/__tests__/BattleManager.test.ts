import { DojoResult } from "@/hooks/context/DojoContext";
import { BattleSide, StructureType } from "@bibliothecadao/eternum";
import { Entity, getComponentValue, runQuery } from "@dojoengine/recs";
import { describe, expect, it, vi } from "vitest";
import { BattleManager, BattleType } from "../BattleManager";
import {
  ARMY_TROOP_COUNT,
  BATTLE_ENTITY_ID,
  BATTLE_INITIAL_HEALTH,
  BATTLE_TROOP_COUNT,
  CURRENT_TIMESTAMP,
  DURATION_LEFT_IF_ONGOING,
  generateMockArmyInfo,
  generateMockBatle,
  generateMockStructure,
  LAST_UPDATED,
} from "./__mock__";

vi.mock("@dojoengine/recs", async () => {
  const actual = await vi.importActual("@dojoengine/recs");
  return {
    ...actual,
    getComponentValue: vi.fn(),
    runQuery: vi.fn(),
  };
});

vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    EternumGlobalConfig: {
      troop: { healthPrecision: 1n, health: 1 },
      resources: {
        resourceMultiplier: 1,
      },
    },
  };
});

const mockDojoResult = {
  account: { address: "0x0" },
  setup: { components: { Battle: {} } },
  network: {},
  masterAccount: {},
} as unknown as DojoResult;

describe("basic functionalities", () => {
  it("should return a valid object", () => {
    const battleManager = new BattleManager(0, mockDojoResult);
    expect(battleManager).toBeDefined();
  });

  it("should return a valid battleEntityId", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);
    expect(battleManager.battleEntityId).toBe(BATTLE_ENTITY_ID);
  });
});

describe("getBattle", () => {
  it("should return a valid battle for a valid mock", () => {
    const mockBattle = generateMockBatle(true);

    vi.mocked(getComponentValue).mockReturnValueOnce(mockBattle);

    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const battle = battleManager.getBattle();
    expect(battle).toBeDefined();
    expect(battle).toBe(mockBattle);
  });
});

describe("isBattle", () => {
  it("should return true for a defined battle object", () => {
    vi.mocked(getComponentValue).mockReturnValueOnce(generateMockBatle(true));

    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    expect(battleManager.isBattle()).toBe(true);
  });

  it("should return false for a undefined battle object", () => {
    vi.mocked(getComponentValue).mockReturnValueOnce(undefined);

    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    expect(battleManager.isBattle()).toBe(false);
  });
});

describe("getElapsedTime", () => {
  const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

  it("should return 0 for undefined battle", () => {
    vi.mocked(getComponentValue).mockReturnValueOnce(undefined);

    expect(battleManager.getElapsedTime(CURRENT_TIMESTAMP)).toBe(0);
  });

  it("should return the difference between current timestamp and last_updated if battle isn't finished", () => {
    vi.mocked(getComponentValue).mockReturnValueOnce(generateMockBatle(true));

    expect(battleManager.getElapsedTime(CURRENT_TIMESTAMP)).toBe(CURRENT_TIMESTAMP - Number(LAST_UPDATED));
  });

  it("should return the duration_left if battle is finished optimistically", () => {
    vi.mocked(getComponentValue).mockReturnValueOnce(generateMockBatle(true));

    expect(battleManager.getElapsedTime(Number(DURATION_LEFT_IF_ONGOING) + 1)).toBe(Number(DURATION_LEFT_IF_ONGOING));
  });

  it("should return the duration_left if battle is finished onchain", () => {
    vi.mocked(getComponentValue).mockReturnValueOnce(generateMockBatle(false));

    expect(battleManager.getElapsedTime(Number(DURATION_LEFT_IF_ONGOING) + 1)).toBe(0);
  });
});

describe("isBattleOngoing", () => {
  const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

  it("should return false for an undefined object", () => {
    vi.mocked(getComponentValue).mockReturnValueOnce(undefined);

    expect(battleManager.isBattleOngoing(CURRENT_TIMESTAMP)).toBe(false);
  });

  it("should return true if current timestamp < last_updated + duration_left", () => {
    vi.mocked(getComponentValue).mockReturnValue(generateMockBatle(true));

    expect(battleManager.isBattleOngoing(CURRENT_TIMESTAMP)).toBe(true);
  });

  it("should return false if current timestamp > last_updated + duration_left", () => {
    vi.mocked(getComponentValue).mockReturnValue(generateMockBatle(false));

    expect(battleManager.isBattleOngoing(CURRENT_TIMESTAMP)).toBe(false);
  });

  it("should return false if current timestamp === last_updated + duration_left", () => {
    vi.mocked(getComponentValue).mockReturnValue(generateMockBatle(true));

    expect(battleManager.isBattleOngoing(Number(DURATION_LEFT_IF_ONGOING))).toBe(false);
  });
});

describe("getUpdatedHealth", () => {
  const battleManager = new BattleManager(0, mockDojoResult);

  it("should return less health if time has passed", () => {
    const currentHealth = { current: 10n, lifetime: 10n };
    const updatedHealth = battleManager["getUdpdatedHealth"](1n, currentHealth, 1);

    expect(updatedHealth).toBe(9n);
  });

  it("should return the same health if time hasn't passed", () => {
    const currentHealth = 10n;
    const health = { current: currentHealth, lifetime: currentHealth };

    const updatedHealth = battleManager["getUdpdatedHealth"](1n, health, 0);

    expect(updatedHealth).toBe(currentHealth);
  });

  it("should return the same health if delta is 0", () => {
    const currentHealth = 10n;
    const health = { current: currentHealth, lifetime: currentHealth };

    const updatedHealth = battleManager["getUdpdatedHealth"](0n, health, 1000);

    expect(updatedHealth).toBe(currentHealth);
  });

  it("should return 0 if damages exceed current health", () => {
    const currentHealth = 10n;
    const health = { current: currentHealth, lifetime: currentHealth };

    const updatedHealth = battleManager["getUdpdatedHealth"](2n, health, 10);

    expect(updatedHealth).toBe(0n);
  });

  it("should return 0 if damages equal current health", () => {
    const currentHealth = 10n;
    const health = { current: currentHealth, lifetime: currentHealth };

    const updatedHealth = battleManager["getUdpdatedHealth"](1n, health, 10);

    expect(updatedHealth).toBe(0n);
  });
});

describe("getUpdatedTroops", () => {
  const battleManager = new BattleManager(0, mockDojoResult);

  it("should return 0 troops if lifetime is 0", () => {
    const currentHealth = { current: 0n, lifetime: 0n };
    const currentTroops = {
      knight_count: 10n,
      paladin_count: 10n,
      crossbowman_count: 10n,
    };

    const updatedTroops = battleManager["getUpdatedTroops"](currentHealth, currentTroops);

    expect(updatedTroops).toStrictEqual({ knight_count: 0n, paladin_count: 0n, crossbowman_count: 0n });
  });

  it("should return the same amount if health and lifetime are the same (army hasn't lost health)", () => {
    const currentHealth = { current: 10n, lifetime: 10n };
    const currentTroops = {
      knight_count: 10n,
      paladin_count: 10n,
      crossbowman_count: 10n,
    };

    const updatedTroops = battleManager["getUpdatedTroops"](currentHealth, currentTroops);

    expect(updatedTroops).toStrictEqual(currentTroops);
  });

  it("should return less troops if current smaller than lifetime (army lost health)", () => {
    const currentHealth = { current: 5n, lifetime: 10n };
    const currentTroops = {
      knight_count: 10n,
      paladin_count: 10n,
      crossbowman_count: 10n,
    };

    const updatedTroops = battleManager["getUpdatedTroops"](currentHealth, currentTroops);

    expect(updatedTroops).toStrictEqual({
      knight_count: 5n,
      paladin_count: 5n,
      crossbowman_count: 5n,
    });
  });

  it("should return event less troops if current is even smaller than lifetime (army lost health)", () => {
    const currentHealth = { current: 10n, lifetime: 100n };
    const currentTroops = {
      knight_count: 10n,
      paladin_count: 10n,
      crossbowman_count: 10n,
    };

    const updatedTroops = battleManager["getUpdatedTroops"](currentHealth, currentTroops);

    expect(updatedTroops).toStrictEqual({
      knight_count: 1n,
      paladin_count: 1n,
      crossbowman_count: 1n,
    });
  });

  it("should throw an error if current is bigger than lifetime", () => {
    const currentHealth = { current: 500n, lifetime: 10n };
    const currentTroops = {
      knight_count: 10n,
      paladin_count: 10n,
      crossbowman_count: 10n,
    };

    expect(() => battleManager["getUpdatedTroops"](currentHealth, currentTroops)).toThrow(
      "Current health shouldn't be bigger than lifetime",
    );
  });
});

describe("updateHealth", () => {
  const battleManager = new BattleManager(0, mockDojoResult);

  it("health should be less than initial if time passed between last updated and current timestamp", () => {
    const battle = generateMockBatle(true);

    vi.mocked(getComponentValue).mockReturnValueOnce(battle);

    battleManager["updateHealth"](battle, CURRENT_TIMESTAMP);

    expect(battle.attack_army_health.current).toBe(
      BATTLE_INITIAL_HEALTH - BigInt(CURRENT_TIMESTAMP) * battle.attack_delta,
    );
    expect(battle.defence_army_health.current).toBe(
      BATTLE_INITIAL_HEALTH - BigInt(CURRENT_TIMESTAMP) * battle.defence_delta,
    );

    expect(battle.attack_army_health.lifetime).toBe(BATTLE_INITIAL_HEALTH);
    expect(battle.defence_army_health.lifetime).toBe(BATTLE_INITIAL_HEALTH);
  });

  it("health should be the same if time hasn't passed", () => {
    const currentTimestampAndLastUpdatedAt = 1;
    const battle = generateMockBatle(true, currentTimestampAndLastUpdatedAt);

    vi.mocked(getComponentValue).mockReturnValueOnce(battle);

    battleManager["updateHealth"](battle, currentTimestampAndLastUpdatedAt);

    expect(battle.attack_army_health.current).toBe(BATTLE_INITIAL_HEALTH);
    expect(battle.defence_army_health.current).toBe(BATTLE_INITIAL_HEALTH);

    expect(battle.attack_army_health.lifetime).toBe(BATTLE_INITIAL_HEALTH);
    expect(battle.defence_army_health.lifetime).toBe(BATTLE_INITIAL_HEALTH);
  });
});

describe("getUpdatedBattle", () => {
  const battleManager = new BattleManager(0, mockDojoResult);

  it("return should be undefined if battle is undefined", () => {
    const currentTimestamp = 0;

    vi.mocked(getComponentValue).mockReturnValueOnce(undefined);

    const battle = battleManager.getUpdatedBattle(currentTimestamp);

    expect(battle).toBeUndefined();
  });

  it("returned battle should be the same if no time has passed", () => {
    const currentTimestamp = 0;

    const battle = generateMockBatle(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const updatedBattle = battleManager.getUpdatedBattle(currentTimestamp);

    expect(updatedBattle).toStrictEqual(battle);
  });

  it("armies should be the same if battle isn't ongoing", () => {
    const currentTimestamp = 100;

    const battle = generateMockBatle(false);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const updatedBattle = battleManager.getUpdatedBattle(currentTimestamp);

    expect(updatedBattle).toStrictEqual(battle);
  });

  it("health of both armies should be less if time has passed", () => {
    const battle = generateMockBatle(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const updatedBattle = battleManager.getUpdatedBattle(CURRENT_TIMESTAMP);

    expect(updatedBattle).toBeDefined();
    expect(updatedBattle!.attack_army_health.current).toBe(
      BATTLE_INITIAL_HEALTH - BigInt(CURRENT_TIMESTAMP) * battle.attack_delta,
    );
    expect(updatedBattle!.attack_army_health.lifetime).toBe(BATTLE_INITIAL_HEALTH);
    expect(updatedBattle!.defence_army_health.current).toBe(
      BATTLE_INITIAL_HEALTH - BigInt(CURRENT_TIMESTAMP) * battle.defence_delta,
    );
    expect(updatedBattle!.defence_army_health.lifetime).toBe(BATTLE_INITIAL_HEALTH);
  });

  it("troops of both armies should be less if time has passed", () => {
    const battle = generateMockBatle(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const updatedBattle = battleManager.getUpdatedBattle(CURRENT_TIMESTAMP);

    expect(updatedBattle).toBeDefined();
    expect(updatedBattle!.attack_army.troops.knight_count).toBe(BATTLE_TROOP_COUNT - 2n);
    expect(updatedBattle!.attack_army.troops.paladin_count).toBe(BATTLE_TROOP_COUNT - 2n);
    expect(updatedBattle!.attack_army.troops.crossbowman_count).toBe(0n);

    expect(updatedBattle!.defence_army.troops.knight_count).toBe(BATTLE_TROOP_COUNT - 2n);
    expect(updatedBattle!.defence_army.troops.paladin_count).toBe(BATTLE_TROOP_COUNT - 2n);
    expect(updatedBattle!.defence_army.troops.crossbowman_count).toBe(0n);
  });
});

describe("getTroopFullHealth", () => {
  const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

  it("should return the correct amount of health", () => {
    const army = generateMockArmyInfo(true);

    const fullHealth = battleManager["getTroopFullHealth"](army.troops);

    expect(fullHealth).toBe(10n);
  });
});

describe("getUpdatedArmy", () => {
  const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

  it("should return undefined if army is undefined", () => {
    const battle = generateMockBatle(true);

    const updatedArmy = battleManager.getUpdatedArmy(undefined, battle);

    expect(updatedArmy).toBeUndefined();
  });

  it("should return army if battle is undefined", () => {
    const army = generateMockArmyInfo();

    const updatedArmy = battleManager.getUpdatedArmy(army, undefined);

    expect(updatedArmy).toStrictEqual(army);
  });

  it("troops should be the same if battle hasn't changed", () => {
    const initialArmy = generateMockArmyInfo(true);

    const battle = generateMockBatle(false);

    const updatedArmy = battleManager.getUpdatedArmy(initialArmy, battle);

    expect(updatedArmy).toBeDefined();
    expect(updatedArmy!.troops.knight_count).toStrictEqual(initialArmy.troops.knight_count);
    expect(updatedArmy!.troops.paladin_count).toStrictEqual(initialArmy.troops.paladin_count);
    expect(updatedArmy!.troops.crossbowman_count).toStrictEqual(initialArmy.troops.crossbowman_count);
  });

  it("health should be the same if battle hasn't changed", () => {
    const initialArmy = generateMockArmyInfo(true);

    const battle = generateMockBatle(false);

    const updatedArmy = battleManager.getUpdatedArmy(initialArmy, battle);

    expect(updatedArmy).toBeDefined();
    expect(updatedArmy!.health.current).toStrictEqual(initialArmy.health.current);
  });

  it("troops should be smaller if health has changed", () => {
    const initialArmy = generateMockArmyInfo(true);

    const battle = generateMockBatle(true);

    const updatedArmy = battleManager.getUpdatedArmy(initialArmy, battle);

    expect(updatedArmy).toBeDefined();
    expect(updatedArmy!.troops.knight_count).toStrictEqual(BigInt(Math.floor(Number(ARMY_TROOP_COUNT) / 2)));
    expect(updatedArmy!.troops.paladin_count).toStrictEqual(BigInt(Math.floor(Number(ARMY_TROOP_COUNT) / 2)));
    expect(updatedArmy!.troops.crossbowman_count).toStrictEqual(0n);
  });

  it("health should be smaller if health has changed", () => {
    const initialArmy = generateMockArmyInfo(true);

    const battle = generateMockBatle(true);

    const updatedArmy = battleManager.getUpdatedArmy(initialArmy, battle);

    expect(updatedArmy).toBeDefined();
    expect(updatedArmy!.health.current).toStrictEqual(BigInt(Math.floor(Number(ARMY_TROOP_COUNT) / 2) * 2));
  });
});

describe("getBattleType", () => {
  it("should return hex battle type if structure is undefined", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);
    const battleType = battleManager.getBattleType(undefined);

    expect(battleType).toBe(BattleType.Hex);
  });

  it("should return realm battle type if structure is a Realm", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.Realm);

    const battleType = battleManager.getBattleType(structure);

    expect(battleType).toBe(BattleType.Realm);
  });

  it("should return structure battle type if structure is a hyperstructure", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.Hyperstructure);

    const battleType = battleManager.getBattleType(structure);

    expect(battleType).toBe(BattleType.Structure);
  });

  it("should return structure battle type if structure is a bank", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.Bank);

    const battleType = battleManager.getBattleType(structure);

    expect(battleType).toBe(BattleType.Structure);
  });

  it("should return structure battle type if structure is a fragment mine", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.FragmentMine);

    const battleType = battleManager.getBattleType(structure);

    expect(battleType).toBe(BattleType.Structure);
  });

  it("should return structure battle type if structure is a settlement", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.Settlement);

    const battleType = battleManager.getBattleType(structure);

    expect(battleType).toBe(BattleType.Structure);
  });
});

describe("isEmpty", () => {
  const battleManager = new BattleManager(0, mockDojoResult);

  it("Should be considered as empty if the array is length 0", () => {
    vi.mocked(runQuery).mockReturnValueOnce(new Set());

    const isEmpty = battleManager.isEmpty();

    expect(isEmpty).toBe(true);
  });

  it("Shouldn't be empty if length is greater than 0", () => {
    vi.mocked(runQuery).mockReturnValueOnce(new Set(["0x01" as Entity]));

    const isEmpty = battleManager.isEmpty();

    expect(isEmpty).toBe(false);
  });
});

describe("isClaimable", () => {
  it("should return false if selectedArmy is undefined", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.Realm);

    const defender = generateMockArmyInfo(true);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, undefined, structure, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return false if battle is ongoing", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const army = generateMockArmyInfo(true);
    const structure = generateMockStructure(StructureType.Realm);
    const defender = generateMockArmyInfo(true);

    const battle = generateMockBatle(true);
    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return false if structure is undefined", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const army = generateMockArmyInfo(true);
    const defender = generateMockArmyInfo(true);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, undefined, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return true if defender is undefined", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const army = generateMockArmyInfo(true);
    const structure = generateMockStructure(StructureType.Hyperstructure);
    const battle = generateMockBatle(false);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, undefined);

    expect(isClaimable).toBe(true);
  });

  it("should return false if structure, selectedArmy and defender are undefined", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, undefined, undefined, undefined);

    expect(isClaimable).toBe(false);
  });

  it("should return false if battle is not a structure battle", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.Realm);
    const army = generateMockArmyInfo(true);
    const battle = generateMockBatle(false);
    const defender = generateMockArmyInfo(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return true if it's a structure battle and there's no protector", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const structure = generateMockStructure(StructureType.FragmentMine);

    const army = generateMockArmyInfo(true);
    const battle = generateMockBatle(false);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, undefined);

    expect(isClaimable).toBe(true);
  });

  it("should return false if battle defence army has health", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const army = generateMockArmyInfo(true);
    const defender = generateMockArmyInfo(true);
    const battle = generateMockBatle(false, undefined, BattleSide.Defence);
    const structure = generateMockStructure(StructureType.FragmentMine);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return false if structure protector has health", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const army = generateMockArmyInfo(true);
    const battle = generateMockBatle(false, undefined, BattleSide.Defence);
    const structure = generateMockStructure(StructureType.FragmentMine);
    const defender = generateMockArmyInfo(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return false if the structure is mine", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const army = generateMockArmyInfo(false);
    const structure = generateMockStructure(StructureType.FragmentMine, true);
    const battle = generateMockBatle(false, undefined, BattleSide.Defence);
    const defender = generateMockArmyInfo(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return false if the selected army has no health", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const army = generateMockArmyInfo(false);
    const structure = generateMockStructure(StructureType.FragmentMine);
    const battle = generateMockBatle(false, undefined, BattleSide.Defence);
    const defender = generateMockArmyInfo(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, army, structure, defender);

    expect(isClaimable).toBe(false);
  });

  it("should return true for a normal case", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const protector = generateMockArmyInfo(false);
    const selectedArmy = generateMockArmyInfo(true);
    const structure = generateMockStructure(StructureType.FragmentMine);
    const battle = generateMockBatle(false, undefined, BattleSide.Defence);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isClaimable = battleManager.isClaimable(CURRENT_TIMESTAMP, selectedArmy, structure, protector);

    expect(isClaimable).toBe(true);
  });
});

// TODO: test is raidable

describe("isAttackable", () => {
  it("Should return false if the defender is undefined", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const isAttackable = battleManager.isAttackable(undefined);

    expect(isAttackable).toBe(false);
  });

  it("Should return false if the battle manager returns a valid battle", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const battle = generateMockBatle(false);
    const defender = generateMockArmyInfo(true);

    vi.mocked(getComponentValue).mockReturnValue(battle);

    const isAttackable = battleManager.isAttackable(defender);

    expect(isAttackable).toBe(false);
  });

  it("Should return false if the battle manager returns an undefined battle and the defender is dead", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const defender = generateMockArmyInfo(false);

    vi.mocked(getComponentValue).mockReturnValue(undefined);

    const isAttackable = battleManager.isAttackable(defender);

    expect(isAttackable).toBe(false);
  });

  it("Should return true if the battle manager returns an undefined battle and the defender is alive", () => {
    const battleManager = new BattleManager(BATTLE_ENTITY_ID, mockDojoResult);

    const defender = generateMockArmyInfo(true);

    vi.mocked(getComponentValue).mockReturnValue(undefined);

    const isAttackable = battleManager.isAttackable(defender);

    expect(isAttackable).toBe(true);
  });
});
