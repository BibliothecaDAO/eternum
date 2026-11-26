import {
  getLayeredAttackDistance,
  getLayerNeighborHexes,
  getNeighborHexes,
  RESOURCE_PRECISION,
  StructureType,
  TileOccupier,
  type BiomeType,
  type Troops,
} from "@bibliothecadao/types";
import { type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeOathConstants as oathRules } from "../../../../contracts/l3/world-native/schema/balance.gen";
import type { NativeFactStore } from "../client/native-fact-store";
import { isDeepSiteRival, readDeepSite, readDeepSiteDefender, type DeepGarrison } from "../client/views/deep-sites";
import { inlineTroops, resolveExplorerCombatTroops, resolveExplorerTroops, staminaAt } from "../managers/troop-stamina";
import { STAMINA_MODELS } from "../client/views/stamina";
import { getDefendingGuards, getGuardsByStructure, GUARD_MODELS } from "./army";
import { commandRefusal } from "./army-opponents";
import {
  forecastFight,
  isCombatGuard,
  readCombatRules,
  resolveExchange,
  type CombatRules,
  type ExchangeRefusal,
} from "./combat-exchange";
import { isArmyCurrent, isExpeditionRealm, structureMapPosition } from "./expeditions";
import { isModeRuleEnabled } from "./mode-rules";
import { armyOaths, holdsOath, oathAttackStamina } from "./oaths";
import { isTileOccupierArmy } from "./map/hex";
import { entityMapOccupancy, getTileAt, storedBiomeAt } from "./tile";

export const ATTACK_FORECAST_MODELS = [
  ...STAMINA_MODELS,
  ...GUARD_MODELS,
  "ArmyRelicEffect",
  "GarrisonSlot",
  "DeepTick",
  "DeepSite",
  "DeepEntries",
  "DeepRules",
  "ExpeditionSite",
  "TileOpt",
] as const;

export type AttackRefusal =
  | "answer-oath-first"
  | "game-not-started"
  | "game-ended"
  | "expired-army"
  | "deep-ring-closed"
  | "target-must-be-unowned"
  | "own-target"
  | "no-attack"
  | "allied"
  | "season-immunity"
  | "village-immunity"
  | "out-of-range"
  | "unguarded-site"
  | ExchangeRefusal;

interface Tile {
  col: number;
  row: number;
  alt: boolean;
}

interface Combatant {
  troops: Troops;
  exact: boolean;
  oaths: number;
  guarding: boolean;
  tile: Tile;
  home: bigint;
  guardSlot?: number;
}

interface AttackSides {
  attacker: Combatant;
  defender?: Combatant;
  queued: Combatant[];
}

type FightSides = AttackSides & { defender: Combatant };

type Exchange = Extract<ReturnType<typeof resolveExchange>, { ok: true }>;
type Fight = Exclude<ReturnType<typeof forecastFight>, { outcome: "refused" }>;

export type AttackForecast =
  | { outcome: "refused"; refusal: AttackRefusal; sides?: AttackSides }
  | { outcome: "claims"; sides: AttackSides }
  | {
      outcome: "fights";
      sides: FightSides;
      biome: BiomeType;
      exchange: Exchange;
      fight: Fight;
      certainLoss: boolean;
    };

interface EntityKey {
  game_id: number;
  entity_id: number | bigint;
}

interface Scene {
  store: NativeFactStore;
  gameId: number;
  chainSecond: number;
  rules: CombatRules;
  besideTarget: boolean;
  guardSlot: number | undefined;
}

type Defence = { refusal: AttackRefusal; sides?: AttackSides } | { claims: Combatant } | { sides: FightSides };

const refused = (refusal: AttackRefusal, sides?: AttackSides): Defence => ({ refusal, sides });

