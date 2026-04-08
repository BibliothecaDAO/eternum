interface MatrixWritableModel {
  setMatrixAt(instanceId: number, matrix: unknown): void;
}

interface RecordVisibleStructureModelInstanceInput<
  TStructureType,
  TEntityId extends string | number | bigint,
  TModel extends MatrixWritableModel,
> {
  structure: {
    entityId: TEntityId;
    stage: number;
    level: number;
    hasWonder: boolean;
  };
  structureType: TStructureType;
  isRealmStructure: boolean;
  models: TModel[];
  wonderModelIndex: number;
  matrix: unknown;
  modelInstanceCounts: Map<TModel, number>;
  activeModels: Set<TModel>;
  entityIdMaps: Map<TStructureType, Map<number, TEntityId>>;
  wonderEntityIdMap: Map<number, TEntityId>;
}

interface RecordVisibleCosmeticStructureModelInstanceInput<
  TEntityId extends string | number | bigint,
  TModel extends MatrixWritableModel,
> {
  cosmeticId: string;
  entityId: TEntityId;
  models: TModel[];
  matrix: unknown;
  modelInstanceCounts: Map<TModel, number>;
  activeModels: Set<TModel>;
  cosmeticEntityIdMaps: Map<string, Map<number, TEntityId>>;
}

export function recordVisibleStructureModelInstance<
  TStructureType,
  TEntityId extends string | number | bigint,
  TModel extends MatrixWritableModel,
>(input: RecordVisibleStructureModelInstanceInput<TStructureType, TEntityId, TModel>): void {
  const model = input.isRealmStructure ? input.models[input.structure.level] : input.models[input.structure.stage];
  if (!model) {
    return;
  }

  const entityIdsByInstance = getOrCreateEntityIdMap(input.entityIdMaps, input.structureType);
  const instanceId = recordModelInstance({
    model,
    matrix: input.matrix,
    modelInstanceCounts: input.modelInstanceCounts,
    activeModels: input.activeModels,
  });
  entityIdsByInstance.set(instanceId, input.structure.entityId);

  if (!input.isRealmStructure || !input.structure.hasWonder) {
    return;
  }

  const wonderModel = input.models[input.wonderModelIndex];
  if (!wonderModel) {
    return;
  }

  const wonderInstanceId = recordModelInstance({
    model: wonderModel,
    matrix: input.matrix,
    modelInstanceCounts: input.modelInstanceCounts,
    activeModels: input.activeModels,
  });
  input.wonderEntityIdMap.set(wonderInstanceId, input.structure.entityId);
}

export function recordVisibleCosmeticStructureModelInstance<
  TEntityId extends string | number | bigint,
  TModel extends MatrixWritableModel,
>(input: RecordVisibleCosmeticStructureModelInstanceInput<TEntityId, TModel>): void {
  const model = input.models[0];
  if (!model) {
    return;
  }

  const entityIdsByInstance = getOrCreateEntityIdMap(input.cosmeticEntityIdMaps, input.cosmeticId);
  const instanceId = recordModelInstance({
    model,
    matrix: input.matrix,
    modelInstanceCounts: input.modelInstanceCounts,
    activeModels: input.activeModels,
  });
  entityIdsByInstance.set(instanceId, input.entityId);
}

function getOrCreateEntityIdMap<TKey, TEntityId extends string | number | bigint>(
  groupedEntityIds: Map<TKey, Map<number, TEntityId>>,
  key: TKey,
): Map<number, TEntityId> {
  if (!groupedEntityIds.has(key)) {
    groupedEntityIds.set(key, new Map());
  }

  return groupedEntityIds.get(key)!;
}

function recordModelInstance<TModel extends MatrixWritableModel>(input: {
  model: TModel;
  matrix: unknown;
  modelInstanceCounts: Map<TModel, number>;
  activeModels: Set<TModel>;
}): number {
  const instanceId = input.modelInstanceCounts.get(input.model) ?? 0;
  input.model.setMatrixAt(instanceId, input.matrix);
  input.modelInstanceCounts.set(input.model, instanceId + 1);
  input.activeModels.add(input.model);
  return instanceId;
}
