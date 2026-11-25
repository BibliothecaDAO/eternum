import {
  forecastAttack,
  getBlockTimestamp,
  divideByPrecision,
  getBuildingCosts,
  StaminaManager,
  type AttackForecast,
  type ExchangeTroops,
  type GameClient,
} from "@bibliothecadao/eternum";
import { BuildingType, BuildingTypeToString, findResourceById, type ID } from "@bibliothecadao/types";
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
  const key = (id: ID) => ({ game_id: client.gameId, entity_id: id });
  const forecast = forecastAttack(client.setup.store, key(attackerId), key(defenderId), timestamp);
  if (!forecast) return describeUnknownForecast(client, attackerId, defenderId);
  return describeForecast(forecast, defenderId, timestamp);
};

const describeForecast = (forecast: AttackForecast, defenderId: ID, timestamp: number): string => {
  switch (forecast.outcome) {
    case "refused":
      return `Attack refused: ${forecast.refusal}.`;
    case "claims":
      return `${defenderId} has no guard to fight: the attack claims it.`;
    case "fights": {
      const { attacker, defender } = forecast.sides;
      const { exchange } = forecast;
      return [
        `Combat on ${forecast.biome}: ${describeArmy(attacker.troops, timestamp)} vs ${describeArmy(defender.troops, timestamp)}${defender.guarding ? " (structure guard)" : ""}`,
        `Attacker deals ${divideByPrecision(Number(exchange.defenderLoss))} damage, defender deals ${divideByPrecision(Number(exchange.attackerLoss))}.`,
        `Survivors: attacker ${divideByPrecision(Number(exchange.attacker.count))}, defender ${divideByPrecision(Number(exchange.defender.count))}.`,
      ].join("\n");
    }
  }
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
    if (balance === undefined) return `${resourceName(cost.resource, false)}: need ${need}, have unknown (short)`;
    const have = Math.floor(divideByPrecision(Number(balance)));
    return `${resourceName(cost.resource, false)}: need ${need}, have ${have}${have >= need ? "" : " (short)"}`;
  });
  const affordable = lines.every((line) => !line.endsWith("(short)"));
  return [
    `${BuildingTypeToString[buildingType]} at #${structureId} (${useSimpleCost ? "simple" : "complex"} cost): ${affordable ? "affordable" : "not affordable"}`,
    ...lines,
  ].join("\n");
};

// Native facts

const describeUnknownForecast = (client: GameClient, attackerId: ID, defenderId: ID): string => {
  const store = client.setup.store;
  const gameId = client.gameId;
  const attacker = store.get("ExplorerTroops", { game_id: gameId, explorer_id: attackerId });
  if (!attacker && !store.get("Structure", { game_id: gameId, entity_id: attackerId }))
    return `Attacker ${attackerId} is neither an explorer nor a structure in the native store.`;
  const target =
    store.get("ExplorerTroops", { game_id: gameId, explorer_id: defenderId }) ??
    store.get("DeepSite", { game_id: gameId, entity_id: defenderId }) ??
    store.get("Structure", { game_id: gameId, entity_id: defenderId });
  if (!target) return `${defenderId} is neither an explorer, a Deep site nor a structure.`;
  return `The combat facts of ${attackerId} against ${defenderId} are not loaded yet.`;
};

const describeArmy = (army: ExchangeTroops, timestamp: number): string =>
  `${divideByPrecision(Number(army.count))} ${army.category} ${army.tier} (stamina ${StaminaManager.getStamina(army, timestamp).amount})`;

const resourceName = (resource: number): string => findResourceById(resource)?.trait ?? `resource ${resource}`;
