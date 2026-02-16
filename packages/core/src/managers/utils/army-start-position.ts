import { HexPosition } from "@bibliothecadao/types";

interface ResolveArmyActionStartPositionInput {
  componentPosition: HexPosition;
  overridePosition?: HexPosition;
}

export function resolveArmyActionStartPosition(input: ResolveArmyActionStartPositionInput): HexPosition {
  return input.overridePosition ?? input.componentPosition;
}
