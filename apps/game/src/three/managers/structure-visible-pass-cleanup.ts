interface CleanupVisibleStructurePassInput<TEntityId extends string | number | bigint> {
  retainedAttachmentEntities: Set<number>;
  activeAttachmentEntities: Set<number>;
  attachmentSignatures: Map<number, string>;
  removeAttachments: (entityId: number) => void;
  visibleStructureIds: Set<TEntityId>;
  removeStructureCompactLabel: (entityId: TEntityId) => void;
  previousVisibleIds: Set<TEntityId>;
}

export function cleanupVisibleStructurePass<TEntityId extends string | number | bigint>(
  input: CleanupVisibleStructurePassInput<TEntityId>,
): Set<TEntityId> {
  if (input.activeAttachmentEntities.size > 0) {
    const staleAttachmentEntities: number[] = [];
    input.activeAttachmentEntities.forEach((entityId) => {
      if (!input.retainedAttachmentEntities.has(entityId)) {
        staleAttachmentEntities.push(entityId);
      }
    });

    staleAttachmentEntities.forEach((entityId) => {
      input.removeAttachments(entityId);
      input.activeAttachmentEntities.delete(entityId);
      input.attachmentSignatures.delete(entityId);
    });
  }

  for (const entityId of input.previousVisibleIds) {
    if (input.visibleStructureIds.has(entityId)) {
      continue;
    }

    input.removeStructureCompactLabel(entityId);
  }

  return input.visibleStructureIds;
}
