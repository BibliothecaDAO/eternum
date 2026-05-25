import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

interface SyncArmyLabelVisibilityInput<TEntityId> {
  labels: Iterable<CSS2DObject>;
  setLabelVisible: (label: CSS2DObject) => boolean;
  revealLabel: (entityId: TEntityId, label: CSS2DObject) => void;
}

interface RemoveArmyLabelsInput<TEntityId> {
  trackedLabelEntityIds: Iterable<TEntityId>;
  shouldRetainLabel: (entityId: TEntityId) => boolean;
  removeEntityIdLabel: (entityId: TEntityId) => void;
}

export function syncArmyLabelVisibility<TEntityId extends string | number | bigint>(
  input: SyncArmyLabelVisibilityInput<TEntityId>,
): void {
  for (const label of input.labels) {
    const isVisible = input.setLabelVisible(label);
    const wasVisible = label.userData.isVisible === true;
    if (isVisible === wasVisible) {
      continue;
    }

    label.userData.isVisible = isVisible;
    label.visible = isVisible;
    label.element.style.display = isVisible ? "" : "none";

    if (isVisible) {
      input.revealLabel(label.userData.entityId as TEntityId, label);
    }
  }
}

export function removeArmyLabels<TEntityId>(input: RemoveArmyLabelsInput<TEntityId>): void {
  for (const entityId of input.trackedLabelEntityIds) {
    if (!input.shouldRetainLabel(entityId)) {
      input.removeEntityIdLabel(entityId);
    }
  }
}
