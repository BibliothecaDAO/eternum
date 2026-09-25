import {
  CombatSimulator,
  configManager,
  divideByPrecision,
  getBuildingCosts,
  getGuardsByStructure,
  RaidSimulator,
  storedBiomeAt,
  entityMapPosition,
  structureMapPosition,
  type Army,
  type GameClient,
} from "@bibliothecadao/eternum";
import {
  BiomeType,
  BuildingType,
  BuildingTypeToString,
  findResourceById,
  type ID,
  type TroopTier,
  type TroopType,
} from "@bibliothecadao/types";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "typebox";

import type { RunnerGame } from "../game";
import { textResult } from "./result";
import { StringEnum } from "./schema";

const EntityId = (description: string) => Type.Integer({ minimum: 1, description });

const SIMULATION_KINDS = ["combat", "raid", "building_cost"] as const;
type SimulationKind = (typeof SIMULATION_KINDS)[number];

/** One flat object: tool schemas must be objects at the root, so the per-kind requirements are checked in execute. */
const SimulateParams = Type.Object({
  kind: StringEnum(
    SIMULATION_KINDS,
    "combat: attackerId vs defenderId. raid: attackerId on structureId. building_cost: structureId + buildingType.",
  ),
  attackerId: Type.Optional(EntityId("My attacking or raiding explorer army.")),
  defenderId: Type.Optional(EntityId("The defending explorer army or structure (combat).")),
  structureId: Type.Optional(EntityId("The structure to raid, or the realm that would build.")),
  buildingType: Type.Optional(
    Type.Enum(BuildingType, { description: "Building category id, as list_actions documents." }),
  ),
  useSimpleCost: Type.Optional(
    Type.Boolean({ description: "Price the simple (labor) recipe instead of the complex one." }),
  ),
});

type SimulateInput = Static<typeof SimulateParams>;

/** A combatant as the simulator sees it, plus where it stands so the biome can be read. */
interface Combatant {
  army: Army;
  hex: { x: number; y: number };
  isStructureGuard: boolean;
}

export const createSimulateTool = (game: RunnerGame): AgentTool<typeof SimulateParams> => ({
  name: "simulate",
  label: "Simulate",
  description:
    "Preview an outcome with the game's own math before acting: a battle between two armies, a raid on a structure, or what a building would cost.",
  parameters: SimulateParams,
  execute: async (_id, input) => {
    const text = simulate(game.client, input);
    return textResult(text, { kind: input.kind });
  },
});

const simulate = (client: GameClient, input: SimulateInput): string => {
  const missing = missingInputs(input);
  if (missing.length > 0) return `${input.kind} needs ${missing.join(", ")}.`;
  switch (input.kind) {
    case "combat":
      return simulateCombat(client, input.attackerId!, input.defenderId!);
    case "raid":
      return simulateRaid(client, input.attackerId!, input.structureId!);
    case "building_cost":
      return simulateBuildingCost(client, input.structureId!, input.buildingType!, input.useSimpleCost ?? false);
  }
};

const REQUIRED_INPUTS: Record<SimulationKind, (keyof SimulateInput)[]> = {
  combat: ["attackerId", "defenderId"],
  raid: ["attackerId", "structureId"],
  building_cost: ["structureId", "buildingType"],
};

const missingInputs = (input: SimulateInput): string[] =>
  REQUIRED_INPUTS[input.kind].filter((field) => input[field] === undefined);

// Combat

const simulateCombat = (client: GameClient, attackerId: ID, defenderId: ID): string => {
  const attacker = explorerCombatant(client, attackerId);
  if (!attacker) return `Explorer ${attackerId} is not in the native store.`;
  const defenders = explorerCombatant(client, defenderId) ?? strongestGuard(client, defenderId);
  if (!defenders) return `${defenderId} is neither an explorer nor a structure with guards.`;
  const biome = biomeAt(client, defenders.hex);
  const result = new CombatSimulator(configManager.getCombatConfig()).simulateBattleWithParams(
    Math.floor(Date.now() / 1000),
    attacker.army,
    defenders.army,
    biome,
    [],
    [],
    { defenderIsStructureGuard: defenders.isStructureGuard },
  );
  return [
    `Combat on ${biome}: ${describeArmy(attacker.army)} vs ${describeArmy(defenders.army)}${defenders.isStructureGuard ? " (structure guard)" : ""}`,
    `Attacker deals ${Math.floor(result.attackerDamage)} damage, defender deals ${Math.floor(result.defenderDamage)}.`,
    `Survivors: attacker ${Math.max(0, attacker.army.troopCount - Math.floor(result.defenderDamage))}, defender ${Math.max(0, defenders.army.troopCount - Math.floor(result.attackerDamage))}.`,
  ].join("\n");
};

