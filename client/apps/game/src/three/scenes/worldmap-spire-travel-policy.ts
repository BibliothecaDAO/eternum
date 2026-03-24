import { TileOccupier, type HexPosition, type ID } from "@bibliothecadao/types";

type EtherealTileReference = {
  occupier_id: ID;
  occupier_type: number;
  occupier_is_structure: boolean;
};

export type SpireTraversalAction =
  | {
      kind: "attack";
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

export function resolveSpireTraversalAction(input: {
  targetHex: HexPosition;
  etherealTile: EtherealTileReference | undefined;
}): SpireTraversalAction {
  const { targetHex, etherealTile } = input;

  if (
    etherealTile &&
    Number(etherealTile.occupier_id) !== 0 &&
    !etherealTile.occupier_is_structure &&
    isExplorerTileOccupier(etherealTile.occupier_type)
  ) {
    return {
      kind: "attack",
      targetArmyId: etherealTile.occupier_id,
      targetHex,
    };
  }

  return {
    kind: "travel",
    targetHex,
  };
}
