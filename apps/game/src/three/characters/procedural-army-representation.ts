import { ModelType } from "@/three/types/army";

export const PROCEDURAL_CHARACTER_ATTACHMENT_SLOTS: ReadonlySet<string> = new Set(["back", "offhand", "weapon"]);

interface ReconcileProceduralArmyRepresentationsInput {
  activeEntityIds: Set<number>;
  readyEntityIds: ReadonlySet<number>;
  setLegacyAttachmentsVisible(entityId: number, visible: boolean): void;
  setLegacyModelVisible(entityId: number, visible: boolean): void;
}

/** Every assigned army model hands off to the shared procedural presentation runtime. */
export function shouldPresentArmyProcedurally(modelType: ModelType | undefined): boolean {
  return modelType !== undefined;
}

/**
 * Makes the asynchronous handoff atomic: the legacy representation remains
 * visible until its procedural actor exists, then both model and owned prop
 * slots switch together. Removing an actor restores the fallback in one pass.
 */
export function reconcileProceduralArmyRepresentations(input: ReconcileProceduralArmyRepresentationsInput): void {
  input.activeEntityIds.forEach((entityId) => {
    if (input.readyEntityIds.has(entityId)) return;
    setLegacyRepresentationVisible(input, entityId, true);
    input.activeEntityIds.delete(entityId);
  });

  input.readyEntityIds.forEach((entityId) => {
    if (input.activeEntityIds.has(entityId)) return;
    setLegacyRepresentationVisible(input, entityId, false);
    input.activeEntityIds.add(entityId);
  });
}

function setLegacyRepresentationVisible(
  input: ReconcileProceduralArmyRepresentationsInput,
  entityId: number,
  visible: boolean,
): void {
  input.setLegacyModelVisible(entityId, visible);
  input.setLegacyAttachmentsVisible(entityId, visible);
}
