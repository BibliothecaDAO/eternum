import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { ResourcesIds, StructureType, TileOccupier } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import type { LabCommand, LabFact, LabScenario } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
/** The camp the army cleared before the fight. */
const CLEARED_CAMP = 711;
/** How long both stay on battle cooldown after the fight: longer than a session. */
const COOLDOWN_SECONDS = 3_600;

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

/**
 * The owner's army on prod just after its fight (/lab/game?scenario=after-battle): Frontier game 1, 25 October 2026 at
 * 20:53Z, army 0x1703b000000074 attacked the ruin beside it, 4,716 knights against 3,000, and both were left standing,
 * 4,015 against 999, each on its battle cooldown (owner: "I hover the tile but no label ?"). It stood on the tile of
 * the camp it had cleared at 19:43Z (0x1703b000000076, beside the ruin), where only the camp's cleared marker is left.
 * Here realm 7's army is those 4,015 knights on a cleared camp beside a ruin guarded by 999, both on cooldown. The keys are the spire fixture's own for the
 * army's row and the camp it moves away (site-fixture.ts), so each row is rewritten in place.
 */
export const afterBattleScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const armyTile = store.entityOccupancy(1, SPIRE_ARMY)!;
  const ruinTile = besideOnOpenLand(store, armyTile);
  // The map reads a battle's cooldown against the wall clock (getBattleTimerLeft), not the lab's chain clock.
  const cooldownEnd = Math.floor(Date.now() / 1_000) + COOLDOWN_SECONDS;
  const afterTheFight = (count: bigint) => ({
    ...army.troops,
    count: count * PRECISION,
    battle_cooldown_end: cooldownEnd,
  });
  store.applyFacts([
    { model: "ExplorerTroops", key: "0x74", value: wire({ ...army, troops: afterTheFight(4_015n) }) },
    ...ruinAt(store, ruinTile, afterTheFight(999n)),
    clearedCampAt(armyTile),
  ] as never);
  return spire;
};

/**
 * The same army beside the same ruin with no fight yet, its stamina spent (/lab/game?scenario=low-stamina): 5 stamina,
 * short of an attack, and no cooldown on either side. The owner, 27 October 2026: "I right click a monster it should
 * show up the attack modal always even if I dont have enough stamina".
 */
export const lowStaminaScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const spent = {
    ...army.troops,
    stamina: { Inline: { amount: 5n, settled_at: spire.startsAt, remainder: 0 } },
  };
  store.applyFacts([
    { model: "ExplorerTroops", key: "0x74", value: wire({ ...army, troops: spent }) },
    ...ruinAt(store, besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!), {
      ...army.troops,
      count: 999n * PRECISION,
    }),
  ] as never);
  return spire;
};

/** The guard's losses and the attacker's, in the lab's fight: the guard falls, the attacker loses a third of its count. */
const ATTACKER_LOSS_DIVISOR = 3n;

/**
 * The same army beside the same ruin, ready to fight (/lab/game?scenario=fight): its stamina full and no cooldown on
 * either side. The chain answers BattleGuard as a won fight writes it (guards.cairo's battle_guard): the guard's troops
 * gone and the guard destroyed at the fight's moment, the attacker's count less its losses, its attack stamina paid and
 * its battle cooldown set. The losses are the lab's own fixed outcome, not the combat formula: what is timed is the
 * client drawing the fight's facts.
 */
export const fightScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  store.applyFacts([
    ...ruinAt(store, besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!), {
      ...army.troops,
      count: 999n * PRECISION,
    }),
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "BattleGuard" ? answerFight(command, chain, now) : spire.answer(command, chain, now),
  };
};

const answerFight = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const [attackerId, defenderId] = command.calldata.slice(5).map((felt) => BigInt(felt));
  const [guardKey, guard] = [...chain.entries("Guard")].find(([, row]) => row.structure_id === defenderId)!;
  const [armyKey, army] = [...chain.entries("ExplorerTroops")].find(([, row]) => row.explorer_id === attackerId)!;
  const rules = chain.require("SliceRules", { game_id: 1 });
  const stamina = army.troops.stamina as { Inline: { amount: bigint } };
  return [
    {
      model: "Guard",
      key: guardKey,
      value: wire({ ...guard, troops: { ...guard.troops, count: 0n }, destroyed_tick: now }),
    },
    {
      model: "ExplorerTroops",
      key: armyKey,
      value: wire({
        ...army,
        troops: {
          ...army.troops,
          count: army.troops.count - army.troops.count / ATTACKER_LOSS_DIVISOR,
          stamina: {
            Inline: {
              amount: stamina.Inline.amount - BigInt(rules.troop_stamina_config.stamina_attack_req),
              settled_at: now,
              remainder: 0,
            },
          },
          battle_cooldown_end: now + rules.battle_config.cooldown_seconds,
        },
      }),
    },
  ];
};

/** The camp the army cleared, on the tile it stands on: the site's row with its receipt, as clear_site leaves it. */
const clearedCampAt = (tile: { col: number; row: number }): LabFact => ({
  model: "ExpeditionSite",
  key: "0x1ab96",
  value: wire({
    game_id: 1,
    entity_id: CLEARED_CAMP,
    category: StructureType.Camp,
    initial_guard_count: 1_600n * PRECISION,
    alt: false,
    col: tile.col,
    row: tile.row,
    clear: {
      explorer_id: SPIRE_ARMY,
      home_id: 7,
      reward: { resource_type: ResourcesIds.Essence, amount: 4_800n * PRECISION },
    },
  }),
});

/** A ruin on the tile, guarded by the troops given: its structure, its site, its guard and its tile's blocker. */
const ruinAt = (
  store: ReturnType<typeof spireScenario>["store"],
  tile: { col: number; row: number },
  guard: object,
): LabFact[] => [
  {
    model: "Structure",
    key: "0x71",
    value: wire({
      ...store.require("Structure", { game_id: 1, entity_id: 7 }),
      entity_id: SITE,
      owner: 0,
      base: {
        category: StructureType.Ruin,
        level: 0,
        created_at: 1,
        troop_max_guard_count: 1,
        troop_max_explorer_count: 0,
        starting_troops_granted: true,
      },
    }),
  },
  {
    model: "ExpeditionSite",
    key: "0x72",
    value: wire({
      game_id: 1,
      entity_id: SITE,
      category: StructureType.Ruin,
      initial_guard_count: 3_000n * PRECISION,
      alt: false,
      ...tile,
      clear: null,
    }),
  },
  {
    model: "Guard",
    key: "0x73",
    value: wire({ game_id: 1, structure_id: SITE, slot: 0, troops: guard, destroyed_tick: 0 }),
  },
  {
    model: "TileOccupancy",
    key: "0x1ab95",
    value: { game_id: 1, alt: false, ...tile, entity_id: SITE, category: TileOccupier.Ruin, is_structure: true },
  },
];
