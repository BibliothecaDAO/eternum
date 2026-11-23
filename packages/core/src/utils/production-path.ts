/** Whether the game enables resource production and supplies a recipe for this resource. */
export const hasEnabledProductionPath = (
  recipe: { readonly complex_inputs: readonly unknown[] } | undefined,
  enabled: boolean,
): boolean => enabled && recipe !== undefined && recipe.complex_inputs.length > 0;
