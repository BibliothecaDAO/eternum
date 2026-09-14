import { gameEntityKey, getBlockTimestamp, type GameClient } from "@bibliothecadao/eternum";
import type { ArmyInfo, ID, Structure } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";

import type { RunnerGame } from "./game";
import { readGamePhase, type GamePhase } from "./game-phase";
import { NEARBY_REACH } from "./tools/observe";
import type { WakeReason } from "./wake";

/** The world as the delta gate sees it: fingerprints of what is mine, and what stands within reach of it. */
interface WorldObservation {
  phase: GamePhase;
  tick: number;
  ownStructures: Map<ID, string>;
  ownArmies: Map<ID, string>;
  hostiles: Map<ID, string>;
  chests: Set<ID>;
}

export interface WorldDelta {
  phase: { from: GamePhase; to: GamePhase } | null;
  ticksAdvanced: number;
  /** Own structures whose level, guards, explorers, buildings, or resource row changed, appeared, or vanished. */
  ownStructures: ID[];
  /** Own explorers that moved, changed strength, appeared, or vanished. */
  ownArmies: ID[];
  hostilesAppeared: ID[];
  hostilesMoved: ID[];
  hostilesLeft: ID[];
  chestsAppeared: ID[];
}

interface HexBounds {
  alt: boolean;
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

export const observeWorld = (game: RunnerGame): WorldObservation => {
  const { client } = game;
  const { currentBlockTimestamp, currentDefaultTick } = getBlockTimestamp();
  const structures = client.views.structures(game.viewer());
  const armies = structures.flatMap((structure) => client.views.explorers(structure.entityId));
  const reach = [...structures.map(structureReach), ...armies.map(armyReach)];
  return {
    phase: readGamePhase(client, currentBlockTimestamp),
    tick: currentDefaultTick,
    ownStructures: new Map(
      structures.map((structure) => [structure.entityId, fingerprintStructure(client, structure)]),
    ),
    ownArmies: new Map(armies.map((army) => [army.entityId, fingerprintArmy(army)])),
    hostiles: hostileArmiesWithin(game, reach, new Set(armies.map((army) => army.entityId))),
    chests: chestsWithin(client, reach),
  };
};

export const summariseDelta = (previous: WorldObservation, current: WorldObservation): WorldDelta => ({
  phase: previous.phase === current.phase ? null : { from: previous.phase, to: current.phase },
  ticksAdvanced: current.tick - previous.tick,
  ownStructures: changedKeys(previous.ownStructures, current.ownStructures),
  ownArmies: changedKeys(previous.ownArmies, current.ownArmies),
  hostilesAppeared: addedKeys(previous.hostiles, current.hostiles),
  hostilesMoved: movedKeys(previous.hostiles, current.hostiles),
  hostilesLeft: addedKeys(current.hostiles, previous.hostiles),
  chestsAppeared: [...current.chests].filter((chest) => !previous.chests.has(chest)),
});

/**
 * The cost gate. Heartbeats, directions, phase changes, and startup always reach the model; a world delta does only
 * when something of mine changed, a hostile army is within reach, a chest appeared, or the phase flipped.
 */
export const isActionable = (delta: WorldDelta, reason: WakeReason): boolean =>
  reason !== "world-delta" || hasMaterialChange(delta);

const hasMaterialChange = (delta: WorldDelta): boolean =>
  delta.phase !== null ||
  delta.ownStructures.length > 0 ||
  delta.ownArmies.length > 0 ||
  delta.hostilesAppeared.length > 0 ||
  delta.hostilesMoved.length > 0 ||
  delta.chestsAppeared.length > 0;

// Fingerprints

const fingerprintStructure = (client: GameClient, structure: Structure): string => {
  const base = structure.structure.base;
  const resource = getComponentValue(client.setup.components.Resource, gameEntityKey([BigInt(structure.entityId)]));
  const buildings = client.views.buildingTiles(structure.entityId).existingBuildings().length;
  return [
    base.level,
    base.troop_guard_count,
    base.troop_explorer_count,
    buildings,
    JSON.stringify(resource, bigintAsString),
  ].join("|");
};

const fingerprintArmy = (army: ArmyInfo): string =>
  `${army.position.x},${army.position.y}|${army.troops.count}|${army.troops.category}|${army.troops.tier}`;

// Reach

const structureReach = (structure: Structure): HexBounds =>
  boundsAround(structure.structure.base.coord_x, structure.structure.base.coord_y, false);

const armyReach = (army: ArmyInfo): HexBounds =>
  boundsAround(army.position.x, army.position.y, army.explorer.coord.alt);

const boundsAround = (col: number, row: number, alt: boolean): HexBounds => ({
  alt,
  minCol: col - NEARBY_REACH,
  maxCol: col + NEARBY_REACH,
  minRow: row - NEARBY_REACH,
  maxRow: row + NEARBY_REACH,
});

const hostileArmiesWithin = (game: RunnerGame, reach: HexBounds[], ownArmies: Set<ID>): Map<ID, string> => {
  const hostiles = new Map<ID, string>();
  for (const bounds of reach) {
    for (const army of game.client.projection.getArmiesInBounds(bounds)) {
      if (ownArmies.has(army.entityId) || isOwnedByViewer(game, army.entityId)) continue;
      hostiles.set(army.entityId, `${army.hexCoords.col},${army.hexCoords.row}`);
    }
  }
  return hostiles;
};

/** An army with no resolvable owner counts as hostile: the gate prefers a spare model call to a missed attack. */
const isOwnedByViewer = (game: RunnerGame, armyId: ID): boolean => {
  const { components } = game.client.setup;
  const explorer = getComponentValue(components.ExplorerTroops, gameEntityKey([BigInt(armyId)]));
  if (!explorer) return false;
  const home = getComponentValue(components.Structure, gameEntityKey([BigInt(explorer.owner)]));
  return home !== undefined && home.owner === game.viewer();
};

const chestsWithin = (client: GameClient, reach: HexBounds[]): Set<ID> =>
  new Set(reach.flatMap((bounds) => client.projection.getChestsInBounds(bounds).map((chest) => chest.entityId)));

// Map diffs

const changedKeys = <K>(previous: Map<K, string>, current: Map<K, string>): K[] =>
  [...new Set([...previous.keys(), ...current.keys()])].filter((key) => previous.get(key) !== current.get(key));

const addedKeys = <K>(previous: Map<K, string>, current: Map<K, string>): K[] =>
  [...current.keys()].filter((key) => !previous.has(key));

const movedKeys = <K>(previous: Map<K, string>, current: Map<K, string>): K[] =>
  [...current.keys()].filter((key) => previous.has(key) && previous.get(key) !== current.get(key));

const bigintAsString = (_key: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;