export function forecastAttack(
  store: NativeFactStore,
  attacker: EntityKey,
  target: EntityKey,
  chainSecond: number,
  { besideTarget = false, guardSlot }: { besideTarget?: boolean; guardSlot?: number } = {},
): AttackForecast | undefined {
  const rules = readCombatRules(store, attacker.game_id);
  const scene = { store, gameId: attacker.game_id, chainSecond, rules, besideTarget, guardSlot };
  const targetId = BigInt(target.entity_id);
  const explorer = store.get("ExplorerTroops", { game_id: scene.gameId, explorer_id: BigInt(attacker.entity_id) });
  const defence = explorer
    ? armyAttack(scene, explorer, targetId)
    : guardAttack(scene, BigInt(attacker.entity_id), targetId);
  if (defence === undefined) return undefined;
  if ("refusal" in defence) return { outcome: "refused", refusal: defence.refusal, sides: defence.sides };
  if ("claims" in defence) return claimOf(scene, defence.claims);
  return fightOf(scene, defence.sides);
}

function claimOf(scene: Scene, attacker: Combatant): AttackForecast {
  const sides = { attacker, queued: [] };
  const stamina = staminaAt(attacker.troops, scene.chainSecond, scene.rules.stamina, scene.rules.tickSeconds);
  if (stamina.amount < BigInt(oathAttackStamina(attacker.oaths, scene.rules.stamina.stamina_attack_req)))
    return { outcome: "refused", refusal: "insufficient-stamina", sides };
  return { outcome: "claims", sides };
}

function fightOf(scene: Scene, sides: FightSides): AttackForecast | undefined {
  if (!sides.attacker.exact || !sides.defender.exact) return undefined;
  const { tile } = sides.defender;
  const biome = storedBiomeAt(scene.store, tile.alt, tile.col, tile.row, scene.gameId);
  if (biome === undefined) return undefined;
  const twin = twinsCompanion(scene.store, scene.gameId, scene.chainSecond, sides.attacker);
  const context = exchangeContext(scene.chainSecond, sides.attacker, sides.defender, biome, twin);
  const exchange = resolveExchange(sides.attacker.troops, sides.defender.troops, context, scene.rules);
  if (!exchange.ok) return { outcome: "refused", refusal: exchange.refusal, sides };
  const fight = forecastFight(sides.attacker.troops, sides.defender.troops, context, scene.rules);
  if (fight.outcome === "refused") return { outcome: "refused", refusal: fight.refusal, sides };
  const certainLoss = exchange.attacker.count < BigInt(RESOURCE_PRECISION);
  return { outcome: "fights", sides, biome, exchange, fight, certainLoss };
}

const exchangeContext = (
  chainSecond: number,
  attacker: Combatant,
  defender: Combatant,
  biome: BiomeType,
  attackerTwin: Troops | null,
) => ({
  timestamp: chainSecond,
  attackerBiome: biome,
  defenderBiome: biome,
  attackerIsStructureGuard: attacker.guarding,
  defenderIsStructureGuard: defender.guarding,
  attackerOaths: attacker.oaths,
  defenderOaths: defender.oaths,
  attackerTwin,
});

function twinsCompanion(
  store: NativeFactStore,
  gameId: number,
  chainSecond: number,
  attacker: Combatant,
): Troops | null {
  if (attacker.guarding || !holdsOath(attacker.oaths, oathRules.TWINS)) return null;
  const owner = store.require("Structure", { game_id: gameId, entity_id: attacker.home }).owner;
  let largest: Troops | null = null;
  for (const { col, row } of getLayerNeighborHexes(attacker.tile.col, attacker.tile.row, attacker.tile.alt)) {
    const occupant = store.get("TileOccupancy", { game_id: gameId, alt: attacker.tile.alt, col, row });
    if (!occupant || occupant.is_structure || !isTileOccupierArmy(occupant.category)) continue;
    const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: occupant.entity_id });
    if (!army || !isArmyCurrent(store, gameId, army.explorer_id, chainSecond)) continue;
    if (store.require("Structure", { game_id: gameId, entity_id: army.owner }).owner !== owner) continue;
    const troops = resolveExplorerCombatTroops(store, army, chainSecond);
    if (troops && troops.count > 0n && (!largest || largest.count < troops.count)) largest = troops;
  }
  return largest;
}

