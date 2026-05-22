import type { ID } from "@bibliothecadao/types";

export interface WorldmapHoverLabelEntity {
  id: ID;
  owner?: bigint;
}

export function resolveWorldmapHoverLabelEntity(
  entityId: ID | undefined,
  cachedEntity?: WorldmapHoverLabelEntity,
): WorldmapHoverLabelEntity | undefined {
  if (entityId === undefined) {
    return undefined;
  }

  return cachedEntity?.id === entityId ? cachedEntity : { id: entityId };
}
