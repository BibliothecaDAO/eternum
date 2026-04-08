import type { ModelType } from "../types/army";
import { getIndicatorYOffset } from "../constants/indicator-constants";

interface ArmyIndicatorUpdateInput<TEntityId, TPosition, TColorValue> {
  entityId: TEntityId;
  color: string;
  position: TPosition;
  indicatorMetadataCache: Map<TEntityId, number>;
  setIndicatorColor: (color: string) => TColorValue;
  updateIndicator: (input: { entityId: TEntityId; position: TPosition; color: TColorValue; yOffset: number }) => void;
}

export function syncArmyIndicatorPresentationState<TEntityId, TPosition, TColorValue>(
  input: ArmyIndicatorUpdateInput<TEntityId, TPosition, TColorValue> & {
    modelType: ModelType;
  },
): void {
  const yOffset = getIndicatorYOffset(input.modelType);
  input.indicatorMetadataCache.set(input.entityId, yOffset);

  updateArmyIndicator({
    ...input,
    yOffset,
  });
}

export function syncMovingArmyIndicatorPresentationState<TEntityId, TPosition, TColorValue>(
  input: ArmyIndicatorUpdateInput<TEntityId, TPosition, TColorValue>,
): void {
  const yOffset = input.indicatorMetadataCache.get(input.entityId) ?? 2.5;

  updateArmyIndicator({
    ...input,
    yOffset,
  });
}

function updateArmyIndicator<TEntityId, TPosition, TColorValue>(
  input: ArmyIndicatorUpdateInput<TEntityId, TPosition, TColorValue> & {
    yOffset: number;
  },
): void {
  input.updateIndicator({
    entityId: input.entityId,
    position: input.position,
    color: input.setIndicatorColor(input.color),
    yOffset: input.yOffset,
  });
}