export function clearsEveryDefender(
  store: NativeFactStore,
  attacker: EntityKey,
  target: EntityKey,
  chainSecond: number,
  options?: { besideTarget?: boolean },
): boolean | undefined {
  const forecast = forecastAttack(store, attacker, target, chainSecond, options);
  if (forecast === undefined) return undefined;
  if (forecast.outcome !== "fights") return forecast.outcome === "claims";
  const rules = readCombatRules(store, attacker.game_id);
  let fight = forecast.fight;
  for (const defender of forecast.sides.queued) {
    if (fight.outcome !== "wins") return false;
    const standing = { ...forecast.sides.attacker, troops: fight.attacker };
    const next = forecastFight(
      standing.troops,
      defender.troops,
      exchangeContext(
        chainSecond,
        standing,
        defender,
        forecast.biome,
        twinsCompanion(store, attacker.game_id, chainSecond, standing),
      ),
      rules,
    );
    if (next.outcome === "refused") return false;
    fight = next;
  }
  return fight.outcome === "wins";
}

function armyAttack(scene: Scene, explorer: NativeRows["ExplorerTroops"], targetId: bigint): Defence | undefined {
  const early = commandingArmyRefusal(scene, explorer.explorer_id);
  const defence = armyTargetDefence(scene, explorer, targetId);
  if (!early) return defence;
  return refused(early, defence && ("claims" in defence ? { attacker: defence.claims, queued: [] } : defence.sides));
}

function commandingArmyRefusal(scene: Scene, explorerId: bigint): AttackRefusal | undefined {
  if (hasOpenOathPick(scene, explorerId)) return "answer-oath-first";
  return (
    playingRefusal(scene) ??
    (isArmyCurrent(scene.store, scene.gameId, explorerId, scene.chainSecond) ? undefined : "expired-army")
  );
}

const defendingArmyRefusal = (scene: Scene, explorerId: bigint): AttackRefusal | undefined =>
  isArmyCurrent(scene.store, scene.gameId, explorerId, scene.chainSecond) ? undefined : "expired-army";

function armyTargetDefence(
  scene: Scene,
  explorer: NativeRows["ExplorerTroops"],
  targetId: bigint,
): Defence | undefined {
  const standing = armyCombatant(scene, explorer);
  const targetTile = targetPosition(scene, targetId);
  if (!standing || !targetTile) return undefined;
  const attacker = scene.besideTarget ? { ...standing, tile: besideTile(targetTile) } : standing;
  const { store, gameId } = scene;
  if (store.get("DeepSite", { game_id: gameId, entity_id: targetId }))
    return deepSiteDefence(scene, attacker, targetId);
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: targetId });
  if (army) return armyDefence(scene, attacker, army);
  const structure = store.get("Structure", { game_id: gameId, entity_id: targetId });
  return structure && structureDefence(scene, attacker, structure);
}

function targetPosition(scene: Scene, targetId: bigint): Tile | undefined {
  const structure = scene.store.get("Structure", { game_id: scene.gameId, entity_id: targetId });
  if (structure) return structureTile(scene, structure);
  const occupancy = entityMapOccupancy(scene.store, scene.gameId, targetId);
  return occupancy && { col: occupancy.col, row: occupancy.row, alt: occupancy.alt };
}

function structureTile(scene: Scene, structure: NativeRows["Structure"]): Tile | undefined {
  if (isExpeditionRealm(scene.store, structure)) {
    const site = structureMapPosition(scene.store, structure);
    return site ? { col: site.x, row: site.y, alt: site.alt } : undefined;
  }
  const occupancy = entityMapOccupancy(scene.store, scene.gameId, structure.entity_id);
  return occupancy && { col: occupancy.col, row: occupancy.row, alt: occupancy.alt };
}

const besideTile = (target: Tile): Tile => {
  const [first] = getLayerNeighborHexes(target.col, target.row, target.alt);
  return { col: first!.col, row: first!.row, alt: target.alt };
};

function armyDefence(scene: Scene, attacker: Combatant, army: NativeRows["ExplorerTroops"]): Defence | undefined {
  const defender = armyCombatant(scene, army);
  if (!defender) return undefined;
  const sides = { attacker, defender, queued: [] };
  const refusal =
    defendingArmyRefusal(scene, army.explorer_id) ??
    commandRefusal(scene.store, scene.gameId, "Battle") ??
    ownTargetRefusal(scene, attacker.home, homeOwner(scene, defender.home)) ??
    immunityRefusal(scene, attacker.home) ??
    immunityRefusal(scene, defender.home) ??
    (attacker.troops.count === 0n || defender.troops.count === 0n ? "no-troops" : undefined) ??
    (isInBattleRange(scene, attacker, defender.tile) ? undefined : "out-of-range");
  return refusal ? refused(refusal, sides) : { sides };
}

