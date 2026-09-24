/** Which building costs a game carries: labor only, resources only, or both for the player to choose. */
export type BuildingCostMode = "simple" | "resource" | "choice";

/**
 * Which building costs a game's rules carry: labor only ("simple"), resources only ("resource"), or both for the player
 * to choose ("choice"). It is read from the rules' own cost tables, never from the mode's name.
 */
export const buildingCostModeOf = (
  rules: Iterable<{ readonly simple_cost: readonly unknown[]; readonly complex_cost: readonly unknown[] }>,
): BuildingCostMode => {
  let simple = false;
  let resource = false;
  for (const rule of rules) {
    simple ||= rule.simple_cost.length > 0;
    resource ||= rule.complex_cost.length > 0;
  }
  if (simple && resource) return "choice";
  return simple ? "simple" : "resource";
};

/** Whether a build pays the labor-only cost: always where that is the only cost, by the player's choice where both exist. */
export const resolveUseSimpleCost = (mode: BuildingCostMode, requestedSimpleCost: boolean): boolean =>
  mode === "simple" || (mode === "choice" && requestedSimpleCost);
