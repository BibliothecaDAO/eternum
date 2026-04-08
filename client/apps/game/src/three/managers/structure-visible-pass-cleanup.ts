interface CleanupVisibleStructurePassInput<TEntityId extends string | number | bigint, TStructure> {
  retainedAttachmentEntities: Set<number>;
  activeAttachmentEntities: Set<number>;
  attachmentSignatures: Map<number, string>;
  removeAttachments: (entityId: number) => void;
  trackedLabelEntityIds: Iterable<TEntityId>;
  visibleStructureIds: Set<TEntityId>;
  removeEntityIdLabel: (entityId: TEntityId) => void;
  previousVisibleIds: Set<TEntityId>;
  getStructureByEntityId: (entityId: TEntityId) => TStructure | undefined;
  removeStructurePoint: (entityId: TEntityId, structure: TStructure) => void;
}

export function cleanupVisibleStructurePass<TEntityId extends string | number | bigint, TStructure>(
  input: CleanupVisibleStructurePassInput<TEntityId, TStructure>,
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

  for (const entityId of input.trackedLabelEntityIds) {
    if (!input.visibleStructureIds.has(entityId)) {
      input.removeEntityIdLabel(entityId);
    }
  }

  for (const entityId of input.previousVisibleIds) {
    if (input.visibleStructureIds.has(entityId)) {
      continue;
    }

    const structure = input.getStructureByEntityId(entityId);
    if (structure) {
      input.removeStructurePoint(entityId, structure);
    }
  }

  return input.visibleStructureIds;
}
