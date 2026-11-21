import { readFileSync } from "node:fs";
import {
  BiomeType,
  BiomeTypeToId,
  ContractAddress,
  deepSites,
  RESOURCE_PRECISION,
  StructureType,
  TileOccupier,
} from "@bibliothecadao/types";
import { nativeTilePackingConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import { frontierSeasonOnePreset } from "../../../../config/source/frontier/season-one";
import { deepCenter } from "@bibliothecadao/eternum/game-client";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { expect, it } from "vitest";
import {
  createFakeGame,
  PLAYER,
  seedExplorer,
  seedGameRegistry,
  seedStructure,
  writeFact,
} from "../test-support/fake-game";
import { createSimulateTool } from "./simulate";

it("refuses a combat preview before the season starts, as the contract does", async () => {
  const game = createFakeGame();
  const start = Math.floor(Date.now() / 1000) + 86400;
  seedGameRegistry(game.store, { status: "Registration", startMainAt: start, endAt: start + 86400 });
  const registry = game.store.require("GameRegistry", { game_id: 28 });
  writeFact(game.store, "GameRegistry", [28], { ...registry, dev_mode_on: false });
  seedStructure(game.store, { entityId: 12, owner: PLAYER, x: 100, y: 100 });
  seedExplorer(game.store, { explorerId: 101, owner: 12, x: 101, y: 100 });
  const result = await createSimulateTool(game).execute("combat", { kind: "combat", attackerId: 101, defenderId: 12 });
  expect(result.content).toEqual([{ type: "text", text: "Attack refused: game-not-started." }]);
});

it("answers a target that is no army, Deep site or structure in words", async () => {
  const game = createFakeGame();
  const now = Math.floor(Date.now() / 1000);
  seedGameRegistry(game.store, { status: "Active", startMainAt: now - 1, endAt: now + 86400 });
  seedStructure(game.store, { entityId: 13, owner: PLAYER, x: 90, y: 90 });
  seedExplorer(game.store, { explorerId: 101, owner: 13, x: 101, y: 100, stamina: 100n });
  const result = await createSimulateTool(game).execute("combat", { kind: "combat", attackerId: 101, defenderId: 999 });
  expect(result.content).toEqual([{ type: "text", text: "999 is neither an explorer, a Deep site nor a structure." }]);
});

it("fights a structure's highest occupied guard slot first, as the contract does", async () => {
  const game = createFakeGame();
  const now = Math.floor(Date.now() / 1000);
  seedGameRegistry(game.store, { status: "Active", startMainAt: now - 1, endAt: now + 86400 });
  const rules = game.store.require("SliceRules", { game_id: 28 });
  writeFact(game.store, "SliceRules", [28], {
    ...rules,
    battle_config: { ...rules.battle_config, regular_immunity_ticks: 0 },
    troop_stamina_config: { ...rules.troop_stamina_config, stamina_attack_req: 10, stamina_defense_req: 0 },
  });
  seedStructure(game.store, { entityId: 12, owner: ContractAddress(0n), x: 100, y: 100, category: StructureType.Camp });
  writeFact(game.store, "TileOpt", [28, 0, 100, 100], {
    game_id: 28,
    alt: false,
    col: 100,
    row: 100,
    data: BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE),
  });
  seedStructure(game.store, { entityId: 13, owner: PLAYER, x: 90, y: 90 });
  seedExplorer(game.store, { explorerId: 101, owner: 13, x: 101, y: 100, stamina: 100n });
  const knights = game.store.require("ExplorerTroops", { game_id: 28, explorer_id: 101 }).troops;
  const guards = [
    { category: "Knight", count: 1000n },
    { category: "Crossbowman", count: 100n },
    { category: "Knight", count: 0n },
    { category: "Knight", count: 0n },
  ];
  for (const [slot, guard] of guards.entries()) {
    writeFact(game.store, "Guard", [28, 12, slot], {
      game_id: 28,
      structure_id: 12,
      slot,
      troops: { ...knights, category: guard.category, count: guard.count * BigInt(RESOURCE_PRECISION) },
      destroyed_tick: 0,
    });
  }
  const result = await createSimulateTool(game).execute("combat", { kind: "combat", attackerId: 101, defenderId: 12 });
  expect(result.content).toEqual([
    { type: "text", text: expect.stringMatching(/ vs 100 Crossbowman T1 \(stamina \d+\) \(structure guard\)\n/) },
  ]);
});

