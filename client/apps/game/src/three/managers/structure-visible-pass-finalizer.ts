interface CountUpdatableModel {
  setCount(count: number): void;
}

interface FinalizeVisibleStructureModelPassInput<TModel extends CountUpdatableModel> {
  modelInstanceCounts: ReadonlyMap<TModel, number>;
  previouslyActiveStructureModels: Set<TModel>;
  previouslyActiveCosmeticStructureModels: Set<TModel>;
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
  applyModelInstanceCounts(input.modelInstanceCounts);
  hideStaleModels(input.previouslyActiveStructureModels, input.nextActiveStructureModels);
  hideStaleModels(input.previouslyActiveCosmeticStructureModels, input.nextActiveCosmeticStructureModels);

  input.applyPendingModelBounds();
  input.endPointBatches?.();

  return {
    activeStructureModels: input.nextActiveStructureModels,
    activeCosmeticStructureModels: input.nextActiveCosmeticStructureModels,
  };
}

function applyModelInstanceCounts<TModel extends CountUpdatableModel>(
  modelInstanceCounts: ReadonlyMap<TModel, number>,
) {
  modelInstanceCounts.forEach((count, model) => model.setCount(count));
}

function hideStaleModels<TModel extends CountUpdatableModel>(
  previouslyActiveModels: Set<TModel>,
  nextActiveModels: Set<TModel>,
): void {
  previouslyActiveModels.forEach((model) => {
    if (!nextActiveModels.has(model)) {
      model.setCount(0);
    }
  });
}
