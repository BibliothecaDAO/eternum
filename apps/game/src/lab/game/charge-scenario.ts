import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { StructureType } from "@bibliothecadao/types";
import { type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { siteAt } from "./after-battle-scenario";
import { type LabFact, type LabScenario, wire } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
/** The native Charge V regression: one opening exchange followed by an ordinary exchange. */
const EXCHANGES = [
  { before: 1000n, attacker: 658n, defender: 563n },
  { before: 658n, attacker: 386n, defender: 245n },
];

export function chargeScenario(): LabScenario {
  const game = spireScenario();
  const { store } = game;
  const key = { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) };
  const army = store.require("ExplorerTroops", key);
  const rules = store.require("SliceRules", { game_id: 1 });
  const progress = store.require("ArmyProgress", key);
  const tile = besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!);
  const troops = {
    ...army.troops,
    count: 1000n * PRECISION,
    battle_cooldown_end: 0,
    stamina: { Inline: { amount: 100n, settled_at: game.startsAt, remainder: 0 } },
  };
  store.applyFacts([
    { model: "ExplorerTroops", key: store.wireKeyOf("ExplorerTroops", key)!, value: wire({ ...army, troops }) },
    {
      model: "ArmyCombat",
      key: store.wireKeyOf("ArmyCombat", key) ?? "0xc801",
      value: wire({ ...key, charge: 5, last_target: 0 }),
    },
    { model: "ArmyProgress", key: store.wireKeyOf("ArmyProgress", key)!, value: wire({ ...progress, battle: 0 }) },
    {
      model: "SliceRules",
      key: store.wireKeyOf("SliceRules", { game_id: 1 })!,
      value: wire({
        ...rules,
        battle_config: { ...rules.battle_config, cooldown_seconds: 0 },
        troop_damage_config: {
          ...rules.troop_damage_config,
          damage_biome_bonus_num: 0,
          damage_scaling_factor: 36893488147419103232n,
        },
        troop_stamina_config: {
          ...rules.troop_stamina_config,
          stamina_gain_per_tick: 0,
          stamina_attack_req: 10,
          stamina_defense_req: 0,
          damage_stamina_refund: false,
        },
      }),
    },
    ...siteAt(store, tile, troops, StructureType.Camp).map((fact) => ({ ...fact, value: wire(fact.value) })),
  ]);
  return {
    ...game,
    answer: (command, chain, now) =>
      command.kind === "BattleGuard" && Number(command.fields.defender_id) === SITE
        ? exchange(chain, BigInt(command.fields.attacker_id), now)
        : game.answer(command, chain, now),
  };
}

function exchange(store: NativeFactStore, explorerId: bigint, now: number): LabFact[] {
  const key = { game_id: 1, explorer_id: explorerId };
  const army = store.require("ExplorerTroops", key);
  const combat = store.require("ArmyCombat", key);
  const guardKey = { game_id: 1, structure_id: BigInt(SITE), slot: 0 };
  const guard = store.require("Guard", guardKey);
  const next = EXCHANGES.find(({ before }) => army.troops.count === before * PRECISION);
  if (!next || !("Inline" in army.troops.stamina)) throw new Error("Charge proof has no matching exchange");
  return [
    {
      model: "ExplorerTroops",
      key: store.wireKeyOf("ExplorerTroops", key)!,
      value: wire({
        ...army,
        troops: {
          ...army.troops,
          count: next.attacker * PRECISION,
          stamina: { Inline: { amount: army.troops.stamina.Inline.amount - 10n, settled_at: now, remainder: 0 } },
        },
      }),
    },
    {
      model: "Guard",
      key: store.wireKeyOf("Guard", guardKey)!,
      value: wire({ ...guard, troops: { ...guard.troops, count: next.defender * PRECISION } }),
    },
    ...(combat.last_target === BigInt(SITE)
      ? []
      : [
          {
            model: "ArmyCombat",
            key: store.wireKeyOf("ArmyCombat", key)!,
            value: wire({ ...combat, last_target: BigInt(SITE) }),
          },
        ]),
  ];
}