function deepSiteDefence(scene: Scene, attacker: Combatant, siteId: bigint): Defence | undefined {
  const site = readDeepSite(scene.store, scene.chainSecond, siteId, scene.gameId);
  if (!site) return undefined;
  const tile = { col: site.position.x, row: site.position.y, alt: site.position.alt };
  const alone = { attacker, queued: [] };
  if (!site.open) return refused("deep-ring-closed", alone);
  if (!isAdjacent(attacker.tile, tile)) return refused("out-of-range", alone);
  const aggressor = aggressorRefusal(scene, attacker);
  if (aggressor) return refused(aggressor, alone);
  const allied = site.aspect !== 0 && !isDeepSiteRival(scene.store, site, attacker.home, scene.gameId);
  const defence = readDeepSiteDefender(scene.store, site);
  if (!defence) return allied ? refused("allied", alone) : { claims: attacker };
  const rules = scene.store.require("SliceRules", { game_id: scene.gameId });
  const queued = site.garrisons.slice(1).map((next) => garrisonCombatant(next, tile, rules));
  const defender = { ...defence, exact: true, tile, home: site.garrisons[0]?.home ?? 0n };
  const sides = { attacker, defender, queued };
  return allied ? refused("allied", sides) : { sides };
}

function structureDefence(scene: Scene, attacker: Combatant, structure: NativeRows["Structure"]): Defence | undefined {
  const { store, gameId } = scene;
  const unownedOnly = isModeRuleEnabled(store.require("SliceRules", { game_id: gameId }), "UNOWNED_TARGETS");
  const alone = { attacker, queued: [] };
  const before =
    (unownedOnly && structure.owner !== 0n ? "target-must-be-unowned" : undefined) ??
    ownTargetRefusal(scene, attacker.home, structure.owner) ??
    immunityRefusal(scene, structure.entity_id) ??
    aggressorRefusal(scene, attacker);
  if (before) return refused(before, alone);
  const tile = structureTile(scene, structure);
  if (!tile) return undefined;
  if (!isAdjacent(attacker.tile, tile)) return refused("out-of-range", alone);
  const guards = getDefendingGuards(structure, store, scene.chainSecond);
  if (!guards) return undefined;
  const [first, ...queued] = guards;
  if (!first)
    return store.get("ExpeditionSite", { game_id: gameId, entity_id: structure.entity_id })
      ? refused("unguarded-site", alone)
      : { claims: attacker };
  const guarding = isCombatGuard(structure.owner);
  const standing = (troops: Troops) => ({ troops, exact: true, oaths: 0, guarding, tile, home: structure.entity_id });
  return {
    sides: { attacker, defender: standing(first.troops), queued: queued.map((guard) => standing(guard.troops)) },
  };
}

function guardAttack(scene: Scene, structureId: bigint, targetId: bigint): Defence | undefined {
  const { store, gameId } = scene;
  const structure = store.get("Structure", { game_id: gameId, entity_id: structureId });
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: targetId });
  if (!structure || !army) return undefined;
  const early = playingRefusal(scene) ?? defendingArmyRefusal(scene, army.explorer_id);
  const defender = armyCombatant(scene, army);
  const tile = structureTile(scene, structure);
  const guards = getGuardsByStructure(structure, store, scene.chainSecond);
  if (!defender || !tile || !guards) return undefined;
  const living = guards.filter((guard) => guard.troops.count > 0n).toSorted((a, b) => a.slot - b.slot);
  const guard = scene.guardSlot === undefined ? living[0] : living.find(({ slot }) => slot === scene.guardSlot);
  if (!guard || defender.troops.count === 0n) return refused(early ?? "no-troops");
  const attacker = {
    troops: guard.troops,
    exact: true,
    oaths: 0,
    guarding: true,
    tile,
    home: structureId,
    guardSlot: guard.slot,
  };
  const sides = { attacker, defender, queued: [] };
  const refusal =
    early ??
    (isAdjacent(tile, defender.tile) ? undefined : "out-of-range") ??
    immunityRefusal(scene, structureId) ??
    immunityRefusal(scene, defender.home) ??
    commandRefusal(store, gameId, "GuardAttack");
  return refusal ? refused(refusal, sides) : { sides };
}

