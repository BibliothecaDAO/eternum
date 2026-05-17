import { TileOccupier, type HexPosition, type ID } from "@bibliothecadao/types";

type EtherealTileReference = {
  occupier_id: ID;
  occupier_type: number;
  occupier_is_structure: boolean;
};

type SpireTraversalAction =
  | {
      kind: "attack";
      targetArmyId: ID;
      targetHex: HexPosition;
    }
  | {
      kind: "blocked";
      targetArmyId: ID;
      targetHex: HexPosition;
    }
  | {
      kind: "travel";
      targetHex: HexPosition;
    };

function isExplorerTileOccupier(occupierType: number): boolean {
  return (
    occupierType >= TileOccupier.ExplorerKnightT1Regular && occupierType <= TileOccupier.ExplorerCrossbowmanT3Daydreams
  );
}

function isOccupiedDestination(tile: EtherealTileReference | undefined): tile is EtherealTileReference {
  if (!tile) {
    return false;
  }

  return Number(tile.occupier_id) !== 0 || tile.occupier_is_structure || tile.occupier_type !== TileOccupier.None;
}

export function resolveSpireTraversalAction(input: {
  targetHex: HexPosition;
  etherealTile: EtherealTileReference | undefined;
  isOpposingArmy?: (targetArmyId: ID) => boolean;
}): SpireTraversalAction {
  const { targetHex, etherealTile, isOpposingArmy } = input;

  if (!isOccupiedDestination(etherealTile)) {
    return {
      kind: "travel",
      targetHex,
    };
  }

  if (!etherealTile.occupier_is_structure && isExplorerTileOccupier(etherealTile.occupier_type)) {
    if (isOpposingArmy && !isOpposingArmy(etherealTile.occupier_id)) {
      return {
        kind: "blocked",
        targetArmyId: etherealTile.occupier_id,
        targetHex,
      };
    }

    return {
      kind: "attack",
      targetArmyId: etherealTile.occupier_id,
      targetHex,
    };
  }

  return {
    kind: "blocked",
    targetArmyId: etherealTile.occupier_id,
    targetHex,
  };
}

export function resolveSpireTraversalDestinationHex(
  actionPath: ReadonlyArray<{ hex: HexPosition }>,
): HexPosition | undefined {
  return actionPath[0]?.hex;
}
