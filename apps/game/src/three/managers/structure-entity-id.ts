import type { ID } from "@bibliothecadao/types";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

export const normalizeStructureEntityId = (entityId: ID | bigint | string | undefined | null): ID | undefined => {
  if (entityId === undefined || entityId === null) {
    return undefined;
  }

  return safeInteger(entityId);
};
