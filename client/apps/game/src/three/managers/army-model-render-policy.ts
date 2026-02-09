export interface ResolveRenderableBaseModelInput<TModel> {
  hasActiveCosmetic: boolean;
  desiredModel: TModel | null;
  previousRenderableModel: TModel | null;
  isDesiredModelLoaded: boolean;
  isPreviousModelLoaded: boolean;
}

/**
 * Choose which base model should currently be rendered.
 * Keeps the previous renderable model visible while the desired model is still loading
 * to avoid transient "ghost" frames during model swaps (e.g. land <-> boat).
 */
export function resolveRenderableBaseModel<TModel>(
  input: ResolveRenderableBaseModelInput<TModel>,
): TModel | null {
  const { hasActiveCosmetic, desiredModel, previousRenderableModel, isDesiredModelLoaded, isPreviousModelLoaded } = input;

  if (hasActiveCosmetic) {
    return null;
  }

  if (desiredModel === null) {
    return null;
  }

  if (isDesiredModelLoaded) {
    return desiredModel;
  }

  if (previousRenderableModel !== null && isPreviousModelLoaded) {
    return previousRenderableModel;
  }

  return null;
}
