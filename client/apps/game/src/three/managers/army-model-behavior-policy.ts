interface ResolveRotationUpdateInput {
  currentRotation: number;
  targetRotation: number;
  rotationSpeed: number;
  deltaTime: number;
}

interface ResolveMovementProgressUpdateInput {
  progress: number;
  distance: number;
  movementSpeed: number;
  deltaTime: number;
}

interface ResolveMovementProgressUpdateResult {
  nextProgress: number;
  shouldCompletePath: boolean;
}

interface ShouldSwitchModelForPositionInput<TModel> {
  currentModel: TModel | undefined;
  resolvedModel: TModel;
}

export function resolveRotationUpdate(input: ResolveRotationUpdateInput): number {
  const { currentRotation, targetRotation, rotationSpeed, deltaTime } = input;
  const rotationDiff = targetRotation - currentRotation;
  const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
  return currentRotation + normalizedDiff * rotationSpeed * deltaTime;
}

export function resolveMovementProgressUpdate(
  input: ResolveMovementProgressUpdateInput,
): ResolveMovementProgressUpdateResult {
  const { progress, distance, movementSpeed, deltaTime } = input;
  const travelTime = distance / movementSpeed;
  if (!Number.isFinite(travelTime) || travelTime <= 0) {
    return {
      nextProgress: 1,
      shouldCompletePath: true,
    };
  }

  const nextProgress = progress + deltaTime / travelTime;
  return {
    nextProgress,
    shouldCompletePath: nextProgress >= 1,
  };
}

export function shouldSwitchModelForPosition<TModel>(input: ShouldSwitchModelForPositionInput<TModel>): boolean {
  return input.currentModel !== input.resolvedModel;
}
