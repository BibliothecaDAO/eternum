interface ArmyAttachmentTrackingState {
  activeArmyAttachmentEntities: Set<number>;
  armyAttachmentSignatures: Map<number, string>;
  removeAttachments: (entityId: number) => void;
}

interface SyncArmyAttachmentStateInput<TEntityId, TTemplate> extends ArmyAttachmentTrackingState {
  visibleArmies: Iterable<{
    entityId: TEntityId;
    attachments?: TTemplate[];
  }>;
  toNumericId: (entityId: TEntityId) => number;
  getAttachmentSignature: (templates: TTemplate[]) => string;
  spawnAttachments: (entityId: number, templates: TTemplate[]) => void;
}

interface SyncVisibleArmyAttachmentInput<TEntityId, TTemplate> extends SyncArmyAttachmentStateInput<
  TEntityId,
  TTemplate
> {
  army: {
    entityId: TEntityId;
    attachments?: TTemplate[];
  };
  retainedEntityIds: Set<number>;
}

interface RemoveArmyAttachmentsIfTrackedInput extends ArmyAttachmentTrackingState {
  entityId: number;
}

export function syncArmyAttachmentState<TEntityId, TTemplate>(
  input: SyncArmyAttachmentStateInput<TEntityId, TTemplate>,
): void {
  const retainedEntityIds = new Set<number>();

  for (const army of input.visibleArmies) {
    syncVisibleArmyAttachment({
      ...input,
      army,
      retainedEntityIds,
    });
  }

  removeStaleArmyAttachments({
    ...input,
    retainedEntityIds,
  });
}

export function removeArmyAttachmentsIfTracked(input: RemoveArmyAttachmentsIfTrackedInput): void {
  if (!input.activeArmyAttachmentEntities.has(input.entityId)) {
    return;
  }

  input.removeAttachments(input.entityId);
  input.activeArmyAttachmentEntities.delete(input.entityId);
  input.armyAttachmentSignatures.delete(input.entityId);
}

function syncVisibleArmyAttachment<TEntityId, TTemplate>(
  input: SyncVisibleArmyAttachmentInput<TEntityId, TTemplate>,
): void {
  const entityId = input.toNumericId(input.army.entityId);
  const templates = input.army.attachments ?? [];

  if (templates.length === 0) {
    removeArmyAttachmentsIfTracked({
      entityId,
      activeArmyAttachmentEntities: input.activeArmyAttachmentEntities,
      armyAttachmentSignatures: input.armyAttachmentSignatures,
      removeAttachments: input.removeAttachments,
    });
    return;
  }

  input.retainedEntityIds.add(entityId);

  const signature = input.getAttachmentSignature(templates);
  const shouldRefreshAttachments =
    !input.activeArmyAttachmentEntities.has(entityId) || input.armyAttachmentSignatures.get(entityId) !== signature;

  if (!shouldRefreshAttachments) {
    return;
  }

  input.spawnAttachments(entityId, templates);
  input.armyAttachmentSignatures.set(entityId, signature);
  input.activeArmyAttachmentEntities.add(entityId);
}

function removeStaleArmyAttachments(
  input: ArmyAttachmentTrackingState & {
    retainedEntityIds: Set<number>;
  },
): void {
  if (input.activeArmyAttachmentEntities.size === 0) {
    return;
  }

  const staleEntityIds: number[] = [];
  for (const entityId of input.activeArmyAttachmentEntities) {
    if (!input.retainedEntityIds.has(entityId)) {
      staleEntityIds.push(entityId);
    }
  }

  for (const entityId of staleEntityIds) {
    removeArmyAttachmentsIfTracked({
      entityId,
      activeArmyAttachmentEntities: input.activeArmyAttachmentEntities,
      armyAttachmentSignatures: input.armyAttachmentSignatures,
      removeAttachments: input.removeAttachments,
    });
  }
}
