import { readFileSync } from "node:fs";
import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { type CombatRules, type ExchangeTroops, forecastFight, resolveExchange } from "./combat-exchange";

/**
 * The contract's own record of 200 exchanges (frontier-combat-v2.txt, written by its snforge producer): every loss and
 * stamina value must come out of resolveExchange as the same integer.
 */
const FIXTURE = new URL("../../../../contracts/l3/world-native/tests/fixtures/frontier-combat-v2.txt", import.meta.url);
const HEADER_FELTS = 24;
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
    dayUnitSeconds: 0,
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
  const attackDistance = Number(next());
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

it("uses the same expedition damage for Knights attacking armies and site guards", () => {
  const { rules, cases } = readFixture();
  const recorded = cases[0]!;
  const expeditionRules: CombatRules = {
    ...rules,
    dayUnitSeconds: 14_400,
    stamina: { ...rules.stamina, stamina_defense_req: 0 },
  };
  const army: ExchangeTroops = {
    ...recorded.attacker,
    category: "Knight",
    tier: "T1",
    count: 1_500n * 1_000_000_000n,
    stamina: { amount: 180n, settled_at: recorded.context.timestamp, remainder: 0 },
  };
  const defender: ExchangeTroops = { ...army, count: 1_000n * 1_000_000_000n };
  const context = { ...recorded.context, attackerIsStructureGuard: false, defenderIsStructureGuard: false };
  const field = resolveExchange(army, defender, context, expeditionRules);
  if (!field.ok) throw new Error(field.refusal);
  expect(field.attackerLoss).toBe(418n * 1_000_000_000n);
  expect(field.defenderLoss).toBe(627n * 1_000_000_000n);
  for (const attackerIsStructureGuard of [false, true]) {
    for (const defenderIsStructureGuard of [false, true]) {
      expect(
        resolveExchange(
          army,
          defender,
          { ...context, attackerIsStructureGuard, defenderIsStructureGuard },
          expeditionRules,
        ),
      ).toEqual(field);
    }
  }
  const exhausted = { ...defender, stamina: { ...defender.stamina, amount: 0n } };
  const result = resolveExchange(army, exhausted, context, expeditionRules);
  if (!result.ok) throw new Error(result.refusal);
  expect(result.attackerLoss).toBe(field.attackerLoss);
  expect(result.defenderLoss).toBe(field.defenderLoss);
});

it("stops a Blitz forecast at the cooldown after this attack", () => {
  const { rules, cases } = readFixture();
  const recorded = cases.find(
    (c) =>
      c.context.attackDistance === 1 &&
      c.expected.defenderLoss < c.defender.count &&
      c.expected.attackerLoss < c.attacker.count,
  )!;
  const blitz = { ...rules, cooldownSeconds: 60 };
  const result = resolveExchange(recorded.attacker, recorded.defender, recorded.context, blitz);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.attacker.battle_cooldown_end).toBeGreaterThan(recorded.context.timestamp);
  expect(result.defender.battle_cooldown_end).toBeGreaterThan(recorded.context.timestamp);
  expect(forecastFight(recorded.attacker, recorded.defender, recorded.context, blitz)).toMatchObject({
    outcome: "stalls",
    exchanges: 1,
    stoppedBy: "cooldown",
    attackerLoss: result.attackerLoss,
    defenderLoss: result.defenderLoss,
  });
  const ranged = resolveExchange(
    recorded.attacker,
    recorded.defender,
    { ...recorded.context, attackDistance: 2 },
    blitz,
  );
  expect(ranged.ok && ranged.attacker.battle_cooldown_end).toBe(recorded.context.timestamp + 30);
});

it("applies Scout damage before rounding for attackers and defenders against armies and guards", () => {
  const { rules, cases } = readFixture();
  const recorded = cases[0]!;
  const expeditionRules: CombatRules = {
    ...rules,
    dayUnitSeconds: 14_400,
    stamina: { ...rules.stamina, stamina_defense_req: 0 },
  };
  const army: ExchangeTroops = {
    ...recorded.attacker,
    category: "Knight",
    tier: "T1",
    count: 1_500n * 1_000_000_000n,
    stamina: { amount: 180n, settled_at: recorded.context.timestamp, remainder: 0 },
  };
  for (const attackerCategory of ["Knight", "Paladin"] as const) {
    for (const defenderCategory of ["Knight", "Paladin"] as const) {
      for (const defenderIsStructureGuard of [false, true]) {
        const result = resolveExchange(
          { ...army, category: attackerCategory },
          { ...army, category: defenderCategory, count: 1_000n * 1_000_000_000n },
          { ...recorded.context, attackerIsStructureGuard: false, defenderIsStructureGuard },
          expeditionRules,
        );
        if (!result.ok) throw new Error(result.refusal);
        expect(result.defenderLoss).toBe((attackerCategory === "Paladin" ? 471n : 627n) * 1_000_000_000n);
        expect(result.attackerLoss).toBe((defenderCategory === "Paladin" ? 314n : 418n) * 1_000_000_000n);
      }
    }
  }
});
