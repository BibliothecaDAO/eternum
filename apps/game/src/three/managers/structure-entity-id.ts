import type { ID } from "@bibliothecadao/types";
import { safeInteger } from "@/utils/native-id";

export const normalizeStructureEntityId = (entityId: ID | bigint | string | undefined | null): ID | undefined => {
  if (entityId === undefined || entityId === null) {
    return undefined;
  }

  if (typeof entityId === "bigint") return safeInteger(entityId);

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
