import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { StructureType } from "@bibliothecadao/types";
import {
  nativeRuleConstants,
  readDeepSites,
  nativeOathConstants as oaths,
  type NativeFactStore,
} from "@bibliothecadao/eternum/game-client";
import { deepScenario } from "./deep-scenario";
import { siteAt } from "./after-battle-scenario";
import { type LabFact, type LabScenario, wire } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
import marks from "../../../../../contracts/l3/world-native/tests/fixtures/frontier-marks.txt?raw";
const EXCHANGES = marks.trim().split(/\s+/).map(BigInt);
import oathDamage from "../../../../../contracts/l3/world-native/tests/fixtures/oath-damage.txt?raw";
const OATH_EXCHANGES = oathDamage
  .trim()
  .split(/\s+/)
  .map(BigInt)
  .filter((_, index) => index % 10 >= 6);

export function battleTargetScenario(withOaths = false): LabScenario {
  const game = spireScenario();
  const troops = prepareBattleArmy(game);
  if (withOaths) holdDamageOaths(game.store, BigInt(SPIRE_ARMY), false);
  const tile = besideOnOpenLand(game.store, game.store.entityOccupancy(1, SPIRE_ARMY)!);
  game.store.applyFacts(
    siteAt(game.store, tile, { ...troops, category: "Knight" }, StructureType.Camp).map((fact) => ({
      ...fact,
      value: wire(fact.value),
    })),
  );
  return {
    ...game,
    answer: (command, chain, now) =>
      command.kind === "BattleGuard" && Number(command.fields.defender_id) === SITE
        ? exchange(chain, BigInt(command.fields.attacker_id), now, BigInt(SITE), withOaths)
        : game.answer(command, chain, now),
  };
}

export function deepBattleTargetScenario(withOaths = false): LabScenario {
  const game = deepScenario();
  const troops = prepareBattleArmy(game);
  if (withOaths) holdDamageOaths(game.store, BigInt(SPIRE_ARMY), false);
  const { store } = game;
  const site = readDeepSites(store, game.startsAt, 1).find(({ kind }) => kind === nativeRuleConstants.DEEP_MINE)!;
  const guard = site.guards[0]!.army;
  if (withOaths) holdDamageOaths(store, guard.explorer_id, true);
  const aspect = store.require("HomeAspect", { game_id: 1, home: guard.owner });
  const rules = store.require("SliceRules", { game_id: 1 });
  const tickSeconds = 3600;
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: store.wireKeyOf("ExplorerTroops", guard)!,
      value: wire({ ...guard, troops: { ...troops, category: "Knight" } }),
    },
    { model: "HomeAspect", key: store.wireKeyOf("HomeAspect", aspect)!, value: wire({ ...aspect, aspect: 2 }) },
    {
      model: "SliceRules",
      key: store.wireKeyOf("SliceRules", rules)!,
      value: wire({ ...rules, tick_config: { ...rules.tick_config, armies_tick_in_seconds: tickSeconds } }),
    },
    ...[SPIRE_ARMY, Number(guard.explorer_id)].map((id) => {
      const row = store.require("DeepArmy", { game_id: 1, explorer_id: id });
      return {
        model: "DeepArmy",
        key: store.wireKeyOf("DeepArmy", row)!,
        value: wire({ ...row, last_tick: Math.floor(game.startsAt / tickSeconds) }),
      };
    }),
  ]);
  return {
    ...game,
    answer: (command, chain, now) =>
      command.kind === "BattleGuard" && BigInt(command.fields.defender_id) === site.id
        ? exchange(chain, BigInt(command.fields.attacker_id), now, site.id, withOaths, guard.explorer_id)
        : game.answer(command, chain, now),
  };
}

function holdDamageOaths(store: NativeFactStore, explorer_id: bigint, guarding: boolean) {
  const key = { game_id: 1, explorer_id };
  const progress = store.require("ArmyProgress", key);
  store.applyFacts([
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", key)!,
      value: wire({
        ...progress,
        oath_slots: 4,
        oaths: (1 << (oaths.POWER - 1)) | (1 << (oaths.GIANTS - 1)) | (guarding ? 1 << (oaths.PROTECTION - 1) : 0),
      }),
    },
  ]);
}

function prepareBattleArmy(game: LabScenario) {
  const { store } = game;
  const key = { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) };
  const army = store.require("ExplorerTroops", key);
  const rules = store.require("SliceRules", { game_id: 1 });
  const troops = {
    ...army.troops,
    category: "Crossbowman" as const,
    count: 1000n * PRECISION,
    battle_cooldown_end: 0,
    stamina: { Inline: { amount: 100n, settled_at: game.startsAt, remainder: 0 } },
  };
  store.applyFacts([
    { model: "ExplorerTroops", key: store.wireKeyOf("ExplorerTroops", key)!, value: wire({ ...army, troops }) },
    {
      model: "ArmyCombat",
      key: store.wireKeyOf("ArmyCombat", key) ?? "0xc801",
      value: wire({ ...key, last_target: 0 }),
    },
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
  ]);
  return troops;
}

function exchange(
  store: NativeFactStore,
  explorerId: bigint,
  now: number,
  siteId: bigint,
  withOaths: boolean,
  guardId?: bigint,
): LabFact[] {
  const key = { game_id: 1, explorer_id: explorerId };
  const army = store.require("ExplorerTroops", key);
  const combat = store.require("ArmyCombat", key);
  const guard =
    guardId === undefined
      ? store.require("Guard", { game_id: 1, structure_id: siteId, slot: 0 })
      : store.require("ExplorerTroops", { game_id: 1, explorer_id: guardId });
  const guardModel = guardId === undefined ? "Guard" : "ExplorerTroops";
  const target = guardId ?? siteId;
  const offset = (guardId === undefined ? 0 : 8) + (combat.last_target === target ? 4 : 0);
  const [before, guardBefore, attackerAfter, defenderAfter] = (withOaths ? OATH_EXCHANGES : EXCHANGES).slice(
    offset,
    offset + 4,
  );
  if (
    army.troops.count !== before! * PRECISION ||
    guard.troops.count !== guardBefore! * PRECISION ||
    !("Inline" in army.troops.stamina)
  )
    throw new Error("Battle proof has no matching exchange");
  return [
    {
      model: "ExplorerTroops",
      key: store.wireKeyOf("ExplorerTroops", key)!,
      value: wire({
        ...army,
        troops: {
          ...army.troops,
          count: attackerAfter! * PRECISION,
          stamina: { Inline: { amount: army.troops.stamina.Inline.amount - 10n, settled_at: now, remainder: 0 } },
        },
      }),
    },
    {
      model: guardModel,
      key: store.wireKeyOf(guardModel, guard)!,
      value: wire({ ...guard, troops: { ...guard.troops, count: defenderAfter! * PRECISION } }),
    },
    ...(combat.last_target === target
      ? []
      : [
          {
            model: "ArmyCombat",
            key: store.wireKeyOf("ArmyCombat", key)!,
            value: wire({ ...combat, last_target: target }),
          },
        ]),
  ];
}
