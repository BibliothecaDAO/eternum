import type { ID } from "@bibliothecadao/types";

export const normalizeStructureEntityId = (entityId: ID | bigint | string | undefined | null): ID | undefined => {
  if (entityId === undefined || entityId === null) {
    return undefined;
  }

  if (typeof entityId === "bigint") {
    const normalized = Number(entityId);
    if (!Number.isSafeInteger(normalized)) {
      console.warn(`[StructureManager] Entity id ${entityId.toString()} exceeds safe integer range`);
    }
    return normalized as ID;
  }

  if (typeof entityId === "string") {
    const parsed = Number(entityId);
    if (Number.isNaN(parsed)) {
      console.warn(`[StructureManager] Failed to parse entity id string "${entityId}"`);
      return undefined;
    }
    return parsed as ID;
  }

  return entityId;
};
