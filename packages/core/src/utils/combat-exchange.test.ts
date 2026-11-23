import { readFileSync } from "node:fs";
import { BiomeType, BiomeTypeToId, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { CombatSimulator } from "./combat-simulator";
import { nativeOathConstants as oathConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import {
  type CombatRules,
  type ExchangeTroops,
  forecastFight,
  resolveExchange,
  isCombatGuard,
} from "./combat-exchange";

/**
 * The contract's own record of 200 exchanges (frontier-combat-v2.txt, written by its snforge producer): every loss and
 * stamina value must come out of resolveExchange as the same integer.
 */
const FIXTURE = new URL("../../../../contracts/l3/world-native/tests/fixtures/frontier-combat-v2.txt", import.meta.url);
const HEADER_FELTS = 24;
const RECORD_FELTS = 23;
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
  if (version !== 2n) throw new Error(`Combat fixture version ${version}`);
  if (felts.length !== HEADER_FELTS + Number(caseCount) * RECORD_FELTS) throw new Error("Combat fixture length");
  const rules = readRules(header.slice(2));
  const cases = Array.from({ length: Number(caseCount) }, () => readCase(next, rules.tickSeconds));
  return { rules, cases };
};

const readRules = (felts: bigint[]): CombatRules => {
  const [biomeBonus, scaling, t1, t2, t3, ...stamina] = felts;
  const flags = stamina.map(Number);
  return {
    cooldownSeconds: 0,
    tickSeconds: flags[16]!,
    damage: {
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

const readSide = (next: () => bigint, currentTick: bigint, tickSeconds: number): ExchangeTroops => {
  const category = CATEGORIES[Number(next())]!;
  const tier = TIERS[Number(next())]!;
  const count = next();
  // The archived vector stores a tick index; convert its input to seconds.
  const stamina = { amount: next(), settled_at: Number(next()) * tickSeconds, remainder: 0 };
  const damageBonusPercent = Number(next());
  return {
    category,
    tier,
    count,
    stamina,
    boosts: {
      incr_damage_dealt_percent_num: damageBonusPercent * 100,
      incr_damage_dealt_end_at: (Number(currentTick) + 1) * tickSeconds,
      decr_damage_gotten_percent_num: 0,
      decr_damage_gotten_end_at: 0,
      incr_stamina_regen_percent_num: 0,
      incr_stamina_regen_seconds_left: 0,
      incr_explore_reward_percent_num: 0,
      incr_explore_reward_end_at: 0,
    },
    battle_cooldown_end: 0,
  };
};

const readCase = (next: () => bigint, tickSeconds: number) => {
  const id = Number(next());
  const alt = next() === 1n;
  const biome = BIOMES.get(Number(next()));
  if (!biome) throw new Error("Unknown biome in the combat fixture");
  const timestamp = Number(next());
  const currentTick = next();
  const attackerIsStructureGuard = next() === 1n;
  const defenderIsStructureGuard = next() === 1n;
  const attacker = readSide(next, currentTick, tickSeconds);
  const defender = readSide(next, currentTick, tickSeconds);
  const expected = {
    attackerLoss: next(),
    defenderLoss: next(),
    attackerStamina: next(),
    defenderStamina: next(),
  };
  const context = {
    timestamp,
    attackerBiome: biome,
    defenderBiome: biome,
    attackerIsStructureGuard,
    defenderIsStructureGuard,
    attackerOaths: 0,
    defenderOaths: 0,
    attackerTwin: null,
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

  it("drops damage and defence relics exactly at their end second", () => {
    const recorded = cases.find((candidate) => candidate.expected.defenderLoss < candidate.defender.count)!;
    const { timestamp } = recorded.context;
    const army = (endAt: number, percent: number): ExchangeTroops => ({
      ...recorded.attacker,
      boosts: {
        ...recorded.attacker.boosts,
        incr_damage_dealt_percent_num: percent,
        incr_damage_dealt_end_at: endAt,
      },
    });
    const guard = (endAt: number, percent: number): ExchangeTroops => ({
      ...recorded.defender,
      boosts: {
        ...recorded.defender.boosts,
        decr_damage_gotten_percent_num: percent,
        decr_damage_gotten_end_at: endAt,
      },
    });
    const resolve = (endAt: number, damage: number, defence: number) => {
      const result = resolveExchange(army(endAt, damage), guard(endAt, defence), recorded.context, rules);
      if (!result.ok) throw new Error(result.refusal);
      return result.defenderLoss;
    };
    const plain = resolve(timestamp, 0, 0);
    expect(resolve(timestamp, 5000, 0)).toBe(plain);
    expect(resolve(timestamp, 0, 5000)).toBe(plain);
    expect(resolve(timestamp + 1, 5000, 0)).toBeGreaterThan(plain);
    expect(resolve(timestamp + 1, 0, 5000)).toBeLessThan(plain);
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
    // The first exchange is the one attack a player sends: its toll is the recorded exchange's, not the fight's.
    expect(forecast.firstExchange).toEqual({
      attackerLoss: recorded.expected.attackerLoss,
      defenderLoss: recorded.expected.defenderLoss,
    });
    expect(forecast.defenderLoss).toBeGreaterThan(recorded.expected.defenderLoss);
    expect(forecast.staminaSpent).toBe(BigInt(forecast.exchanges * rules.stamina.stamina_attack_req));
  });
});

it("protects Frontier Knights only when they hold a guard slot", () => {
  const { rules, cases } = readFixture();
  const recorded = cases[0]!;
  const army: ExchangeTroops = {
    ...recorded.attacker,
    category: "Knight",
    tier: "T1",
    count: 1_500n * 1_000_000_000n,
    stamina: { amount: 180n, settled_at: recorded.context.timestamp, remainder: 0 },
  };
  const defender: ExchangeTroops = { ...army, count: 1_000n * 1_000_000_000n };
  const context = { ...recorded.context, attackerIsStructureGuard: false, defenderIsStructureGuard: false };
  const field = resolveExchange(army, defender, context, rules);
  if (!field.ok) throw new Error(field.refusal);
  expect(field.attackerLoss).toBe(418n * 1_000_000_000n);
  expect(field.defenderLoss).toBe(627n * 1_000_000_000n);
  for (const attackerIsStructureGuard of [false, true]) {
    for (const defenderIsStructureGuard of [false, true]) {
      expect(
        resolveExchange(army, defender, { ...context, attackerIsStructureGuard, defenderIsStructureGuard }, rules),
      ).toMatchObject({
        ok: true,
        attackerLoss: (attackerIsStructureGuard ? 314n : 418n) * 1_000_000_000n,
        defenderLoss: (defenderIsStructureGuard ? 471n : 627n) * 1_000_000_000n,
      });
    }
  }
  const exhausted = { ...defender, stamina: { ...defender.stamina, amount: 0n } };
  const result = resolveExchange(army, exhausted, context, rules);
  if (!result.ok) throw new Error(result.refusal);
  expect(result.attackerLoss).toBe(field.attackerLoss);
  expect(result.defenderLoss).toBe(field.defenderLoss);
});

it("stops a forecast at the cooldown after this attack", () => {
  const { rules, cases } = readFixture();
  const recorded = cases.find(
    (c) => c.expected.defenderLoss < c.defender.count && c.expected.attackerLoss < c.attacker.count,
  )!;
  const cooled = { ...rules, cooldownSeconds: 60 };
  const result = resolveExchange(recorded.attacker, recorded.defender, recorded.context, cooled);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.attacker.battle_cooldown_end).toBeGreaterThan(recorded.context.timestamp);
  expect(result.defender.battle_cooldown_end).toBeGreaterThan(recorded.context.timestamp);
  expect(forecastFight(recorded.attacker, recorded.defender, recorded.context, cooled)).toMatchObject({
    outcome: "stalls",
    exchanges: 1,
    stoppedBy: "cooldown",
    attackerLoss: result.attackerLoss,
    defenderLoss: result.defenderLoss,
  });
});

it("applies the Scout damage reduction to attacker and defender", () => {
  const { rules, cases } = readFixture();
  const base = cases[0]!;
  const troops = (category: ExchangeTroops["category"]): ExchangeTroops => ({
    ...base.attacker,
    category,
    tier: "T1",
    count: 1000_000_000_000n,
    stamina: { amount: 100n, settled_at: base.context.timestamp, remainder: 0 },
    battle_cooldown_end: 0,
    boosts: { ...base.attacker.boosts, incr_damage_dealt_percent_num: 0 },
  });
  const context = {
    ...base.context,
    attackerBiome: BiomeType.Grassland,
    defenderBiome: BiomeType.Grassland,
    attackerIsStructureGuard: false,
    defenderIsStructureGuard: false,
  };
  for (const [attacker, outgoing] of [
    ["Knight", 437n],
    ["Paladin", 328n],
  ] as const) {
    for (const [defender, incoming] of [
      ["Knight", 437n],
      ["Paladin", 328n],
    ] as const) {
      const result = resolveExchange(troops(attacker), troops(defender), context, {
        ...rules,
        damage: { ...rules.damage, damage_scaling_factor: 36893488147419103232n, damage_biome_bonus_num: 0 },
      });
      expect(result).toMatchObject({
        ok: true,
        defenderLoss: outgoing * 1_000_000_000n,
        attackerLoss: incoming * 1_000_000_000n,
      });
    }
  }
});

it("matches native refunds and cooldowns when an attack wipes the defender or neither side deals damage", () => {
  const fixture = readFixture();
  const base = fixture.cases[0]!;
  const rules: CombatRules = {
    ...fixture.rules,
    cooldownSeconds: 100,
    damage: { ...fixture.rules.damage, damage_scaling_factor: 36893488147419103232n, damage_biome_bonus_num: 0 },
    stamina: {
      ...fixture.rules.stamina,
      stamina_gain_per_tick: 0,
      stamina_attack_req: 10,
      stamina_defense_req: 20,
      damage_stamina_refund: true,
    },
  };
  const context = {
    ...base.context,
    attackerBiome: BiomeType.Grassland,
    defenderBiome: BiomeType.Grassland,
    attackerIsStructureGuard: false,
    defenderIsStructureGuard: true,
  };
  for (const shielded of [false, true]) {
    const attacker: ExchangeTroops = {
      ...base.attacker,
      category: "Knight",
      tier: "T1",
      count: 1000_000_000_000n,
      battle_cooldown_end: 0,
      stamina: { amount: 100n, settled_at: context.timestamp, remainder: 0 },
      boosts: {
        ...base.attacker.boosts,
        incr_damage_dealt_percent_num: 0,
        decr_damage_gotten_percent_num: shielded ? 10000 : 0,
        decr_damage_gotten_end_at: 0,
      },
    };
    expect(resolveExchange(attacker, { ...attacker, count: 1_000_000_000n }, context, rules)).toMatchObject({
      ok: true,
      attackerLoss: shielded ? 0n : 1_000_000_000n,
      defenderLoss: shielded ? 0n : 1_000_000_000n,
      attacker: {
        count: (shielded ? 1000n : 999n) * 1_000_000_000n,
        stamina: { amount: shielded ? 90n : 100n },
        battle_cooldown_end: context.timestamp + (shielded ? 100 : 0),
      },
      defender: {
        count: shielded ? 1_000_000_000n : 0n,
        stamina: { amount: 80n },
        battle_cooldown_end: context.timestamp + 100,
      },
    });
  }
});

it("resolves bow-first exchanges in both directions, including annihilation and repeated shots", () => {
  const fixture = readFixture();
  const base = fixture.cases[0]!;
  const rules: CombatRules = {
    ...fixture.rules,
    cooldownSeconds: 0,
    damage: { ...fixture.rules.damage, damage_scaling_factor: 36893488147419103232n, damage_biome_bonus_num: 0 },
    stamina: { ...fixture.rules.stamina, stamina_attack_req: 30, damage_stamina_refund: false },
  };
  const army = (category: ExchangeTroops["category"], count = 1000n): ExchangeTroops => ({
    ...base.attacker,
    category,
    tier: "T1",
    count: count * 1_000_000_000n,
    stamina: { amount: 100n, settled_at: base.context.timestamp, remainder: 0 },
    boosts: { ...base.attacker.boosts, incr_damage_dealt_percent_num: 0 },
  });
  const context = { ...base.context, attackerIsStructureGuard: false, defenderIsStructureGuard: false };
  const cases: [ExchangeTroops["category"], ExchangeTroops["category"], bigint, bigint][] = [
    ["Crossbowman", "Knight", 328n, 294n],
    ["Knight", "Crossbowman", 294n, 328n],
    ["Crossbowman", "Paladin", 328n, 220n],
    ["Paladin", "Crossbowman", 220n, 328n],
    ["Crossbowman", "Crossbowman", 328n, 328n],
  ];
  for (const [a, b, dealt, taken] of cases) {
    const result = resolveExchange(army(a), army(b), context, rules);
    expect(result).toMatchObject({
      ok: true,
      attackerLoss: taken * 1_000_000_000n,
      defenderLoss: dealt * 1_000_000_000n,
    });
    if (!result.ok) throw new Error(result.refusal);
    expect(result.attacker.stamina.amount).toBe(70n);
    const next = resolveExchange(result.attacker, result.defender, context, rules);
    expect(next.ok && next.attacker.stamina.amount).toBe(40n);
    expect(next.ok && next.attackerLoss).not.toBe(0n);
    expect(next.ok && next.defenderLoss).not.toBe(0n);
  }
  for (const bowAttacks of [false, true]) {
    const bow = army("Crossbowman");
    const blade = army("Knight", 1n);
    const result = resolveExchange(bowAttacks ? bow : blade, bowAttacks ? blade : bow, context, rules);
    expect(result).toMatchObject({
      ok: true,
      attackerLoss: bowAttacks ? 0n : 1_000_000_000n,
      defenderLoss: bowAttacks ? 1_000_000_000n : 0n,
    });
  }
});

it("separates a beast from a player guard", () => {
  expect(isCombatGuard(0n)).toBe(false);
  expect(isCombatGuard(1n)).toBe(true);
  expect(() => isCombatGuard(null)).toThrow("Combat guard owner is missing");
});

it("matches all Oath damage vectors on both sides, including bows and stacked slot protection", () => {
  const { rules, cases } = readFixture();
  const base = cases[0]!;
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-damage.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(BigInt);
  expect(fields).toHaveLength(280);
  const oathRules: CombatRules = {
    ...rules,
    damage: { ...rules.damage, damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232n },
    stamina: {
      ...rules.stamina,
      damage_stamina_refund: false,
      stamina_attack_req: 10,
      stamina_defense_req: 0,
      stamina_gain_per_tick: 0,
    },
  };
  const simulator = new CombatSimulator(
    {
      ...oathRules.damage,
      tick_interval_seconds: oathRules.tickSeconds,
      stamina_attack_req: oathRules.stamina.stamina_attack_req,
      stamina_defense_req: oathRules.stamina.stamina_defense_req,
    },
    oathRules,
  );
  while (fields.length) {
    const [a, b, ao, bo, ag, bg, beforeA, beforeB, afterA, afterB] = fields.splice(0, 10) as bigint[];
    const army = (category: bigint, count: bigint): ExchangeTroops => ({
      ...base.attacker,
      category: CATEGORIES[Number(category)]!,
      tier: "T1",
      count: count * 1_000_000_000n,
      stamina: { amount: 100n, settled_at: 1, remainder: 0 },
      boosts: { ...base.attacker.boosts, incr_damage_dealt_percent_num: 0, decr_damage_gotten_percent_num: 0 },
    });
    const result = resolveExchange(
      army(a!, beforeA!),
      army(b!, beforeB!),
      {
        timestamp: 1,
        attackerBiome: BiomeType.Underground,
        defenderBiome: BiomeType.Underground,
        attackerIsStructureGuard: ag === 1n,
        defenderIsStructureGuard: bg === 1n,
        attackerOaths: Number(ao),
        defenderOaths: Number(bo),
        attackerTwin: null,
      },
      oathRules,
    );
    expect(result).toMatchObject({
      ok: true,
      attacker: { count: afterA! * 1_000_000_000n, stamina: { amount: 90n } },
      defender: { count: afterB! * 1_000_000_000n, stamina: { amount: 100n } },
    });
    const simulatedArmy = (category: bigint, count: bigint, oaths: bigint) => ({
      troopType: CATEGORIES[Number(category)]! as TroopType,
      tier: TroopTier.T1,
      troopCount: Number(count),
      stamina: 100,
      battle_cooldown_end: 0,
      oaths: Number(oaths),
    });
    expect(
      simulator.simulateBattle(
        1,
        simulatedArmy(a!, beforeA!, ao!),
        simulatedArmy(b!, beforeB!, bo!),
        BiomeType.Underground,
        { attackerIsStructureGuard: ag === 1n, defenderIsStructureGuard: bg === 1n },
      ),
    ).toMatchObject({
      ok: true,
      attackerDamage: Number(beforeB! - afterB!),
      defenderDamage: Number(beforeA! - afterA!),
      attackerStamina: 90,
      defenderStamina: 100,
    });
  }
});

describe("the fight Oaths", () => {
  const { rules, cases } = readFixture();
  const base = cases[0]!;
  const oathRules: CombatRules = {
    ...rules,
    damage: { ...rules.damage, damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232n },
    stamina: {
      ...rules.stamina,
      damage_stamina_refund: false,
      stamina_attack_req: 10,
      stamina_defense_req: 0,
      stamina_gain_per_tick: 0,
    },
  };
  const bit = (oath: number) => 1 << (oath - 1);
  const army = (count: bigint, stamina: bigint): ExchangeTroops => ({
    ...base.attacker,
    category: "Knight",
    tier: "T1",
    count: count * 1_000_000_000n,
    stamina: { amount: stamina, settled_at: 1, remainder: 0 },
    boosts: { ...base.attacker.boosts, incr_damage_dealt_percent_num: 0, decr_damage_gotten_percent_num: 0 },
  });
  const context = {
    timestamp: 1,
    attackerBiome: BiomeType.Underground,
    defenderBiome: BiomeType.Underground,
    attackerIsStructureGuard: false,
    defenderIsStructureGuard: false,
    attackerOaths: 0,
    defenderOaths: 0,
    attackerTwin: null,
  };
  const attack = (attackerOaths: number, bar: bigint, defenders: bigint) => {
    const result = resolveExchange(army(1_000n, bar), army(defenders, 100n), { ...context, attackerOaths }, oathRules);
    if (!result.ok) throw new Error(result.refusal);
    return result;
  };

  it("deals Skill's extra damage only on the attack that leaves the bar under its line", () => {
    const skill = bit(oathConstants.SKILL);
    const plain = attack(0, 19n, 1_000n).defenderLoss;
    expect(attack(skill, 20n, 1_000n).defenderLoss).toBe(plain);
    expect(attack(skill, 19n, 1_000n).defenderLoss).toBeGreaterThan(plain);
  });

  it("gives back half of an attack's cost with Fury only when the attack beats its target", () => {
    const fury = bit(oathConstants.FURY);
    expect(attack(fury, 100n, 1n).attacker.stamina.amount).toBe(95n);
    expect(attack(0, 100n, 1n).attacker.stamina.amount).toBe(90n);
    expect(attack(fury, 100n, 1_000n).attacker.stamina.amount).toBe(90n);
  });

  it("adds the Twins' share of the companion's own damage as the contract's shared vectors do", () => {
    const fields = readFileSync(
      new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-twins.txt", import.meta.url),
      "utf8",
    )
      .trim()
      .split(/\s+/)
      .map(BigInt);
    expect(fields).toHaveLength(54);
    const side = (category: bigint, count: bigint) => ({
      ...army(count, 100n),
      category: CATEGORIES[Number(category)]!,
    });
    while (fields.length) {
      const [held, a, b, c, beforeA, beforeB, companion, afterA, afterB] = fields.splice(0, 9) as bigint[];
      const result = resolveExchange(
        side(a!, beforeA!),
        side(b!, beforeB!),
        { ...context, attackerOaths: Number(held), attackerTwin: side(c!, companion!) },
        oathRules,
      );
      expect(result).toMatchObject({
        ok: true,
        attacker: { count: afterA! * 1_000_000_000n },
        defender: { count: afterB! * 1_000_000_000n },
      });
    }
  });
});