// Raid

const simulateRaid = (client: GameClient, attackerId: ID, structureId: ID): string => {
  const raider = explorerCombatant(client, attackerId);
  if (!raider) return `Explorer ${attackerId} is not in the native store.`;
  const structure = client.setup.store.get("Structure", { game_id: client.gameId, entity_id: structureId });
  if (!structure) return `Structure ${structureId} is not in the native store.`;
  const knownGuards = getGuardsByStructure(structure, client.setup.store);
  if (!knownGuards) return `Guards for structure ${structureId} are not synchronized.`;
  const guards = knownGuards
    .filter((guard) => Number(guard.troops.count) > 0)
    .map((guard) => troopsToArmy(guard.troops));
  const biome = biomeAt(client, structureMapPosition(client.setup.store, structure));
  const result = new RaidSimulator(configManager.getCombatConfig()).simulateRaid(raider.army, guards, biome);
  return [
    `Raid on structure #${structureId} (${biome}) by ${describeArmy(raider.army)} against ${guards.length} guard slot(s).`,
    `Outcome ${result.outcomeType} with ${Math.round(result.successChance)}% success chance.`,
    `Raider loses ${result.raiderDamageTaken} troops; guards lose ${result.defenderDamageTaken}.`,
  ].join("\n");
};

// Building cost

const simulateBuildingCost = (
  client: GameClient,
  structureId: ID,
  buildingType: BuildingType,
  useSimpleCost: boolean,
): string => {
  const costs = getBuildingCosts(structureId, client.setup.store, buildingType, useSimpleCost);
  if (!costs || costs.length === 0) {
    return `No ${useSimpleCost ? "simple" : "complex"} cost is configured for ${BuildingTypeToString[buildingType]}.`;
  }
  const balances = client.views.resources(structureId);
  const lines = costs.map((cost) => {
    const balance = balances.balance(cost.resource);
    const need = Math.ceil(cost.amount);
    // A balance this runner cannot see never covers a cost.
    if (balance === undefined) return `${resourceName(cost.resource)}: need ${need}, have unknown (short)`;
    const have = Math.floor(divideByPrecision(Number(balance)));
    return `${resourceName(cost.resource)}: need ${need}, have ${have}${have >= need ? "" : " (short)"}`;
  });
  const affordable = lines.every((line) => !line.endsWith("(short)"));
  return [
    `${BuildingTypeToString[buildingType]} at #${structureId} (${useSimpleCost ? "simple" : "complex"} cost): ${affordable ? "affordable" : "not affordable"}`,
    ...lines,
  ].join("\n");
};

// Native facts

const explorerCombatant = (client: GameClient, explorerId: ID): Combatant | undefined => {
  const row = client.setup.store.get("ExplorerTroops", { game_id: client.gameId, explorer_id: explorerId });
  if (!row) return undefined;
  return {
    army: troopsToArmy(row.troops),
    hex: entityMapPosition(client.setup.store, client.gameId, explorerId),
    isStructureGuard: false,
  };
};

/** The guard slot with the most troops stands for the structure in a one-on-one preview. */
const strongestGuard = (client: GameClient, structureId: ID): Combatant | undefined => {
  const structure = client.setup.store.get("Structure", { game_id: client.gameId, entity_id: structureId });
  if (!structure) return undefined;
  const guard = getGuardsByStructure(structure, client.setup.store)
    ?.filter((candidate) => Number(candidate.troops.count) > 0)
    .sort((left, right) => Number(right.troops.count - left.troops.count))[0];
  if (!guard) return undefined;
  return {
    army: troopsToArmy(guard.troops),
    hex: structureMapPosition(client.setup.store, structure),
    isStructureGuard: true,
  };
};

type TroopsRow = {
  category: string;
  tier: string;
  count: bigint;
  stamina: { amount: bigint };
  battle_cooldown_end: number;
};

const troopsToArmy = (troops: TroopsRow): Army => ({
  stamina: Number(troops.stamina.amount),
  troopCount: divideByPrecision(Number(troops.count)),
  troopType: troops.category as TroopType,
  tier: troops.tier as TroopTier,
  battle_cooldown_end: troops.battle_cooldown_end,
});

// A fight's terrain is the defender's tile as the chain stored it; an unrevealed tile has no terrain bonus.
const biomeAt = (client: GameClient, hex: { x: number; y: number }): BiomeType =>
  storedBiomeAt(client.setup.store, false, hex.x, hex.y, client.gameId) ?? BiomeType.None;

const describeArmy = (army: Army): string =>
  `${army.troopCount} ${army.troopType} ${army.tier} (stamina ${army.stamina})`;

const resourceName = (resource: number): string => findResourceById(resource)?.trait ?? `resource ${resource}`;