function armyCombatant(scene: Scene, army: NativeRows["ExplorerTroops"]): Combatant | undefined {
  const combat = resolveExplorerCombatTroops(scene.store, army, scene.chainSecond);
  const troops = combat ?? resolveExplorerTroops(scene.store, army, scene.chainSecond);
  const position = entityMapOccupancy(scene.store, scene.gameId, army.explorer_id);
  if (!troops || !position) return undefined;
  return {
    troops,
    exact: combat !== undefined,
    oaths: armyOaths(scene.store, army),
    guarding: false,
    tile: { col: position.col, row: position.row, alt: position.alt },
    home: army.owner,
  };
}

function garrisonCombatant(garrison: DeepGarrison, tile: Tile, rules: NativeRows["SliceRules"]): Combatant {
  return {
    troops: inlineTroops(garrison.troops, rules),
    exact: true,
    oaths: 0,
    guarding: true,
    tile,
    home: garrison.home,
  };
}

function hasOpenOathPick(scene: Scene, explorerId: bigint): boolean {
  return scene.store.require("ArmyProgress", { game_id: scene.gameId, explorer_id: explorerId }).oath_pick !== 0;
}

function playingRefusal(scene: Scene): AttackRefusal | undefined {
  const game = scene.store.require("GameRegistry", { game_id: scene.gameId });
  const now = BigInt(scene.chainSecond);
  if (!game.dev_mode_on && (now < game.start_main_at || now < game.start_settling_at)) return "game-not-started";
  return game.end_at !== 0n && now >= game.end_at ? "game-ended" : undefined;
}

const homeOwner = (scene: Scene, home: bigint): bigint =>
  scene.store.require("Structure", { game_id: scene.gameId, entity_id: home }).owner;

const ownTargetRefusal = (scene: Scene, attackerHome: bigint, defenderOwner: bigint): AttackRefusal | undefined =>
  homeOwner(scene, attackerHome) === defenderOwner ? "own-target" : undefined;

const aggressorRefusal = (scene: Scene, attacker: Combatant): AttackRefusal | undefined =>
  attacker.troops.count === 0n ? "no-troops" : immunityRefusal(scene, attacker.home);

function immunityRefusal(scene: Scene, home: bigint): AttackRefusal | undefined {
  const { store, gameId, rules } = scene;
  const battle = store.require("SliceRules", { game_id: gameId }).battle_config;
  const tick = Math.floor(scene.chainSecond / rules.tickSeconds);
  const start = Number(store.require("GameRegistry", { game_id: gameId }).start_main_at);
  if (tick < Math.floor(start / rules.tickSeconds) + battle.regular_immunity_ticks) return "season-immunity";
  const structure = store.require("Structure", { game_id: gameId, entity_id: home });
  if (structure.base.category !== StructureType.Village) return undefined;
  const founded = Math.floor(Number(structure.base.created_at) / rules.tickSeconds);
  return tick < founded + battle.village_immunity_ticks ? "village-immunity" : undefined;
}

const isAdjacent = (attacker: Tile, defender: Tile): boolean =>
  attacker.alt === defender.alt && getLayeredAttackDistance(attacker, defender) === 1;

function isInBattleRange(scene: Scene, attacker: Combatant, defender: Tile): boolean {
  if (attacker.tile.alt === defender.alt) return isAdjacent(attacker.tile, defender);
  const { col, row, alt } = attacker.tile;
  return (
    col === defender.col &&
    row === defender.row &&
    getNeighborHexes(col, row).some(
      (hex) => getTileAt(scene.store, alt, hex.col, hex.row, scene.gameId)?.occupier_type === TileOccupier.Spire,
    )
  );
}
