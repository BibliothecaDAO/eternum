import { readFileSync } from "node:fs";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { type CombatRules, type ExchangeTroops, forecastFight, resolveExchange } from "./combat-exchange";

/**
 * The contract's own record of 200 exchanges (frontier-combat-v1.txt, written by its snforge producer): every loss and
 * stamina value must come out of resolveExchange as the same integer.
 */
const FIXTURE = new URL("../../../../contracts/l3/world-native/tests/fixtures/frontier-combat-v1.txt", import.meta.url);
const HEADER_FELTS = 25;
const RECORD_FELTS = 24;
const CATEGORIES = ["Knight", "Paladin", "Crossbowman"] as const;
const TIERS = ["T1", "T2", "T3"] as const;
const BIOMES = new Map(Object.entries(BiomeTypeToId).map(([biome, id]) => [id, biome as BiomeType]));

const readFixture = () => {
  const felts = readFileSync(FIXTURE, "utf8").trim().split(/\s+/).map(BigInt);
  let index = 0;
  const next = () => {
    const felt = felts[index++];
    if (felt === undefined) throw new Error("Truncated combat fixture");
    return felt;
  };
  const header = Array.from({ length: HEADER_FELTS }, next);
  const [version, caseCount] = header;
  if (version !== 1n) throw new Error(`Combat fixture version ${version}`);
  if (felts.length !== HEADER_FELTS + Number(caseCount) * RECORD_FELTS) throw new Error("Combat fixture length");
  const rules = readRules(header.slice(2));
  const cases = Array.from({ length: Number(caseCount) }, () => readCase(next));
  return { rules, cases };
};

const readRules = (felts: bigint[]): CombatRules => {
  const [raid, biomeBonus, scaling, t1, t2, t3, ...stamina] = felts;
  const flags = stamina.map(Number);
  return {
    damage: {
      damage_raid_percent_num: Number(raid),
      damage_biome_bonus_num: Number(biomeBonus),
      damage_scaling_factor: scaling!,
      t1_damage_value: t1!,
      t2_damage_multiplier: t2!,
      t3_damage_multiplier: t3!,
    },
    stamina: {
      stamina_gain_per_tick: flags[0]!,
      stamina_initial: flags[1]!,
      stamina_bonus_value: flags[2]!,
      stamina_knight_max: flags[3]!,
      stamina_paladin_max: flags[4]!,
      stamina_crossbowman_max: flags[5]!,
      stamina_attack_req: flags[6]!,
      stamina_defense_req: flags[7]!,
      stamina_explore_stamina_cost: flags[8]!,
      stamina_travel_stamina_cost: flags[9]!,
      stamina_explore_wheat_cost: flags[10]!,
      stamina_explore_fish_cost: flags[11]!,
      stamina_travel_wheat_cost: flags[12]!,
      stamina_travel_fish_cost: flags[13]!,
      damage_stamina_refund: flags[14] === 1,
      capture_stamina_refund: flags[15]!,
    },
  };
};

const readSide = (next: () => bigint, currentTick: bigint): ExchangeTroops => {
  const category = CATEGORIES[Number(next())]!;
  const tier = TIERS[Number(next())]!;
  const count = next();
  const stamina = { amount: next(), updated_tick: next() };
  const damageBonusPercent = Number(next());
  return {
    category,
    tier,
    count,
    stamina,
    boosts: {
      incr_damage_dealt_percent_num: damageBonusPercent * 100,
      incr_damage_dealt_end_tick: Number(currentTick) + 1,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_tick: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_tick_count: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_tick: 0,
    },
    battle_cooldown_end: 0,
  };
};

const readCase = (next: () => bigint) => {
  const id = Number(next());
  const alt = next() === 1n;
  const biome = BIOMES.get(Number(next()));
  if (!biome) throw new Error("Unknown biome in the combat fixture");
  const attackDistance = Number(next());
  const timestamp = Number(next());
  const currentTick = next();
  const attackerIsStructureGuard = next() === 1n;
  const defenderIsStructureGuard = next() === 1n;
  const attacker = readSide(next, currentTick);
  const defender = readSide(next, currentTick);
  const expected = {
    attackerLoss: next(),
    defenderLoss: next(),
    attackerStamina: next(),
    defenderStamina: next(),
  };
  const context = {
    timestamp,
    currentTick: Number(currentTick),
    attackDistance,
    attackerBiome: biome,
    defenderBiome: biome,
    attackerIsStructureGuard,
    defenderIsStructureGuard,
    attackerRoll: 0,
    defenderRoll: 0,
  };
  return { id, alt, attacker, defender, context, expected };
};

describe("an exchange resolves as the contract resolves it", () => {
  const { rules, cases } = readFixture();

  it("reproduces all 200 recorded exchanges to the troop and the stamina point", () => {
    expect(cases).toHaveLength(200);
    for (const recorded of cases) {
      const result = resolveExchange(recorded.attacker, recorded.defender, recorded.context, rules);
      if (!result.ok) throw new Error(`Case ${recorded.id} refused: ${result.refusal}`);
      expect({
        id: recorded.id,
        attackerLoss: result.attackerLoss,
        defenderLoss: result.defenderLoss,
        attackerStamina: result.attacker.stamina.amount,
        defenderStamina: result.defender.stamina.amount,
      }).toEqual({ id: recorded.id, ...recorded.expected });
    }
  });

  it("gives the surface and Ethereal twin of each exchange the same result", () => {
    const byInputs = new Map<string, bigint[]>();
    for (const recorded of cases) {
      const key = JSON.stringify([recorded.attacker, recorded.defender, recorded.context], (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
      byInputs.set(key, [...(byInputs.get(key) ?? []), recorded.expected.defenderLoss]);
    }
    for (const losses of byInputs.values()) expect(new Set(losses).size).toBe(1);
  });

  it("forecasts a fight as successive exchanges while both sides stand and stamina lasts", () => {
    const recorded = cases.find((candidate) => candidate.expected.defenderLoss < candidate.defender.count)!;
    const forecast = forecastFight(recorded.attacker, recorded.defender, recorded.context, rules);
    if (forecast.outcome === "refused") throw new Error("The first exchange was refused");
    expect(forecast.exchanges).toBeGreaterThan(1);
    expect(forecast.defenderLoss).toBeGreaterThanOrEqual(recorded.expected.defenderLoss);
    expect(forecast.staminaSpent).toBe(BigInt(forecast.exchanges * rules.stamina.stamina_attack_req));
  });
});
