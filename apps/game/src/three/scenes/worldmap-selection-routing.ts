import type { HexPosition, ID } from "@bibliothecadao/types";
import { isViewerOwner } from "@bibliothecadao/eternum";

interface OwnedEntitySummary {
  id: ID;
  owner?: bigint;
}

interface ResolveWorldmapHexClickPlanInput {
  hexCoords: HexPosition | null;
  accountAddress?: bigint | null;
  army?: OwnedEntitySummary;
  structure?: OwnedEntitySummary;
}

type WorldmapHexClickPlan =
  | { kind: "ignore" }
  | {
      kind: "select";
      isMine: boolean;
      selection: { type: "army"; entityId: ID } | { type: "structure"; entityId: ID } | { type: "clear" };
    };

export function resolveWorldmapHexClickPlan({
  hexCoords,
  accountAddress,
  army,
  structure,
}: ResolveWorldmapHexClickPlanInput): WorldmapHexClickPlan {
  if (!hexCoords) {
    return { kind: "ignore" };
  }

  const ownsArmy = isViewerOwner(army?.owner, accountAddress);
  const ownsStructure = isViewerOwner(structure?.owner, accountAddress);
  const isMine = ownsArmy || ownsStructure;

  if (army && ownsArmy) {
    return {
      kind: "select",
      isMine: true,
      selection: {
        type: "army",
        entityId: army.id,
      },
    };
  }

  if (structure && ownsStructure) {
    return {
      kind: "select",
      isMine: true,
      selection: {
        type: "structure",
        entityId: structure.id,
      },
    };
  }

  return {
    kind: "select",
    isMine,
    selection: {
      type: "clear",
    },
  };
}
