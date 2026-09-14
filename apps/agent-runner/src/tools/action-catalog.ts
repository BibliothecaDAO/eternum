import type { GameActions } from "@bibliothecadao/eternum";
import { BuildingType, TroopTier, TroopType } from "@bibliothecadao/types";
import { Type, type TObject } from "typebox";

export type ActionName = keyof GameActions;

/** What the model reads about one action: the curated overlay over the typed `GameActions` surface. */
export interface ActionCatalogEntry {
  description: string;
  /** The `params` object `act` validates before dispatching. */
  params: TObject;
  preconditions: string;
  /** Whether the action signs and submits a transaction (false for the two path planners). */
  submits: boolean;
}

const EntityId = (description: string) => Type.Integer({ minimum: 1, description });
const TroopCount = Type.Integer({ minimum: 1, description: "Number of troops (whole units, not precision-scaled)." });
const HexDirection = Type.Integer({
  minimum: 0,
  maximum: 5,
  description: "Hex direction: 0 east, 1 north-east, 2 north-west, 3 west, 4 south-west, 5 south-east.",
});
const WorldHex = Type.Object(
  { col: Type.Integer(), row: Type.Integer() },
  { description: "A world hex in contract coordinates, as observe_game reports positions." },
);
const BuildingSlot = Type.Object(
  { col: Type.Integer(), row: Type.Integer() },
  { description: "A slot on the structure's local building grid." },
);
const TroopTypeSchema = Type.Enum(TroopType, { description: "Knight, Paladin, or Crossbowman." });
const TroopTierSchema = Type.Enum(TroopTier, { description: "T1, T2, or T3." });
const BuildingTypeSchema = Type.Enum(BuildingType, {
  description: `Building category id; names: ${describeBuildingTypes()}.`,
});

/**
 * One entry per `GameActions` key. The type keeps the overlay exact: a key the client gains or loses fails to
 * compile here, and the catalog test asserts the same at runtime against the live client.
 */
export const ACTION_CATALOG: Record<ActionName, ActionCatalogEntry> = {
  armyPaths: {
    description:
      "Plan from an explorer's current hex: every move, explore, attack, help, chest, and spire option it can reach now, with stamina costs.",
    params: Type.Object({ explorerId: EntityId("The explorer army to plan for.") }),
    preconditions: "The explorer exists and has stamina; results depend on the current armies tick.",
    submits: false,
  },
  structurePaths: {
    description: "The support and attack options a structure's guards have over the armies around it.",
    params: Type.Object({ structureId: EntityId("The structure whose guards act.") }),
    preconditions: "The structure has at least one guard slot with troops; range follows the guards' troop type.",
    submits: false,
  },
  moveArmy: {
    description:
      "Move or explore with an explorer to a target hex. The path is resolved from armyPaths; the target must be one of its reachable hexes.",
    params: Type.Object({ explorerId: EntityId("The explorer army to move."), target: WorldHex }),
    preconditions:
      "Target is among armyPaths results for this explorer. Explore reveals the destination and costs more stamina than a move over explored tiles.",
    submits: true,
  },
  createExplorerArmy: {
    description: "Field a new explorer army from a structure's troop balance onto an adjacent hex.",
    params: Type.Object({
      structureId: EntityId("The realm or village that fields the army."),
      troopType: TroopTypeSchema,
      troopTier: TroopTierSchema,
      troopCount: TroopCount,
      spawnDirection: HexDirection,
    }),
    preconditions:
      "The structure holds at least troopCount troops of that type and tier, has a free explorer slot, and the hex in spawnDirection is free.",
    submits: true,
  },
  addTroopsToExplorer: {
    description: "Reinforce an explorer that stands next to its home structure with more of the same troops.",
    params: Type.Object({
      structureId: EntityId("The explorer's home structure."),
      explorerId: EntityId("The explorer to reinforce."),
      troopCount: TroopCount,
      homeDirection: HexDirection,
    }),
    preconditions:
      "The explorer is adjacent to the structure in homeDirection; the structure holds enough troops of the explorer's type and tier.",
    submits: true,
  },
  addTroopsToGuard: {
    description: "Station troops in one of a structure's guard slots.",
    params: Type.Object({
      structureId: EntityId("The structure to defend."),
      troopType: TroopTypeSchema,
      troopTier: TroopTierSchema,
      troopCount: TroopCount,
      slot: Type.Integer({ minimum: 0, maximum: 3, description: "Guard slot: 0 delta, 1 charlie, 2 bravo, 3 alpha." }),
    }),
    preconditions: "The slot is unlocked for the structure's level and empty or holding the same troop type and tier.",
    submits: true,
  },
  deleteExplorerArmy: {
    description: "Disband an explorer army; its troops are lost.",
    params: Type.Object({
      structureId: EntityId("The explorer's home structure."),
      explorerId: EntityId("The explorer to disband."),
    }),
    preconditions: "The explorer belongs to the structure.",
    submits: true,
  },
  placeBuilding: {
    description: "Construct a building on one of a structure's local slots.",
    params: Type.Object({
      structureId: EntityId("The realm or village to build in."),
      buildingType: BuildingTypeSchema,
      hex: BuildingSlot,
      useSimpleCost: Type.Boolean({ description: "Pay the simple (labor-based) cost instead of the complex one." }),
    }),
    preconditions:
      "The slot is free and unlocked for the realm level; the structure can pay the cost (see simulate building_cost) and has population capacity.",
    submits: true,
  },
  destroyBuilding: {
    description: "Demolish a building on a structure's local slot.",
    params: Type.Object({ structureId: EntityId("The structure the building stands on."), hex: BuildingSlot }),
    preconditions: "A building of yours stands on that slot.",
    submits: true,
  },
  pauseProduction: {
    description: "Pause a producing building so it stops consuming inputs.",
    params: Type.Object({ structureId: EntityId("The structure the building stands on."), hex: BuildingSlot }),
    preconditions: "The building on that slot is producing and not already paused.",
    submits: true,
  },
  resumeProduction: {
    description: "Resume a paused building.",
    params: Type.Object({ structureId: EntityId("The structure the building stands on."), hex: BuildingSlot }),
    preconditions: "The building on that slot is paused.",
    submits: true,
  },
};

export const ACTION_NAMES = Object.keys(ACTION_CATALOG) as ActionName[];

function describeBuildingTypes(): string {
  return Object.entries(BuildingType)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] !== BuildingType.None)
    .map(([name, id]) => `${id}=${name}`)
    .join(", ");
}
