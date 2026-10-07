import { isTileOccupierArmy } from "@bibliothecadao/eternum";
import type { HexPosition, ID } from "@bibliothecadao/types";

type DestinationTileReference = {
  occupier_id: ID;
  occupier_type: number;
  occupier_is_structure: boolean;
};

type SpireTraversalAction =
  | {
      kind: "attack";
      targetArmyId: ID;
      defenderAlt: boolean;
      targetHex: HexPosition;
    }
  | {
      kind: "travel";
      targetHex: HexPosition;
    };

export function resolveSpireTraversalAction(input: {
  attackerHex: HexPosition;
  attackerAlt: boolean;
  getTile: (alt: boolean, col: number, row: number) => DestinationTileReference | undefined;
}): SpireTraversalAction {
  const targetHex = input.attackerHex;
  const defenderAlt = !input.attackerAlt;
  const destinationTile = input.getTile(defenderAlt, targetHex.col, targetHex.row);

  if (
    destinationTile &&
    Number(destinationTile.occupier_id) !== 0 &&
    !destinationTile.occupier_is_structure &&
    isTileOccupierArmy(destinationTile.occupier_type)
  ) {
    return { kind: "attack", targetArmyId: destinationTile.occupier_id, targetHex, defenderAlt };
  }
  return { kind: "travel", targetHex };
}