const oathDamage = readFileSync(
  new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-damage.txt", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\s+/)
  .map(Number);

it.each([4, 5, 6, 7, 8, 9])("reports the field or garrison survivors from Knight exchange %i", async (index) => {
  const [, , attackerOaths, defenderOaths, attackerGuard, defenderGuard, attackers, defenders, afterA, afterB] =
    oathDamage.slice(index * 10, (index + 1) * 10);
  const game = createFakeGame();
  const gameId = game.client.gameId;
  const now = Math.floor(Date.now() / 1000);
  setBlockTimestampSource(() => now);
  seedGameRegistry(game.store, { status: "Active", startMainAt: now - 1, endAt: now + 86400 });
  const rules = game.store.require("SliceRules", { game_id: gameId });
  writeFact(game.store, "SliceRules", [gameId], {
    ...rules,
    day_unit_seconds: 100,
    battle_config: { ...rules.battle_config, regular_immunity_ticks: 0 },
    troop_damage_config: { ...rules.troop_damage_config, damage_biome_bonus_num: 0 },
    troop_stamina_config: { ...rules.troop_stamina_config, stamina_attack_req: 10, stamina_defense_req: 0 },
  });
  const settlement = game.store.require("SettlementRules", { game_id: gameId });
  writeFact(game.store, "SettlementRules", [gameId], { ...settlement, spacing: frontierSeasonOnePreset.spacing });
  const deepCentre = deepCenter(frontierSeasonOnePreset.spacing);
  const deep = frontierSeasonOnePreset.deep;
  const scaled = (troops: number) => BigInt(troops) * BigInt(RESOURCE_PRECISION);
  writeFact(game.store, "DeepRules", [gameId], {
    game_id: gameId,
    gate_distance: deep.gateDistance,
    rings: deep.rings.slice(0, 1).map(({ radius, realms }) => ({ radius, realms })),
    beasts: deepSites.map(({ key }) => ({ count: scaled(deep.beasts[key].count), bow: deep.beasts[key].bow })),
    loss_per_tick: scaled(deep.lossPerTick),
    core_per_tick: scaled(deep.corePerTick),
    mine_per_tick: scaled(deep.minePerTick),
    building_pay: deep.buildingPay,
    altar_threshold: deep.altarThreshold,
  });
  seedStructure(game.store, { entityId: 12, owner: PLAYER, x: 90, y: 90 });
  seedStructure(game.store, { entityId: 14, owner: ContractAddress(0x999n), x: 80, y: 80 });
  writeFact(game.store, "HomeAspect", [gameId, 12], { game_id: gameId, home: 12, aspect: 1 });
  writeFact(game.store, "HomeAspect", [gameId, 14], { game_id: gameId, home: 14, aspect: 2 });
  function seedCombatant(id: number, count: number, oaths: number, owner: number) {
    seedExplorer(game.store, {
      explorerId: id,
      owner,
      x: deepCentre.col + id - 100,
      y: deepCentre.row,
      stamina: 100n,
      count: BigInt(count) * BigInt(RESOURCE_PRECISION),
      oaths,
    });
    const tick = BigInt(now) / BigInt(rules.tick_config.armies_tick_in_seconds);
    writeFact(game.store, "DeepArmy", [gameId, id], { game_id: gameId, explorer_id: id, last_tick: tick });
  }
  seedCombatant(101, attackers!, attackerOaths!, 12);
  seedCombatant(102, defenders!, defenderOaths!, 14);
  const simulate = (defenderId: number) =>
    createSimulateTool(game).execute("combat", { kind: "combat", attackerId: 101, defenderId });
  if (attackerGuard) {
    writeFact(game.store, "DeepGuard", [gameId, 101], { game_id: gameId, explorer_id: 101, site_id: 1100, slot: 0 });
    expect((await simulate(102)).content).toEqual([{ type: "text", text: "Attack refused: guarding-deep-site." }]);
    return;
  }
  let defendingId = 102;
  if (defenderGuard) {
    const army = game.store.require("ExplorerTroops", { game_id: gameId, explorer_id: 102 });
    for (const site of deepSites) {
      const id = 1100 + site.id;
      const tile = site.key === "mine" ? deepCentre : { col: deepCentre.col + 10 + site.id, row: deepCentre.row + 10 };
      writeFact(game.store, "DeepSite", [gameId, id], {
        game_id: gameId,
        entity_id: id,
        kind: site.id,
        ring: 0,
        day: 0,
      });
      writeFact(game.store, "TileOccupancy", [gameId, 0, tile.col, tile.row], {
        game_id: gameId,
        entity_id: id,
        alt: false,
        col: tile.col,
        row: tile.row,
        category: TileOccupier.DeepSite,
        is_structure: false,
      });
      writeFact(game.store, "Guard", [gameId, id, 0], {
        game_id: gameId,
        structure_id: id,
        slot: 0,
        troops: { ...army.troops, count: 0n },
        destroyed_tick: 0,
      });
      if (site.key === "mine") defendingId = id;
    }
    writeFact(game.store, "DeepGuard", [gameId, 102], {
      game_id: gameId,
      explorer_id: 102,
      site_id: defendingId,
      slot: 0,
    });
  }
  if (index === 4) {
    const blade = { game_id: gameId, explorer_id: 101, kind: "Blade", rank: 1, expires_at: now + 60 };
    writeFact(game.store, "ArmyRelicEffect", [gameId, 101, 0], blade);
    expect((await simulate(defendingId)).content).toEqual([
      { type: "text", text: expect.stringContaining(`Survivors: attacker ${afterA}, defender 423.`) },
    ]);
    writeFact(game.store, "ArmyRelicEffect", [gameId, 101, 0], { ...blade, expires_at: now });
  }
  const result = await simulate(defendingId);
  expect(result.content).toEqual([
    { type: "text", text: expect.stringContaining(`Survivors: attacker ${afterA}, defender ${afterB}.`) },
  ]);
  if (defenderGuard) {
    seedCombatant(102, 0, defenderOaths!, 14);
    expect((await simulate(defendingId)).content).toEqual([
      { type: "text", text: `${defendingId} has no guard to fight: the attack claims it.` },
    ]);
  }
});
