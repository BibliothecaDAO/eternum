interface CountUpdatableModel {
  setCount(count: number): void;
}

interface FinalizeVisibleStructureModelPassInput<TModel extends CountUpdatableModel> {
  modelInstanceCounts: Map<TModel, number>;
  nextActiveStructureModels: Set<TModel>;
  nextActiveCosmeticStructureModels: Set<TModel>;
  applyPendingModelBounds: () => void;
  endPointBatches?: () => void;
}

export function finalizeVisibleStructureModelPass<TModel extends CountUpdatableModel>(
  input: FinalizeVisibleStructureModelPassInput<TModel>,
): {
  activeStructureModels: Set<TModel>;
  activeCosmeticStructureModels: Set<TModel>;
} {
  for (const [model, count] of input.modelInstanceCounts) {
    model.setCount(count);
  }

  input.applyPendingModelBounds();
  input.endPointBatches?.();

  return {
    activeStructureModels: input.nextActiveStructureModels,
    activeCosmeticStructureModels: input.nextActiveCosmeticStructureModels,
  };
}
