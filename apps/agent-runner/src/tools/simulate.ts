import { readDeepSite, readDeepSiteDefender, type DeepSiteView } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerCombatTroops } from "@bibliothecadao/eternum/troop-stamina";
import {
  resolveExchange,
  getBlockTimestamp,
  armyOaths,
  configManager,
  divideByPrecision,
  getBuildingCosts,
  getDefendingGuards,
  isCombatGuard,
  storedBiomeAt,
  entityMapPosition,
  structureMapPosition,
  StaminaManager,
  type ExchangeTroops,
  type GameClient,
} from "@bibliothecadao/eternum";
import {
  BiomeType,
  BuildingType,
  BuildingTypeToString,
  findResourceById,
  type ID,
  getLayeredAttackDistance,
} from "@bibliothecadao/types";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "typebox";

import type { RunnerGame } from "../game";
import { textResult } from "./result";
import { StringEnum } from "./schema";

const EntityId = (description: string) => Type.Integer({ minimum: 1, description });

const SIMULATION_KINDS = ["combat", "building_cost"] as const;
type SimulationKind = (typeof SIMULATION_KINDS)[number];

/** One flat object: tool schemas must be objects at the root, so the per-kind requirements are checked in execute. */
const SimulateParams = Type.Object({
  kind: StringEnum(SIMULATION_KINDS, "combat: attackerId vs defenderId. building_cost: structureId + buildingType."),
  attackerId: Type.Optional(EntityId("My attacking explorer army.")),
  defenderId: Type.Optional(EntityId("The defending field army, structure or Deep site (combat).")),
  structureId: Type.Optional(EntityId("The realm that would build.")),
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
  troops: ExchangeTroops;
  hex: { x: number; y: number; alt: boolean };
  oaths: number;
  guarding: boolean;
}

export const createSimulateTool = (game: RunnerGame): AgentTool<typeof SimulateParams> => ({
  name: "simulate",
  label: "Simulate",
  description:
    "Preview an outcome with the game's own math before acting: a battle between two armies, or what a building would cost.",
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
    case "building_cost":
      return simulateBuildingCost(client, input.structureId!, input.buildingType!, input.useSimpleCost ?? false);
  }
};

const REQUIRED_INPUTS: Record<SimulationKind, (keyof SimulateInput)[]> = {
  combat: ["attackerId", "defenderId"],
  building_cost: ["structureId", "buildingType"],
};

const missingInputs = (input: SimulateInput): string[] =>
  REQUIRED_INPUTS[input.kind].filter((field) => input[field] === undefined);

// Combat

const simulateCombat = (client: GameClient, attackerId: ID, defenderId: ID): string => {
  const timestamp = getBlockTimestamp().currentDefaultTick;
  const store = client.setup.store;
  const key = (id: ID) => ({ game_id: client.gameId, explorer_id: id });
  if (store.get("DeepGuard", key(attackerId))) return "Attack refused: army is guarding a Deep site.";
  const guard = store.get("DeepGuard", key(defenderId));
  if (guard) return `Attack refused: target Deep site ${guard.site_id} to fight its guard.`;
  const attacker = explorerCombatant(client, attackerId, timestamp);
  if (!attacker) return describeMissingExplorer(store, key(attackerId));
  const defender = explorerCombatant(client, defenderId, timestamp) ?? siteDefender(client, defenderId, timestamp);
  if (!defender) return describeUndefendedTarget(client, defenderId, timestamp);
  const biome = biomeAt(client, defender.hex);
  const tile = (hex: Combatant["hex"]) => ({ col: hex.x, row: hex.y, alt: hex.alt });
  const result = resolveExchange(
    attacker.troops,
    defender.troops,
    {
      timestamp,
      attackDistance: Math.floor(getLayeredAttackDistance(tile(attacker.hex), tile(defender.hex))),
      attackerBiome: biome,
      defenderBiome: biome,
      attackerOaths: attacker.oaths,
      defenderOaths: defender.oaths,
      attackerIsStructureGuard: false,
      defenderIsStructureGuard: defender.guarding,
    },
    configManager.getCombatRules(),
  );
  if (!result.ok) return `Attack refused: ${result.refusal}.`;
  return [
    `Combat on ${biome}: ${describeArmy(attacker.troops, timestamp)} vs ${describeArmy(defender.troops, timestamp)}${defender.guarding ? " (structure guard)" : ""}`,
    `Attacker deals ${divideByPrecision(Number(result.defenderLoss))} damage, defender deals ${divideByPrecision(Number(result.attackerLoss))}.`,
    `Survivors: attacker ${divideByPrecision(Number(result.attacker.count))}, defender ${divideByPrecision(Number(result.defender.count))}.`,
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

const explorerCombatant = (client: GameClient, explorerId: ID, timestamp: number): Combatant | undefined => {
  const store = client.setup.store;
  const army = store.get("ExplorerTroops", { game_id: client.gameId, explorer_id: explorerId });
  if (!army) return undefined;
  const troops = resolveExplorerCombatTroops(store, army, timestamp);
  return (
    troops && {
      troops,
      oaths: armyOaths(store, army),
      hex: entityMapPosition(store, client.gameId, explorerId),
      guarding: false,
    }
  );
};

const siteDefender = (client: GameClient, id: ID, timestamp: number): Combatant | undefined => {
  const store = client.setup.store;
  const key = { game_id: client.gameId, entity_id: id };
  if (store.get("DeepSite", key)) {
    const site = findDeepSite(client, id, timestamp);
    const defender = site && readDeepSiteDefender(store, site, timestamp);
    return site && defender && { ...defender, hex: site.position };
  }
  const structure = store.get("Structure", key);
  if (!structure) return undefined;
  const guard = getDefendingGuards(structure, store, timestamp)?.[0];
  const hex = structureMapPosition(store, structure);
  if (!guard || !hex) return undefined;
  return {
    troops: guard.troops,
    hex,
    oaths: 0,
    guarding: isCombatGuard(structure.owner, configManager.getCombatRules().dayUnitSeconds),
  };
};

const findDeepSite = (client: GameClient, id: ID, timestamp: number): DeepSiteView | undefined =>
  readDeepSite(client.setup.store, timestamp, BigInt(id), client.gameId);

const describeUndefendedTarget = (client: GameClient, id: ID, timestamp: number): string => {
  const store = client.setup.store;
  const explorerKey = { game_id: client.gameId, explorer_id: id };
  if (store.get("ExplorerTroops", explorerKey)) return describeMissingExplorer(store, explorerKey);
  const site = findDeepSite(client, id, timestamp);
  if (!site) return `${id} is neither an explorer nor a structure with guards.`;
  if (site.guards.length > 0 || site.beastTroops > 0n) return `Deep site ${id}'s guard is not loaded yet.`;
  return `Deep site ${id} has no guard to fight.`;
};

const describeMissingExplorer = (
  store: GameClient["setup"]["store"],
  key: { game_id: number; explorer_id: ID },
): string =>
  store.get("ExplorerTroops", key)
    ? `Explorer ${key.explorer_id}'s combat facts are not loaded yet.`
    : `Explorer ${key.explorer_id} is not in the native store.`;

const biomeAt = (client: GameClient, hex: Combatant["hex"]): BiomeType =>
  hex.alt
    ? BiomeType.Underground
    : (storedBiomeAt(client.setup.store, hex.alt, hex.x, hex.y, client.gameId) ?? BiomeType.None);

const describeArmy = (army: ExchangeTroops, timestamp: number): string =>
  `${divideByPrecision(Number(army.count))} ${army.category} ${army.tier} (stamina ${StaminaManager.getStamina(army, timestamp).amount})`;

const resourceName = (resource: number): string => findResourceById(resource)?.trait ?? `resource ${resource}`;
