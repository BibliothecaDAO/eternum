import type { HexPosition, ID } from "@bibliothecadao/types";

interface OwnedEntitySummary {
  id: ID;
  owner?: bigint;
}

interface ChestSummary {
  id: ID;
}

interface ResolveWorldmapHexClickPlanInput {
  hasBlockingOverlay: boolean;
  hexCoords: HexPosition | null;
  accountAddress?: bigint;
  army?: OwnedEntitySummary;
  structure?: OwnedEntitySummary;
  chest?: ChestSummary;
}

type WorldmapHexClickPlan =
  | { kind: "ignore" }
  | {
      kind: "select";
      isMine: boolean;
      selection: { type: "army"; entityId: ID } | { type: "structure"; entityId: ID } | { type: "clear" };
    };

export function resolveWorldmapHexClickPlan({
  hasBlockingOverlay,
  hexCoords,
  accountAddress,
  army,
  structure,
  chest,
}: ResolveWorldmapHexClickPlanInput): WorldmapHexClickPlan {
  if (hasBlockingOverlay || !hexCoords) {
    return { kind: "ignore" };
  }

  const isMine =
    accountAddress !== undefined && (army?.owner === accountAddress || structure?.owner === accountAddress);

  if (army && army.owner === accountAddress) {
    return {
      kind: "select",
      isMine: true,
      selection: {
        type: "army",
        entityId: army.id,
      },
    };
  }

  if (structure && structure.owner === accountAddress) {
    return {
      kind: "select",
      isMine: true,
      selection: {
        type: "structure",
        entityId: structure.id,
      },
    };
  }

  if (chest || !army || !structure) {
    return {
      kind: "select",
      isMine,
      selection: {
        type: "clear",
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
