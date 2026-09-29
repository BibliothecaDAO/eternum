/** Which production commands a game's command mask enables: labor-paid, resource-paid, or both. */
interface EnabledProductionPaths {
  readonly labor: boolean;
  readonly resource: boolean;
}

/**
 * Whether a player can refill a resource's production: it has a recipe on a path the command mask enables. It is read
 * from the game's own recipes and mask, never from the mode's name.
 */
export const hasEnabledProductionPath = (
  recipe: { readonly simple_inputs: readonly unknown[]; readonly complex_inputs: readonly unknown[] } | undefined,
  paths: EnabledProductionPaths,
): boolean =>
  recipe !== undefined &&
  ((paths.labor && recipe.simple_inputs.length > 0) || (paths.resource && recipe.complex_inputs.length > 0));
