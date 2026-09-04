interface FastTravelInteractiveHexManager {
  clearHexes(): void;
}

interface FastTravelSelectionPulseManager {
  hideSelection(): void;
}

interface FastTravelSelectedHexManager {
  resetPosition(): void;
}

interface FastTravelPathRenderer {
  removePath(entityId: number): void;
  setSelectedPath(entityId: number | null): void;
}

interface ResetFastTravelRuntimeStateInput<THydratedChunk, TRenderState, TEntityAnchor, TArmy, TSpire, TTimeout> {
  currentHydratedChunk: THydratedChunk | null;
  currentRenderState: TRenderState | null;
  currentEntityAnchors: TEntityAnchor[];
  sceneArmies: TArmy[];
  sceneSpires: TSpire[];
  selectedArmyEntityId: string | null;
  previewTargetHexKey: string | null;
  currentChunk: string;
  chunkRefreshTimeout: TTimeout | null;
  clearTravelVisualGroups: () => void;
  interactiveHexManager: FastTravelInteractiveHexManager;
  selectionPulseManager: FastTravelSelectionPulseManager;
  selectedHexManager: FastTravelSelectedHexManager;
  pathRenderer: FastTravelPathRenderer;
  clearTimeout: (timeoutId: TTimeout) => void;
  resolvePathEntityId: (entityId: string) => number;
}

interface ResetFastTravelRuntimeStateResult<THydratedChunk, TRenderState, TEntityAnchor, TArmy, TSpire, TTimeout> {
  currentHydratedChunk: THydratedChunk | null;
  currentRenderState: TRenderState | null;
  currentEntityAnchors: TEntityAnchor[];
  sceneArmies: TArmy[];
  sceneSpires: TSpire[];
  selectedArmyEntityId: string | null;
  previewTargetHexKey: string | null;
  currentChunk: string;
  chunkRefreshTimeout: TTimeout | null;
  pendingChunkRefreshForce: boolean;
}

export function resetFastTravelRuntimeState<THydratedChunk, TRenderState, TEntityAnchor, TArmy, TSpire, TTimeout>({
  selectedArmyEntityId,
  chunkRefreshTimeout,
  clearTravelVisualGroups,
  interactiveHexManager,
  selectionPulseManager,
  selectedHexManager,
  pathRenderer,
  clearTimeout,
  resolvePathEntityId,
}: ResetFastTravelRuntimeStateInput<
  THydratedChunk,
  TRenderState,
  TEntityAnchor,
  TArmy,
  TSpire,
  TTimeout
>): ResetFastTravelRuntimeStateResult<THydratedChunk, TRenderState, TEntityAnchor, TArmy, TSpire, TTimeout> {
  clearTravelVisualGroups();
  interactiveHexManager.clearHexes();
  selectionPulseManager.hideSelection();
  selectedHexManager.resetPosition();

  if (selectedArmyEntityId !== null) {
    pathRenderer.removePath(resolvePathEntityId(selectedArmyEntityId));
  }
  pathRenderer.setSelectedPath(null);

  if (chunkRefreshTimeout !== null) {
    clearTimeout(chunkRefreshTimeout);
  }

  return {
    currentHydratedChunk: null,
    currentRenderState: null,
    currentEntityAnchors: [],
    sceneArmies: [],
    sceneSpires: [],
    selectedArmyEntityId: null,
    previewTargetHexKey: null,
    currentChunk: "null",
    chunkRefreshTimeout: null,
    pendingChunkRefreshForce: false,
  };
}
