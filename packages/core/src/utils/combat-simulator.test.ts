import { describe, expect, it } from "vitest";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/conformance.json";
import { type CombatRules } from "./combat-exchange";
import { type Army, CombatSimulator, type CombatParameters } from "./combat-simulator";

const damage = preset.rules.troop_damage_config;
const rules: CombatRules = {
  dayUnitSeconds: 100,
  cooldownSeconds: 0,
  tickSeconds: preset.rules.tick_config.armies_tick_in_seconds,
  damage: {
    ...damage,
    damage_biome_bonus_num: 0,
    damage_scaling_factor: 36893488147419103232n,
    t1_damage_value: BigInt(damage.t1_damage_value),
    t2_damage_multiplier: BigInt(damage.t2_damage_multiplier),
    t3_damage_multiplier: BigInt(damage.t3_damage_multiplier),
  },
  stamina: {
    ...preset.rules.troop_stamina_config,
    stamina_attack_req: 10,
    stamina_defense_req: 0,
    damage_stamina_refund: false,
  },
};
const parameters: CombatParameters = {
  ...rules.damage,
  day_unit_seconds: rules.dayUnitSeconds,
  stamina_attack_req: rules.stamina.stamina_attack_req,
  stamina_defense_req: rules.stamina.stamina_defense_req,
  tick_interval_seconds: rules.tickSeconds,
};
const army: Army = {
  stamina: 100,
  troopCount: 1000,
  troopType: TroopType.Knight,
  tier: TroopTier.T1,
  battle_cooldown_end: 0,
};
const simulator = new CombatSimulator(parameters, rules);
const simulate = (attacker: Army, defender: Army) =>
  simulator.simulateBattle(100, attacker, defender, BiomeType.None, [], []);

describe("battle lab exchange", () => {
  it("shows exact losses and stamina across two attacks", () => {
    expect(simulate(army, army)).toEqual({
      ok: true,
      attackerDamage: 437,
      defenderDamage: 437,
      attackerStamina: 90,
      defenderStamina: 100,
      attackerCooldownEnd: 100,
      defenderCooldownEnd: 100,
    });
    expect(simulate({ ...army, troopCount: 563, stamina: 90 }, { ...army, troopCount: 563 })).toMatchObject({
      ok: true,
      attackerDamage: 246,
      defenderDamage: 246,
      attackerStamina: 80,
    });
  });

  it("keeps Scouts at three quarters damage", () => {
    const scout = { ...army, troopType: TroopType.Paladin };
    expect(simulate(scout, army)).toMatchObject({ ok: true, attackerDamage: 328, defenderDamage: 437 });
    expect(simulate(army, scout)).toMatchObject({ ok: true, attackerDamage: 437, defenderDamage: 328 });
  });

  it("returns a refusal instead of a battle prediction when the attack cannot execute", () => {
    expect(simulate({ ...army, stamina: 0 }, army)).toEqual({ ok: false, refusal: "insufficient-stamina" });
    expect(simulate({ ...army, battle_cooldown_end: 101 }, army)).toEqual({ ok: false, refusal: "cooldown" });
    expect(simulate(army, { ...army, troopCount: 0 })).toEqual({ ok: false, refusal: "no-troops" });
  });

  it("keeps Blitz ranged costs, cooldowns and structure reduction", () => {
    const blitz = new CombatSimulator(
      { ...parameters, day_unit_seconds: 0, stamina_attack_req: 50, stamina_defense_req: 40 },
      { ...rules, cooldownSeconds: 60 },
    );
    const result = blitz.simulateBattle(
      100,
      { ...army, troopType: TroopType.Crossbowman },
      { ...army, troopType: TroopType.Paladin },
      BiomeType.None,
      [],
      [],
      { attackDistance: 2, defenderIsStructureGuard: true },
    );
    expect(result).toEqual({
      ok: true,
      attackerDamage: 131,
      defenderDamage: 0,
      attackerStamina: 50,
      defenderStamina: 80,
      attackerCooldownEnd: 130,
      defenderCooldownEnd: 130,
    });
  });
});
