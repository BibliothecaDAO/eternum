import type { HexEntityInfo, HexPosition, ID } from "@bibliothecadao/types";

interface HoverLabelCachedEntities {
  army?: HexEntityInfo;
  structure?: HexEntityInfo;
  chest?: HexEntityInfo;
}

interface RaycastArmyHoverTarget {
  entityId: ID;
  position?: HexPosition;
}

export interface WorldmapHoverLabelTargets {
  armyId?: ID;
  structureId?: ID;
  chestId?: ID;
}

interface ResolveWorldmapHoverLabelTargetsInput {
  cachedEntities: HoverLabelCachedEntities;
  hoveredHex: HexPosition;
  managerEntities?: HoverLabelCachedEntities;
  raycastArmy?: RaycastArmyHoverTarget;
}

export function resolveWorldmapHoverLabelTargets(
  input: ResolveWorldmapHoverLabelTargetsInput,
): WorldmapHoverLabelTargets {
  return {
    armyId: resolveArmyHoverTarget(input),
    structureId: input.cachedEntities.structure?.id ?? input.managerEntities?.structure?.id,
    chestId: input.cachedEntities.chest?.id ?? input.managerEntities?.chest?.id,
  };
}

function resolveArmyHoverTarget(input: ResolveWorldmapHoverLabelTargetsInput): ID | undefined {
  if (input.cachedEntities.army) {
    return input.cachedEntities.army.id;
  }

  if (input.managerEntities?.army) {
    return input.managerEntities.army.id;
  }

  if (!input.raycastArmy?.position) {
    return undefined;
  }

  return isSameHex(input.hoveredHex, input.raycastArmy.position) ? input.raycastArmy.entityId : undefined;
}

function isSameHex(left: HexPosition, right: HexPosition): boolean {
  return left.col === right.col && left.row === right.row;
}
